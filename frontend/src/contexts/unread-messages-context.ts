import { createContext, useContext } from 'react';

export interface UnreadMessagesContextValue {
  totalUnread: number;
  getUnread: (conversationId: string) => number;
  markAsRead: (conversationId: string) => void;
  refresh: () => void;
}

export const UnreadMessagesContext = createContext<UnreadMessagesContextValue | undefined>(undefined);

export function useUnreadMessages(): UnreadMessagesContextValue {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider');
  }
  return ctx;
}
