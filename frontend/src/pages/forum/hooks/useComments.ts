/**
 * useComments — Quản lý bình luận và reply của một bài viết Forum với Optimistic UI (0ms).
 */

import { useState, useEffect, useCallback } from 'react';
import type { Comment, CommentCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';
import { applyReactionOptimistic } from '../constants/reactions';

/** Cập nhật đệ quy cảm xúc của một comment trong cây comment (emoji = null nghĩa là bỏ cảm xúc) */
function updateReactionInTree(comments: Comment[], commentId: string, emoji: string | null): Comment[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      return { ...c, reactions: applyReactionOptimistic(c.reactions, emoji) };
    }
    if (c.replies.length > 0) return { ...c, replies: updateReactionInTree(c.replies, commentId, emoji) };
    return c;
  });
}

/** Cập nhật đệ quy nội dung của một comment trong cây comment */
function updateCommentInTree(comments: Comment[], commentId: string, newContent: string): Comment[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      return {
        ...c,
        content: newContent,
        updatedAt: new Date().toISOString(),
        isEdited: true,
      };
    }
    if (c.replies.length > 0) {
      return { ...c, replies: updateCommentInTree(c.replies, commentId, newContent) };
    }
    return c;
  });
}

/** Xóa đệ quy một comment khỏi cây comment */
function deleteCommentInTree(comments: Comment[], commentId: string): Comment[] {
  return comments
    .filter((c) => c.id !== commentId)
    .map((c) => {
      if (c.replies.length > 0) {
        return { ...c, replies: deleteCommentInTree(c.replies, commentId) };
      }
      return c;
    });
}

/** Thêm reply vào mảng replies của Root comment chuẩn Facebook */
function appendReplyInTree(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map((c) => {
    // Nếu parentId chính là root comment HOẶC parentId nằm trong mảng replies của root comment này
    if (c.id === parentId || c.replies.some((r) => r.id === parentId)) {
      return { ...c, replies: [...c.replies, reply] };
    }
    return c;
  });
}

/** Thay thế tempId trong mảng replies của Root comment */
function replaceTempIdInTree(
  comments: Comment[],
  parentId: string,
  tempId: string,
  realReply: Comment,
  authorName: string
): Comment[] {
  return comments.map((c) => {
    if (c.id === parentId || c.replies.some((r) => r.id === parentId)) {
      return {
        ...c,
        replies: c.replies.map((r) =>
          r.id === tempId ? { ...realReply, authorName } : r
        ),
      };
    }
    return c;
  });
}

