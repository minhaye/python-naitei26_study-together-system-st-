import React, { useState } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  shape?: 'square' | 'round';
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<
  NonNullable<ButtonProps['variant']>,
  { base: React.CSSProperties; hover: React.CSSProperties }
> = {
  primary: {
    base: { background: '#00236F', color: 'white', border: 'none' },
    hover: { background: '#003399' },
  },
  secondary: {
    base: { background: '#EFF6FF', color: '#1D4ED8', border: 'none' },
    hover: { background: '#DBEAFE' },
  },
  outline: {
    base: { background: 'transparent', color: '#475569', border: '1px solid #CBD5E1' },
    hover: { background: '#F8FAFC' },
  },
  ghost: {
    base: { background: 'transparent', color: '#64748B', border: 'none' },
    hover: { background: '#F1F5F9' },
  },
  danger: {
    base: { background: '#EF4444', color: 'white', border: 'none' },
    hover: { background: '#DC2626' },
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  shape = 'square',
  children,
  style,
  disabled,
  ...props
}) => {
  // Hover state inline — không import từ file khác để giữ independence
  const [isHovered, setIsHovered] = useState(false);
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <button
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      style={{
        padding: shape === 'round' ? '8px 24px' : '8px 16px',
        borderRadius: shape === 'round' ? '24px' : '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1,
        ...variantStyle.base,
        ...(isHovered && !disabled ? variantStyle.hover : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};
