/**
 * useForumPosts — Quản lý danh sách bài viết Forum với Infinite Scroll và 4 Bộ lọc.
 *
 * Tích hợp ForumStateContext lưu giữ bài viết và khôi phục tức thì khi Back từ trang Chi tiết.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import type { FilterOption } from '../components/ForumFilterBar';
import { useForumState } from '../context/ForumStateContext';

const PAGE_SIZE = 5;

function applyFilterAndSearch(
  posts: Post[],
  filter: FilterOption,
  search: string,
  currentUserId?: string
): Post[] {
  let result = [...posts];

  // 1. Lọc theo 4 tùy chọn Dropdown
  switch (filter) {
    case 'latest':
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'my_questions':
      if (currentUserId) {
        result = result.filter((p) => p.authorId === currentUserId || p.authorId === 'user-1');
      }
      break;
  }

  // 2. Lọc theo từ khóa tìm kiếm
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
  const { posts, setPosts, hasMore, setHasMore, skip, setSkip, selectedTag } = forumState;

  const [isLoading, setIsLoading] = useState(false);
  const isInitialMountRef = useRef(true);

  /** Tải một trang bài viết và nối vào danh sách hiện tại */
  const fetchNextPage = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const newPosts = await forumApi.getPosts(categoryId, skip, PAGE_SIZE, selectedTag);
    const processed = applyFilterAndSearch(newPosts, filter, search, currentUserId);

    setPosts((prev) => [...prev, ...processed]);
    setSkip(skip + PAGE_SIZE);

    if (newPosts.length < PAGE_SIZE) setHasMore(false);
    setIsLoading(false);
  }, [isLoading, hasMore, categoryId, search, filter, currentUserId, skip, selectedTag, setPosts, setSkip, setHasMore]);

  /** Reset và tải lại từ đầu khi đổi danh mục, bộ lọc, từ khóa hoặc hashtag */
  useEffect(() => {
    // Nếu mount lần đầu và đã có bài viết lưu trong Context (do vừa Back về) -> Giữ nguyên, không fetch lại
    if (isInitialMountRef.current && posts.length > 0) {
      isInitialMountRef.current = false;
      return;
    }

    isInitialMountRef.current = false;

    setPosts([]);
    setHasMore(true);
    setSkip(0);

    (async () => {
      setIsLoading(true);
      const firstPage = await forumApi.getPosts(categoryId, 0, PAGE_SIZE, selectedTag);
      const processed = applyFilterAndSearch(firstPage, filter, search, currentUserId);
      setPosts(processed);
      setSkip(PAGE_SIZE);
      if (firstPage.length < PAGE_SIZE) setHasMore(false);
      setIsLoading(false);
    })();
  }, [categoryId, search, filter, currentUserId, selectedTag]);

  return { posts, setPosts, isLoading, hasMore, fetchNextPage };
}
