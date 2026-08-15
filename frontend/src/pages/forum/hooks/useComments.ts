/**
 * useComments — Quản lý bình luận và reply của một bài viết Forum.
 *
 * Chịu trách nhiệm:
 *   - Tải danh sách bình luận (cây 2 cấp: comment + replies, đã nhóm bởi forumApi)
 *   - Thêm bình luận mới (yêu cầu đăng nhập)
 *   - Reply cho một bình luận (yêu cầu đăng nhập) — dùng parent_comment_id
 *   - Toggle thích/bỏ thích bình luận (yêu cầu đăng nhập)
 *
 * Cách dùng:
 * ```tsx
 * const { comments, handleAddComment, handleReply, handleToggleCommentLike } =
 *   useComments(postId);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import type { Comment, CommentCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';

// ID giả cho user hiện tại
const CURRENT_USER_ID = 'user-current';
const CURRENT_USER_NAME = 'Bạn';

/** Cập nhật đệ quy trạng thái isLiked của một comment trong cây comment */
function updateLikeInTree(comments: Comment[], commentId: string): Comment[] {
  return comments.map((c) => {
    if (c.id === commentId) return { ...c, isLiked: !c.isLiked };
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
  const { requireAuth } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /** Tải danh sách bình luận khi mở bài viết */
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
   * Thêm bình luận mới (cấp 1 — comment chính).
   * Yêu cầu đăng nhập.
   */
  const handleAddComment = (content: string) => {
    requireAuth(async () => {
      const payload: CommentCreate = {
        post_id: postId,
        author_id: CURRENT_USER_ID,
        content,
        parent_comment_id: null,
      };
      const newComment = await forumApi.createComment(payload);
      // Gán tên hiển thị ngay
      setComments((prev) => [...prev, { ...newComment, authorName: CURRENT_USER_NAME }]);
    });
  };

  /**
   * Reply một bình luận (cấp 2).
   * Yêu cầu đăng nhập.
   *
   * @param parentId - id của comment đang reply
   * @param content  - nội dung reply
   */
  const handleReply = (parentId: string, content: string) => {
    requireAuth(async () => {
      const payload: CommentCreate = {
        post_id: postId,
        author_id: CURRENT_USER_ID,
        content,
        parent_comment_id: parentId,
      };
      const newReply = await forumApi.createComment(payload);
      setComments((prev) =>
        appendReplyInTree(prev, parentId, { ...newReply, authorName: CURRENT_USER_NAME })
      );
    });
  };

  /**
   * Toggle thích/bỏ thích một bình luận.
   * Yêu cầu đăng nhập.
   *
   * @param commentId  - id bình luận cần toggle
   * @param isLiked    - trạng thái hiện tại (true = đang thích)
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
