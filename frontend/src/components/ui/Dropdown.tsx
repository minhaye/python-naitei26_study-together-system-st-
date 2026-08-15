import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({ options, value, onChange, icon }) => {
  // Hover state inline — không import từ file khác để giữ independence
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        background: isHovered ? '#F8FAFC' : 'white',
        border: '1px solid #CBD5E1',
        borderRadius: 8,
        padding: '6px 12px',
        gap: 8,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
    >
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 14,
          fontWeight: '500',
          color: '#334155',
          cursor: 'pointer',
          paddingRight: 20,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        color="#64748B"
        style={{ position: 'absolute', right: 8, pointerEvents: 'none' }}
      />
    </div>
  );
};
