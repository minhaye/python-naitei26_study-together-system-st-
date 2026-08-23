import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import * as notificationApi from '../lib/notification.api';
import type {
  NotificationCategory,
  NotificationItem,
  UnreadCounts,
} from '../types/notification';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCounts: UnreadCounts;
  isLoading: boolean;
  activeCategory: NotificationCategory;
  setActiveCategory: (category: NotificationCategory) => void;
  fetchNotifications: (category?: NotificationCategory) => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  markAsRead: (notificationId: string, category: NotificationCategory) => Promise<void>;
  markAllAsRead: (category?: NotificationCategory) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const DEFAULT_UNREAD: UnreadCounts = {
  total: 0,
  forum: 0,
  group: 0,
  goal: 0,
  message: 0,
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>(DEFAULT_UNREAD);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('forum');

  const fetchUnreadCounts = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const counts = await notificationApi.getUnreadCounts();
      setUnreadCounts(counts);
    } catch (err) {
      console.warn('[NotificationContext] Failed to fetch unread counts', err);
    }
  }, [isLoggedIn]);

  const fetchNotifications = useCallback(
    async (category?: NotificationCategory) => {
      if (!isLoggedIn) return;
      setIsLoading(true);
      try {
        const items = await notificationApi.listNotifications({ category });
        setNotifications(items);
      } catch (err) {
        console.warn('[NotificationContext] Failed to list notifications', err);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoggedIn]
  );

  // Initial load when logged in
  useEffect(() => {
    if (isLoggedIn) {
      fetchUnreadCounts();
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCounts(DEFAULT_UNREAD);
    }
  }, [isLoggedIn, fetchUnreadCounts, fetchNotifications]);

  // Realtime subscription via Supabase with detailed debugging logs
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.id) {
      console.warn('[RealtimeNoti] ⚠️ Skipped subscription: User is not logged in or missing ID.');
      return;
    }

    if (currentUser.id === 'user-current') {
      console.warn('[RealtimeNoti] ⚠️ Skipped subscription: User ID is mock "user-current".');
      return;
    }

    const userId = currentUser.id;
    console.log(`[RealtimeNoti] 🔄 Initializing Realtime Channel for user: ${userId}`);

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[RealtimeNoti] 🔔 NEW INSERT PAYLOAD RECEIVED FROM POSTGRES:', payload);
          try {
            const list = await notificationApi.listNotifications({ limit: 1 });
            if (list.length > 0) {
              const newItem = list[0];
              console.log('[RealtimeNoti] 📦 Fetched latest notification item:', newItem);
              setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)]);
              const cat = newItem.category || 'forum';
              setUnreadCounts((prev) => ({
                ...prev,
                total: prev.total + 1,
                [cat]: (prev[cat] || 0) + 1,
              }));
            }
          } catch (err) {
            console.error('[RealtimeNoti] ❌ Failed to fetch latest notification on realtime trigger:', err);
            setUnreadCounts((prev) => ({ ...prev, total: prev.total + 1 }));
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[RealtimeNoti] 📡 Subscription status: ${status}`);
        if (err) {
          console.error('[RealtimeNoti] ❌ Subscription error:', err);
        }
      });

    return () => {
      console.log(`[RealtimeNoti] 🔌 Cleaning up Realtime channel for user: ${userId}`);
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, currentUser?.id]);

  // Optimistic Mark Single Item Read
  const markAsRead = useCallback(
    async (notificationId: string, category: NotificationCategory) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCounts((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        [category]: Math.max(0, (prev[category] || 0) - 1),
      }));

      try {
        await notificationApi.markAsRead(notificationId);
      } catch (err) {
        console.warn('[NotificationContext] Failed to mark read on server', err);
      }
    },
    []
  );

  // Optimistic Mark All Read
  const markAllAsRead = useCallback(
    async (category?: NotificationCategory) => {
      if (!category) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCounts({ total: 0, forum: 0, group: 0, goal: 0, message: 0 });
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.category === category ? { ...n, is_read: true } : n))
        );
        setUnreadCounts((prev) => {
          const catCount = prev[category] || 0;
          return {
            ...prev,
            total: Math.max(0, prev.total - catCount),
            [category]: 0,
          };
        });
      }

      try {
        await notificationApi.markAllAsRead(category);
      } catch (err) {
        console.warn('[NotificationContext] Failed to mark all read on server', err);
      }
    },
    []
  );

  // Delete Notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === notificationId);
        if (target && !target.is_read) {
          const cat = target.category || 'forum';
          setUnreadCounts((counts) => ({
            ...counts,
            total: Math.max(0, counts.total - 1),
            [cat]: Math.max(0, (counts[cat] || 0) - 1),
          }));
        }
        return prev.filter((n) => n.id !== notificationId);
      });

      try {
        await notificationApi.deleteNotification(notificationId);
      } catch (err) {
        console.warn('[NotificationContext] Failed to delete notification on server', err);
      }
    },
    []
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCounts,
        isLoading,
        activeCategory,
        setActiveCategory,
        fetchNotifications,
        fetchUnreadCounts,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
