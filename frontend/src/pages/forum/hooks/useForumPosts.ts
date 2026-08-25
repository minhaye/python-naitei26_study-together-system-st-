/**
 * useForumPosts — Quản lý danh sách bài viết Forum theo trang (phân trang số, không còn
 * cuộn vô hạn) với 4 Bộ lọc.
 *
 * Tích hợp ForumStateContext giữ nguyên trang hiện tại và khôi phục tức thì khi Back từ
 * trang Chi tiết.
 */

import { useEffect, useRef, useState } from 'react';
import type { Post } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { forumCache } from '../lib/forumCache';
import type { FilterOption } from '../components/ForumFilterBar';
import { useForumState } from '../context/ForumStateContext';

export const PAGE_SIZE = 10;

function applyFilterAndSearch(
  posts: Post[],
  filter: FilterOption,
  search: string,
  currentUserId?: string
): Post[] {
  let result = posts;

  // my_questions đã được lọc ở backend qua author_id -- giữ lại lượt lọc này để an toàn
  // nếu backend trả thừa (vd. chưa đăng nhập).
  if (filter === 'my_questions' && currentUserId) {
    result = result.filter((p) => p.authorId === currentUserId);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    );
  }

  return result;
}

export function useForumPosts(
  categoryId: string | null,
  search: string,
  filter: FilterOption = 'latest',
  currentUserId?: string
) {
  const forumState = useForumState();
  const { posts, setPosts, page, setPage, total, setTotal, selectedTag } = forumState;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevFilterKeyRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const filterKey = `${categoryId ?? ''}|${search}|${filter}|${selectedTag ?? ''}`;
    const filterChanged = prevFilterKeyRef.current !== null && prevFilterKeyRef.current !== filterKey;
    prevFilterKeyRef.current = filterKey;

    // Đổi danh mục/bộ lọc/từ khóa/hashtag -> quay về trang 1 trước, hiệu ứng này sẽ chạy lại
    // ngay khi page cập nhật (tránh gọi API 2 lần liên tiếp).
    if (filterChanged && page !== 1) {
      setPage(1);
      return;
    }

    // Nếu mount lần đầu và đã có bài viết lưu trong Context (do vừa Back về) -> Giữ nguyên
    if (isInitialMountRef.current && posts.length > 0) {
      isInitialMountRef.current = false;
      return;
    }
    isInitialMountRef.current = false;

    const isLandingPage = !categoryId && !search && filter === 'latest' && !selectedTag && page === 1;
    let cancelled = false;

    (async () => {
      if (isLandingPage) {
        const cached = forumCache.get();
        if (cached && cached.length > 0) setPosts(cached);
      }

      setIsLoading(true);
      setError(null);

      try {
        const authorIdParam = filter === 'my_questions' ? currentUserId : undefined;
        const { posts: fetched, total: fetchedTotal } = await forumApi.getPosts(
          categoryId,
          (page - 1) * PAGE_SIZE,
          PAGE_SIZE,
          selectedTag,
          authorIdParam
        );
        if (cancelled) return;

        const processed = applyFilterAndSearch(fetched, filter, search, currentUserId);
        setPosts(processed);
        setTotal(fetchedTotal);

        if (isLandingPage) forumCache.set(processed);
      } catch (err) {
        if (!cancelled) {
          console.error('Lỗi khi tải bài viết diễn đàn:', err);
          setError('Không thể tải bài viết diễn đàn.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, search, filter, selectedTag, page]);

  return { posts, setPosts, isLoading, error, page, setPage, totalPages, total };
}
