import React, { useState } from 'react';
import { Search } from 'lucide-react';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerStyle?: React.CSSProperties;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  containerStyle,
  style,
  placeholder = 'Tìm kiếm...',
  ...props
}) => {
  // Hover state inline — không import từ file khác để giữ independence
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', ...containerStyle }}>
      <Search
        size={16}
        color="#94A3B8"
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      />
      <input
        type="text"
        placeholder={placeholder}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          padding: '10px 12px 10px 36px',
          background: '#F1F5F9',
          border: isHovered ? '1px solid #94A3B8' : '1px solid #E2E8F0',
          borderRadius: 8,
          outline: 'none',
          fontSize: 14,
          color: '#334155',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
          ...style,
        }}
        {...props}
      />
    </div>
  );
};
