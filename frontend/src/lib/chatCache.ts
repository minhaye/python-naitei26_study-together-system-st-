import type { Message } from './message.types';

const CACHE_PREFIX = 'chat_messages_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

interface CacheData {
  timestamp: number;
  messages: Message[];
}

export const chatCache = {
  /** 
   * Lấy tin nhắn từ LocalStorage nếu chưa hết hạn
   */
  get: (conversationId: string): Message[] | null => {
    try {
      const key = `${CACHE_PREFIX}${conversationId}`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as CacheData;
      
      // Kiểm tra hạn sử dụng (TTL)
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsed.messages;
    } catch (e) {
      console.error('Failed to read chat cache', e);
      return null;
    }
  },
  
  /** 
   * Lưu tin nhắn vào LocalStorage kèm timestamp 
   */
  set: (conversationId: string, messages: Message[]) => {
    try {
      const key = `${CACHE_PREFIX}${conversationId}`;
      const data: CacheData = {
        timestamp: Date.now(),
        messages
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to write chat cache', e);
    }
  }
};
