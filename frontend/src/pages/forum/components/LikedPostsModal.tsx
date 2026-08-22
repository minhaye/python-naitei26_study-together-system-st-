import React from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import type { Post } from '../types/forum.types';
import { totalReactionCount } from '../constants/reactions';

interface LikedPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
}

export const LikedPostsModal: React.FC<LikedPostsModalProps> = ({ isOpen, onClose, posts }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500,
          maxHeight: '80vh',
          background: 'white',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Bài viết đã bày tỏ cảm xúc</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748B', padding: '32px 0' }}>
              Bạn chưa bày tỏ cảm xúc với bài viết nào.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} style={{ display: 'flex', gap: 12 }}>
                <Avatar name={post.authorName} src={post.authorAvatarUrl} size="sm" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                    <span style={{ color: '#0F172A', fontWeight: '500' }}>{post.authorName}</span>
                    <span>•</span>
                    <span>{post.timeAgo}</span>
                  </div>
                  <Link
                    to={`/forum/post/${post.id}`}
                    onClick={onClose}
                    style={{
                      color: '#0F172A',
                      fontSize: 15,
                      fontWeight: '600',
                      textDecoration: 'none',
                      lineHeight: 1.4,
                      transition: 'color 0.2s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#1D4ED8')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#0F172A')}
                  >
                    {post.title}
                  </Link>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B', paddingTop: 4 }}>
                    <span>{totalReactionCount(post.reactions)} cảm xúc</span>
                    <span>{post.commentsCount} bình luận</span>
                  </div>
                </div>
                {post.imagePath && (
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 8,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <img src={post.imagePath} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