export function useComments(postId: string, onCommentAdded?: () => void) {
  const { requireAuth, currentUser, isLoggedIn } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Đăng ký tác giả hiện tại vào bộ nhớ API
  useEffect(() => {
    if (currentUser?.id && currentUser?.name) {
      forumApi.registerAuthor(currentUser.id, currentUser.name);
    }
  }, [currentUser]);

  const loadComments = useCallback(async () => {
    if (!postId) return;

    // 1. Kiểm tra RAM Cache (Top 10 bài vừa xem): Hiện ngay lập tức 0ms
    const cached = forumApi.getCachedComments(postId);
    if (cached && cached.length > 0) {
      setComments(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    // 2. Revalidate ngầm từ Server
    try {
      const userId = isLoggedIn ? currentUser?.id : undefined;
      const data = await forumApi.getComments(postId, userId);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [postId, isLoggedIn, currentUser?.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  /**
   * Thêm bình luận mới (cấp 1) — Optimistic UI (0ms).
   */
  const handleAddComment = (content: string) => {
    requireAuth(async () => {
      const tempId = `temp-cmt-${Date.now()}`;
      const newCommentUI: Comment = {
        id: tempId,
        postId,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
        parentCommentId: null,
        content,
        createdAt: new Date().toISOString(),
        timeAgo: 'Vừa xong',
        reactions: [],
        replies: [],
      };

      // 1. Cập nhật giao diện 0ms
      setComments((prev) => [newCommentUI, ...prev]);
      onCommentAdded?.();

      // 2. Gọi API ngầm lưu vào bộ nhớ Store
      const payload: CommentCreate = {
        post_id: postId,
        author_id: currentUser.id,
        content,
        parent_comment_id: null,
      };
      const realComment = await forumApi.createComment(payload, currentUser.name, currentUser.avatarUrl);
      
      // Replace tempId với real ID
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...realComment, authorName: currentUser.name } : c))
      );
    });
  };

  /**
   * Reply một bình luận — Optimistic UI (0ms đệ quy).
   */
  const handleReply = (parentId: string, content: string) => {
    requireAuth(async () => {
      const tempId = `temp-reply-${Date.now()}`;
      const newReplyUI: Comment = {
        id: tempId,
        postId,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
        parentCommentId: parentId,
        content,
        createdAt: new Date().toISOString(),
        timeAgo: 'Vừa xong',
        reactions: [],
        replies: [],
      };

      // 1. Cập nhật giao diện 0ms
      setComments((prev) => appendReplyInTree(prev, parentId, newReplyUI));
      onCommentAdded?.();

      // 2. Gọi API ngầm lưu vào bộ nhớ Store
      const payload: CommentCreate = {
        post_id: postId,
        author_id: currentUser.id,
        content,
        parent_comment_id: parentId,
      };
      const realReply = await forumApi.createComment(payload, currentUser.name, currentUser.avatarUrl);

      // Replace tempId bằng real ID đệ quy
      setComments((prev) =>
        replaceTempIdInTree(prev, parentId, tempId, realReply, currentUser.name)
      );
    });
  };

  /**
   * Chỉnh sửa bình luận — Optimistic UI (0ms đệ quy).
   */
  const handleUpdateComment = (commentId: string, newContent: string) => {
    return requireAuth(async () => {
      // 1. Cập nhật UI ngay lập tức 0ms
      setComments((prev) => updateCommentInTree(prev, commentId, newContent));

      // 2. Gọi API ngầm ở background
      try {
        await forumApi.updateComment(commentId, { content: newContent }, postId);
      } catch (error) {
        console.error('Failed to update comment', error);
      }
    });
  };

  /**
   * Xóa bình luận — Optimistic UI (0ms đệ quy).
   */
  const handleDeleteComment = (commentId: string) => {
    return requireAuth(async () => {
      // 1. Cập nhật UI ngay lập tức 0ms
      setComments((prev) => deleteCommentInTree(prev, commentId));

      // 2. Gọi API delete ở background
      try {
        await forumApi.deleteComment(commentId, postId);
      } catch (error) {
        console.error('Failed to delete comment', error);
      }
    });
  };

  /**
   * Bày tỏ cảm xúc trên một bình luận — Optimistic UI (0ms đệ quy).
   */
  const handleReactComment = (commentId: string, emoji: string) => {
    requireAuth(async () => {
      // 1. Cập nhật giao diện 0ms
      setComments((prev) => updateReactionInTree(prev, commentId, emoji));

      // 2. Gọi API ngầm
      await forumApi.setCommentReaction(commentId, emoji, currentUser?.id, postId);
    });
  };

  /**
   * Bỏ cảm xúc trên một bình luận — Optimistic UI (0ms đệ quy).
   */
  const handleRemoveCommentReaction = (commentId: string) => {
    requireAuth(async () => {
      // 1. Cập nhật giao diện 0ms
      setComments((prev) => updateReactionInTree(prev, commentId, null));

      // 2. Gọi API ngầm
      await forumApi.removeCommentReaction(commentId, currentUser?.id, postId);
    });
  };

  return {
    comments,
    isLoading,
    handleAddComment,
    handleReply,
    handleUpdateComment,
    handleDeleteComment,
    handleReactComment,
    handleRemoveCommentReaction,
  };
}
