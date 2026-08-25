import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Reusable "Trang X / Y" control: Prev/Next buttons plus a jump-to-page input.
 * Renders nothing when there's only one page. */
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange }) => {
  const [inputValue, setInputValue] = useState(String(page));

  useEffect(() => {
    setInputValue(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  const commitInput = () => {
    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed)) {
      setInputValue(String(page));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setInputValue(String(clamped));
    if (clamped !== page) onPageChange(clamped);
  };

  const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    background: 'white',
    color: disabled ? '#CBD5E1' : '#334155',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 0 4px' }}>
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={navButtonStyle(page <= 1)}>
        <ChevronLeft size={14} /> Trước
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
        Trang
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ width: 48, textAlign: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
        />
        / {totalPages}
      </div>

      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={navButtonStyle(page >= totalPages)}>
        Sau <ChevronRight size={14} />
      </button>
    </div>
  );
};
