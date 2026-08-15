import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Base Skeleton Primitive Component — Khung xương tĩnh chạy hiệu ứng shimmer.
 * Độc lập 100%, không phụ thuộc file khác.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
  className = '',
}) => {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        display: 'inline-block',
        ...style,
      }}
    />
  );
};

// ─── COMPOSITE PRESET SKELETONS ─────────────────────────────────────────────

/** PostSkeleton — Mô phỏng 100% layout của PostCard */
export const PostSkeleton: React.FC = () => {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={140} height={14} />
          <Skeleton width={90} height={12} />
        </div>
      </div>

      {/* Title & Content */}
      <Skeleton width="75%" height={22} borderRadius={6} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="100%" height={14} />
        <Skeleton width="92%" height={14} />
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton width={70} height={24} borderRadius={6} />
        <Skeleton width={85} height={24} borderRadius={6} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <Skeleton width={50} height={16} />
          <Skeleton width={90} height={16} />
        </div>
        <Skeleton width={60} height={16} />
      </div>
    </div>
  );
};

/** CommentSkeleton — Mô phỏng layout của CommentItem */
export const CommentSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="60%" height={36} borderRadius={12} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton width={50} height={10} />
          <Skeleton width={40} height={10} />
        </div>
      </div>
    </div>
  );
};

/** LikedPostSkeleton — Mô phỏng layout của bài viết đã thích trong right sidebar */
export const LikedPostSkeleton: React.FC = () => {
  return (
    <div style={{ alignSelf: 'stretch', gap: 12, display: 'flex', alignItems: 'center' }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width={80} height={12} />
        <Skeleton width="90%" height={14} />
        <Skeleton width={100} height={10} />
      </div>
      <Skeleton width={48} height={48} borderRadius={6} />
    </div>
  );
};

/** CategorySkeleton — Mô phỏng layout của danh mục trong left sidebar */
export const CategorySkeleton: React.FC = () => {
  return (
    <div style={{ padding: '8px 16px' }}>
      <Skeleton width="80%" height={16} borderRadius={6} />
    </div>
  );
};
