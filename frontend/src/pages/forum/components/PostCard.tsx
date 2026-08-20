import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Share2, Loader2, AlertCircle, RefreshCw, Trash2, MoreHorizontal, Edit2 } from 'lucide-react';
import type { Post, ForumPostCreate, ForumPostUpdate } from '../types/forum.types';
import { CommentSection } from './CommentSection';
import { Avatar } from '../../../components/ui/Avatar';
import { RichContentView } from '../../../components/ui/RichContentView';
import { EditPostModal } from './EditPostModal';

import { useForumState } from '../context/ForumStateContext';
import { useAuth } from '../../../hooks/useAuth';

interface PostCardProps {
  post: Post;
  onToggleLike: (postId: string) => void;
  onUpdatePost?: (postId: string, payload: ForumPostUpdate, categoryName?: string) => Promise<void> | void;
  onDeletePost?: (postId: string) => Promise<void> | void;
  onRetryPost?: (post: Post, payload: Omit<ForumPostCreate, 'author_id'>) => void;
  onDiscardPost?: (postId: string) => void;
  defaultShowComments?: boolean;
  isDetailPage?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onToggleLike,
  onUpdatePost,
  onDeletePost,
  onRetryPost,
  onDiscardPost,
  defaultShowComments = false,
  isDetailPage = false,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { setSelectedTag } = useForumState();

  const isAuthor = currentUser?.id === post.authorId;

  const [showComments, setShowComments] = useState(defaultShowComments);
  const [hoveredButton, setHoveredButton] = useState<'like' | 'comment' | 'share' | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Optimistic UI state cho Like & Comment count (0ms response)
  const [localIsLiked, setLocalIsLiked] = useState(post.isLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.commentsCount);

  useEffect(() => {
    setLocalIsLiked(post.isLiked);
    setLocalLikesCount(post.likesCount);
    setLocalCommentsCount(post.commentsCount);
  }, [post.isLiked, post.likesCount, post.commentsCount]);

