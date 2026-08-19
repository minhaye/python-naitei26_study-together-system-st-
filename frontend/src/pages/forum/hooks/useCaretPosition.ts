import { useState, useCallback } from 'react';

export interface CaretPosition {
  top: number;
  left: number;
}

/**
 * useCaretPosition — Custom hook tính toán tọa độ điểm con trỏ soạn thảo (Caret position).
 * Giúp hiển thị Autocomplete popover (Hashtag, Mention) nổi ngay bên dưới dòng chữ đang gõ.
 */
export function useCaretPosition() {
  const [position, setPosition] = useState<CaretPosition>({ top: 0, left: 0 });

  const updateCaretPosition = useCallback((containerElement: HTMLElement | null) => {
    if (typeof window === 'undefined') return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (containerElement) {
        const containerRect = containerElement.getBoundingClientRect();
        const relativeTop = rect.bottom - containerRect.top + 6; // Ngay bên dưới dòng chữ + 6px
        const rawLeft = rect.left - containerRect.left;

        // Giới hạn left để popup không bị tràn lề phải của container (width popup = 280px)
        const maxLeft = Math.max(8, containerRect.width - 290);
        const clampedLeft = Math.max(8, Math.min(rawLeft, maxLeft));

        setPosition({
          top: Math.max(0, relativeTop),
          left: clampedLeft,
        });
      }
    } catch {
      // Fallback nếu không lấy được range tọa độ
    }
  }, []);

  return { position, updateCaretPosition };
}
