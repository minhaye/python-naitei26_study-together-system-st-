export interface CountBadgeProps {
  count: number;
  style?: React.CSSProperties;
}

/** Small red overlaid count circle -- extracted from PendingInvitationsBell.tsx's inline
 * badge (position: absolute, top:-4/right:-4, 16x16 circle, '9+' cap above 9). Renders
 * nothing when count <= 0. */
export function CountBadge({ count, style }: CountBadgeProps) {
  if (count <= 0) return null;
  const isMultiDigit = count > 9;
  return (
    <div
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        padding: isMultiDigit ? '0 4px' : 0,
        borderRadius: 10,
        background: '#EF4444',
        color: 'white',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {isMultiDigit ? '9+' : count}
    </div>
  );
}