  // Đóng dropdown 3 chấm khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLikeClick = () => {
    const nextLiked = !localIsLiked;
    setLocalIsLiked(nextLiked);
    setLocalLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    onToggleLike(post.id);
  };

  const handleCommentAdded = () => {
    setLocalCommentsCount((prev) => prev + 1);
  };

  const handleConfirmDelete = async () => {
    setIsMenuOpen(false);
    if (window.confirm('Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.')) {
      await onDeletePost?.(post.id);
    }
  };

  // Bóc tách ảnh và văn bản riêng để tính độ dài chữ chuẩn kiểu Facebook (không tính chuỗi Base64 ảnh)
  const imgMatches = post.content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  const cleanTextContent = post.content.replace(/<img[^>]*>/gi, '');

  const MAX_CONTENT_LENGTH = 240;
  const isContentLong = cleanTextContent.length > MAX_CONTENT_LENGTH;
  const displayContent = isContentLong
    ? cleanTextContent.slice(0, MAX_CONTENT_LENGTH) + imgMatches.join('')
    : post.content;

  const actionButtonStyle = (
    btnType: 'like' | 'comment' | 'share',
    active = false
  ): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 0',
    color: active ? '#3B82F6' : '#64748B',
    background: hoveredButton === btnType ? '#F1F5F9' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    userSelect: 'none',
    fontWeight: '600',
    fontSize: 14,
  });

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: '24px 24px 0px 24px',
        border: post.status === 'error' ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        opacity: post.status === 'sending' ? 0.85 : 1,
        transition: 'opacity 0.3s ease, border-color 0.3s ease',
        position: 'relative',
      }}
    >
      {/* Banner Optimistic UI — Trạng thái Đang đăng */}
      {post.status === 'sending' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#F0F9FF',
          color: '#0369A1',
          fontSize: 13,
          fontWeight: '600',
          padding: '8px 12px',
          borderRadius: 8,
          marginBottom: 12,
        }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Đang đăng bài viết...</span>
        </div>
      )}
      {/* Banner Optimistic UI — Trạng thái Đang cập nhật */}
      {post.status === 'updating' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#F0FDFA',
          color: '#0D9488',
          fontSize: 13,
          fontWeight: '600',
          padding: '8px 12px',
          borderRadius: 8,
          marginBottom: 12,
        }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Đang cập nhật bài viết...</span>
        </div>
      )}
      {/* Banner Optimistic UI — Trạng thái Lỗi */}
      {post.status === 'error' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FEF2F2',
          color: '#DC2626',
          fontSize: 13,
          fontWeight: '600',
          padding: '8px 12px',
          borderRadius: 8,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} />
            <span>Không thể thao tác. Kiểm tra kết nối và thử lại.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onRetryPost && (
              <button
                onClick={() => onRetryPost(post, { category_id: post.categoryId, title: post.title, content: post.content })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  background: '#DC2626', color: 'white', cursor: 'pointer',
                  fontSize: 12, fontWeight: '600',
                }}
              >
                <RefreshCw size={12} /> Thử lại
              </button>
            )}
            {onDiscardPost && (
              <button
                onClick={() => onDiscardPost(post.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5',
                  background: 'transparent', color: '#DC2626', cursor: 'pointer',
                  fontSize: 12, fontWeight: '600',
                }}
              >
                <Trash2 size={12} /> Bỏ qua
              </button>
            )}
          </div>
        </div>
      )}
      {/* Post Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name={post.authorName} size="lg" />
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#0F172A', fontSize: 15 }}>{post.authorName}</span>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>
                • {post.timeAgo}
                {post.isEdited && <span style={{ marginLeft: 4 }}>• Đã chỉnh sửa</span>}
              </span>
            </div>
            <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{post.categoryName}</div>
          </div>
        </div>

        {/* Menu 3 chấm (Chỉ hiển thị cho Tác giả bài viết) */}
        {isAuthor && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                padding: 6,
                borderRadius: '50%',
                cursor: 'pointer',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#F1F5F9')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
              title="Tùy chọn bài viết"
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Dropdown Menu Popover */}
            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  background: 'white',
                  borderRadius: 12,
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 90,
                  minWidth: 160,
                  padding: '6px 0',
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: '600',
                    color: '#1E293B',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Edit2 size={15} color="#3B82F6" />
                  <span>Chỉnh sửa bài viết</span>
                </div>

                <div
                  onClick={handleConfirmDelete}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: '600',
                    color: '#DC2626',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={15} color="#DC2626" />
                  <span>Xóa bài viết</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Title -> Links to /forum/post/:id */}
      <h2 style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', margin: '0 0 12px 0' }}>
        <Link
          to={`/forum/post/${post.id}`}
          style={{ color: '#0F172A', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#1D4ED8')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#0F172A')}
        >
          {post.title}
        </Link>
      </h2>

      {/* Post Content với RichContentView (Render KaTeX Math, Ảnh & định dạng HTML đẹp mắt) */}
      <div style={{ marginBottom: 16 }}>
        <RichContentView
          content={displayContent}
          onTagClick={(t) => setSelectedTag(t.replace(/^#/, ''))}
        />
        {isContentLong && (
          <div style={{ marginTop: 6 }}>
            <span style={{ color: '#64748B' }}>... </span>
            <span
              onClick={() => navigate(`/forum/post/${post.id}`)}
              style={{
                color: '#1D4ED8',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Xem thêm
            </span>
          </div>
        )}
      </div>

      {/* Image Attachment (nếu có) -> Click to /forum/post/:id */}
      {post.imagePath && (
        <div
          onClick={() => navigate(`/forum/post/${post.id}`)}
          style={{
            marginBottom: 16,
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'pointer',
            border: '1px solid #E2E8F0',
          }}
        >
          <img
            src={post.imagePath}
            alt={post.title}
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Actions (Thanh Facebook Action Bar tràn viền sát đáy card) */}
      <div
        style={{
          margin: '12px -24px 0px -24px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          borderBottomLeftRadius: showComments ? 0 : 16,
          borderBottomRightRadius: showComments ? 0 : 16,
          overflow: 'hidden',
        }}
      >
        {/* Nút Thích (0ms Optimistic UI) */}
        <div
          onClick={handleLikeClick}
          onMouseEnter={() => setHoveredButton('like')}
          onMouseLeave={() => setHoveredButton(null)}
          style={actionButtonStyle('like', localIsLiked)}
        >
          <ThumbsUp size={18} fill={localIsLiked ? '#3B82F6' : 'none'} />
          <span>{localLikesCount}</span>
        </div>

        {/* Nút Bình luận */}
        <div
          onClick={() => setShowComments((v) => !v)}
          onMouseEnter={() => setHoveredButton('comment')}
          onMouseLeave={() => setHoveredButton(null)}
          style={actionButtonStyle('comment', showComments)}
        >
          <MessageSquare size={18} />
          <span>{localCommentsCount} bình luận</span>
        </div>

        {/* Nút Chia sẻ */}
        <div
          onClick={() => {
            navigator.clipboard?.writeText(window.location.origin + `/forum/post/${post.id}`);
            alert('Đã copy link bài viết để chia sẻ!');
          }}
          onMouseEnter={() => setHoveredButton('share')}
          onMouseLeave={() => setHoveredButton(null)}
          style={actionButtonStyle('share')}
        >
          <Share2 size={18} />
          <span>Chia sẻ</span>
        </div>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div style={{ margin: '0 -24px', padding: 24, background: '#FAFAFA', borderTop: '1px solid #F1F5F9' }}>
          <CommentSection
            postId={post.id}
            isDetailPage={isDetailPage}
            onCommentAdded={handleCommentAdded}
          />
        </div>
      )}

      {/* Modal Chỉnh sửa Bài viết */}
      {isEditModalOpen && (
        <EditPostModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={post}
          onSave={async (payload, categoryName) => {
            await onUpdatePost?.(post.id, payload, categoryName);
          }}
        />
      )}
    </div>
  );
};
