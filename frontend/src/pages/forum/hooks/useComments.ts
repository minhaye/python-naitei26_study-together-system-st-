/**
 * useComments — Quản lý bình luận và reply của một bài viết Forum với Optimistic UI (0ms).
 */

import { useState, useEffect, useCallback } from 'react';
import type { Comment, CommentCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';

/** Cập nhật đệ quy trạng thái isLiked và likesCount của một comment trong cây comment */
function updateLikeInTree(comments: Comment[], commentId: string): Comment[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      const nextLiked = !c.isLiked;
      return {
        ...c,
        isLiked: nextLiked,
        likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
      };
    }
    if (c.replies.length > 0) return { ...c, replies: updateLikeInTree(c.replies, commentId) };
    return c;
  });
}

/** Thêm reply đệ quy vào đúng parent trong cây comment */
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
  const { requireAuth, currentUser } = useAuth();
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
    setIsLoading(true);
    const data = await forumApi.getComments(postId);
    setComments(data);
    setIsLoading(false);
  }, [postId]);

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
        parentCommentId: null,
        content,
        createdAt: new Date().toISOString(),
        timeAgo: 'Vừa xong',
        likesCount: 0,
        isLiked: false,
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
      const realComment = await forumApi.createComment(payload, currentUser.name);
      
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
        parentCommentId: parentId,
        content,
        createdAt: new Date().toISOString(),
        timeAgo: 'Vừa xong',
        likesCount: 0,
        isLiked: false,
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
      const realReply = await forumApi.createComment(payload, currentUser.name);

      // Replace tempId bằng real ID đệ quy
      setComments((prev) =>
        replaceTempIdInTree(prev, parentId, tempId, realReply, currentUser.name)
      );
    });
  };

  /**
   * Toggle thích/bỏ thích một bình luận — Optimistic UI (0ms).
   */
  const handleToggleCommentLike = (commentId: string, isLiked: boolean) => {
    requireAuth(async () => {
      // 1. Cập nhật giao diện 0ms
      setComments((prev) => updateLikeInTree(prev, commentId));

      // 2. Gọi API ngầm
      if (isLiked) {
        await forumApi.unlikeComment(commentId);
      } else {
        await forumApi.likeComment(commentId);
      }
    });
  };

  return {
    comments,
    isLoading,
    handleAddComment,
    handleReply,
    handleToggleCommentLike,
  };
}
