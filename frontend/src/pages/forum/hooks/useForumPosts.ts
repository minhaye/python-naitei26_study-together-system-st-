/**
 * useForumPosts — Quản lý danh sách bài viết Forum với Infinite Scroll và 4 Bộ lọc.
 *
 * Bộ lọc:
 *   - latest: Mới nhất (xếp theo thời gian)
 *   - unanswered: Chưa trả lời (commentsCount === 0)
 *   - popular: Câu hỏi hay (likesCount >= 5 hoặc tương tác cao)
 *   - my_questions: Câu hỏi của tôi (authorId === currentUserId)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Post } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import type { FilterOption } from '../components/ForumFilterBar';

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
    case 'unanswered':
      result = result.filter((p) => p.commentsCount === 0);
      break;
    case 'popular':
      result = result.filter((p) => p.likesCount >= 5 || p.commentsCount >= 3);
      result.sort((a, b) => b.likesCount + b.commentsCount - (a.likesCount + a.commentsCount));
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);

  /** Tải một trang bài viết và nối vào danh sách hiện tại */
  const fetchNextPage = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const newPosts = await forumApi.getPosts(categoryId, skipRef.current, PAGE_SIZE);
    const processed = applyFilterAndSearch(newPosts, filter, search, currentUserId);

    setPosts((prev) => [...prev, ...processed]);
    skipRef.current += PAGE_SIZE;

    if (newPosts.length < PAGE_SIZE) setHasMore(false);
    setIsLoading(false);
  }, [isLoading, hasMore, categoryId, search, filter, currentUserId]);

  /** Reset và tải lại từ đầu khi đổi danh mục, bộ lọc hoặc từ khóa */
  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    skipRef.current = 0;

    (async () => {
      setIsLoading(true);
      const firstPage = await forumApi.getPosts(categoryId, 0, PAGE_SIZE);
      const processed = applyFilterAndSearch(firstPage, filter, search, currentUserId);
      setPosts(processed);
      skipRef.current = PAGE_SIZE;
      if (firstPage.length < PAGE_SIZE) setHasMore(false);
      setIsLoading(false);
    })();
  }, [categoryId, search, filter, currentUserId]);

  return { posts, setPosts, isLoading, hasMore, fetchNextPage };
}
