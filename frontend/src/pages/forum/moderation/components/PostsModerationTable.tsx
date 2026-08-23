import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { forumApi } from '../../../forum/lib/forum.api';
import type { Post } from '../../../forum/types/forum.types';
import { ReasonPromptModal } from '../../../../components/ui/ReasonPromptModal';
import { ApiError } from '../../../../lib/apiClient';

export const PostsModerationTable: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const load = () => {
    setIsLoading(true);
    forumApi
      .getPosts(null, 0, 50)
      .then(setPosts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách bài viết.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0F172A' }}>Bài viết gần đây ({posts.length})</h3>

      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: '#64748B', fontSize: 13.5 }}>Đang tải...</div>
      ) : posts.length === 0 ? (
        <div style={{ color: '#94A3B8', fontSize: 13.5 }}>Không có bài viết nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {posts.map((post) => (
            <div
              key={post.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}
            >
              <a
                href={`/forum/post/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Mở bài viết ở tab mới để xem thêm thông tin"
                style={{ minWidth: 0, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {post.title}
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {post.authorName} • {post.categoryName} • {post.timeAgo}
                </div>
              </a>
              <button
                onClick={() => setDeleteTarget(post)}
                title="Xóa bài viết"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
              >
                <Trash2 size={13} /> Xóa
              </button>
            </div>
          ))}
        </div>
      )}

      <ReasonPromptModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Xóa bài viết vi phạm"
        description={deleteTarget ? `Bài viết "${deleteTarget.title}" sẽ bị gỡ khỏi diễn đàn.` : undefined}
        confirmLabel="Xóa bài viết"
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await forumApi.deletePost(deleteTarget.id, reason || undefined);
            setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Không thể xóa bài viết.');
          }
        }}
      />
    </div>
  );
};
