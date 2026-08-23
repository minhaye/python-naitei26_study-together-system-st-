export interface MessageUserTriggerProps {
  /** Target user's id -- resolved to /users/:id. */
  userId: string;
  /** When true, renders `children` unwrapped with no click behavior (viewer's own
   * avatar/name) -- callers already compute this via their existing self-check. */
  isSelf?: boolean;
  children: React.ReactNode;
  /** Merged onto the wrapper link so callers can preserve their existing row layout
   * (e.g. `flex: 1`, `gap`). */
  style?: React.CSSProperties;
}

/** Wraps any avatar/name element so clicking it opens that user's profile page
 * (/users/:id) in a new browser tab -- the canonical "click a user" behavior used
 * everywhere another user's identity is rendered (group member rows, forum post/comment
 * authors, chat participants, moderation tables). Messaging, reporting, and (for
 * moderators) restricting the user live on the profile page itself. */
export function MessageUserTrigger({ userId, isSelf = false, children, style }: MessageUserTriggerProps) {
  if (isSelf) {
    return <>{children}</>;
  }

  // A plain <a target="_blank"> rather than react-router's <Link> -- opening a new tab is
  // always a full browser navigation anyway (no client-side route change to intercept), and
  // this avoids requiring a Router context wherever this component is rendered/tested.
  return (
    <a
      href={`/users/${userId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit', ...style }}
    >
      {children}
    </a>
  );
}
