/**
 * ForumStateContext — Lưu giữ toàn bộ state và vị trí cuộn cuộn màn hình (scrollTop) của ForumPage.
 *
 * Giúp giữ nguyên trạng thái (selectedCategoryId, selectedFilter, search, posts, scrollTop)
 * khi người dùng nhấp xem chi tiết bài viết (ForumPostDetail) và bấm Quay lại (Back).
 */

import React, { createContext, useContext, useState } from 'react';
import type { Post } from '../types/forum.types';
import type { FilterOption } from '../components/ForumFilterBar';

interface ForumState {
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  selectedCategoryName: string | null;
  setSelectedCategoryName: (name: string | null) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedFilter: FilterOption;
  setSelectedFilter: (filter: FilterOption) => void;
  search: string;
  setSearch: (search: string) => void;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  updatePostInState: (updatedPost: Post) => void;
  deletePostInState: (postId: string) => void;
  hasMore: boolean;
  setHasMore: (hasMore: boolean) => void;
  skip: number;
  setSkip: (skip: number) => void;
  scrollTop: number;
  setScrollTop: (pos: number) => void;
}

const ForumStateContext = createContext<ForumState | undefined>(undefined);

export const ForumStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('latest');
  const [search, setSearch] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const updatePostInState = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p)));
  };

  const deletePostInState = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <ForumStateContext.Provider
      value={{
        selectedCategoryId,
        setSelectedCategoryId,
        selectedCategoryName,
        setSelectedCategoryName,
        selectedTag,
        setSelectedTag,
        selectedFilter,
        setSelectedFilter,
        search,
        setSearch,
        posts,
        setPosts,
        updatePostInState,
        deletePostInState,
        hasMore,
        setHasMore,
        skip,
        setSkip,
        scrollTop,
        setScrollTop,
      }}
    >
      {children}
    </ForumStateContext.Provider>
  );
};

export const useForumState = () => {
  const context = useContext(ForumStateContext);
  if (!context) {
    throw new Error('useForumState must be used within a ForumStateProvider');
  }
  return context;
};
