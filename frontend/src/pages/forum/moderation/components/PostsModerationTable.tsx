import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { forumApi } from '../../../forum/lib/forum.api';
import type { Post } from '../../../forum/types/forum.types';
import { ReasonPromptModal } from '../../../../components/ui/ReasonPromptModal';
import { ApiError } from '../../../../lib/apiClient';
import { MessageUserTrigger } from '../../../../components/messages/MessageUserTrigger';
import { Pagination } from '../../../../components/ui/Pagination';

const PAGE_SIZE = 10;

export const PostsModerationTable: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = () => {
    setIsLoading(true);
    forumApi
      .getPosts(null, (page - 1) * PAGE_SIZE, PAGE_SIZE)
      .then((res) => {
        setPosts(res.posts);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách bài viết.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0F172A' }}>Bài viết gần đây ({total})</h3>

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
              <div style={{ minWidth: 0 }}>
                <a
                  href={`/forum/post/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Mở bài viết ở tab mới để xem thêm thông tin"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {post.title}
                  </div>
                </a>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  <MessageUserTrigger userId={post.authorId} style={{ display: 'inline' }}>
                    {post.authorName}
                  </MessageUserTrigger>{' '}
                  • {post.categoryName} • {post.timeAgo}
                </div>
              </div>
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
            load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Không thể xóa bài viết.');
          }
        }}
      />
    </div>
  );
};
