/**
 * useForumPosts — Quản lý danh sách bài viết Forum với Infinite Scroll.
 *
 * - Lấy bài viết theo danh mục và từ khóa tìm kiếm
 * - Dùng skip/limit (BE) kết hợp IntersectionObserver (FE) để cuộn vô hạn
 * - Reset về trang 1 khi đổi danh mục
 *
 * Cách dùng:
 * ```tsx
 * const { posts, isLoading, hasMore, fetchNextPage, setPosts } = useForumPosts(categoryId, search);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';

const PAGE_SIZE = 5;

export function useForumPosts(categoryId: string | null, search: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);

  /** Tải một trang bài viết và nối vào danh sách hiện tại */
  const fetchNextPage = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const newPosts = await forumApi.getPosts(categoryId, skipRef.current, PAGE_SIZE);

    // Lọc theo từ khóa tìm kiếm phía client (mock only; khi nối BE thật thì truyền search lên query)
    const filtered = search
      ? newPosts.filter(
          (p) =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.content.toLowerCase().includes(search.toLowerCase())
        )
      : newPosts;

    setPosts((prev) => [...prev, ...filtered]);
    skipRef.current += PAGE_SIZE;

    if (newPosts.length < PAGE_SIZE) setHasMore(false);
    setIsLoading(false);
  }, [isLoading, hasMore, categoryId, search]);

  /** Reset và tải lại từ đầu khi đổi danh mục hoặc từ khóa */
  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    skipRef.current = 0;

    // Tải trang đầu tiên
    (async () => {
      setIsLoading(true);
      const firstPage = await forumApi.getPosts(categoryId, 0, PAGE_SIZE);
      const filtered = search
        ? firstPage.filter(
            (p) =>
              p.title.toLowerCase().includes(search.toLowerCase()) ||
              p.content.toLowerCase().includes(search.toLowerCase())
          )
        : firstPage;
      setPosts(filtered);
      skipRef.current = PAGE_SIZE;
      if (firstPage.length < PAGE_SIZE) setHasMore(false);
      setIsLoading(false);
    })();
  }, [categoryId, search]);

  return { posts, setPosts, isLoading, hasMore, fetchNextPage };
}
