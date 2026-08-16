/**
 * useComments — Quản lý bình luận và reply của một bài viết Forum.
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
function appendReplyInTree(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map((c) => {
    if (c.id === parentId) return { ...c, replies: [...c.replies, reply] };
    if (c.replies.length > 0)
      return { ...c, replies: appendReplyInTree(c.replies, parentId, reply) };
    return c;
  });
}

export function useComments(postId: string) {
  const { requireAuth, currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
   * Thêm bình luận mới (cấp 1) — ĐƯA LÊN ĐẦU DANH SÁCH với Avatar của currentUser.
   */
  const handleAddComment = (content: string) => {
    requireAuth(async () => {
      const payload: CommentCreate = {
        post_id: postId,
        author_id: currentUser.id,
        content,
        parent_comment_id: null,
      };
      const newComment = await forumApi.createComment(payload);
      // Chèn bình luận mới lên ĐẦU danh sách kèm thông tin currentUser chuẩn
      setComments((prev) => [
        {
          ...newComment,
          authorId: currentUser.id,
          authorName: currentUser.name,
          likesCount: 0,
        },
        ...prev,
      ]);
    });
  };

  /**
   * Reply một bình luận (cấp 2).
   */
  const handleReply = (parentId: string, content: string) => {
    requireAuth(async () => {
      const payload: CommentCreate = {
        post_id: postId,
        author_id: currentUser.id,
        content,
        parent_comment_id: parentId,
      };
      const newReply = await forumApi.createComment(payload);
      setComments((prev) =>
        appendReplyInTree(prev, parentId, {
          ...newReply,
          authorId: currentUser.id,
          authorName: currentUser.name,
          likesCount: 0,
        })
      );
    });
  };

  /**
   * Toggle thích/bỏ thích một bình luận.
   */
  const handleToggleCommentLike = (commentId: string, isLiked: boolean) => {
    requireAuth(async () => {
      if (isLiked) {
        await forumApi.unlikeComment(commentId);
      } else {
        await forumApi.likeComment(commentId);
      }
      setComments((prev) => updateLikeInTree(prev, commentId));
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
