import { useEffect, useState } from 'react';
import { getMessageAttachmentUrl } from '../../lib/attachment.api';

interface MessageAttachmentImageProps {
  messageId: string;
}

/** Renders a persisted message's image attachment as a contained thumbnail, opening a
 * simple full-screen lightbox on click. Shared by Channel chat (StudyGroupDetail.tsx) and
 * Study Room chat (StudyRoom.tsx) -- both call the same `GET /messages/{id}/attachment-url`
 * endpoint, which re-runs the same `can_access_conversation` authorization as every other
 * message read, so a caller who cannot access the message never gets a usable image URL.
 *
 * The signed URL is fetched fresh per mount (not stored durably) -- attachment metadata
 * (attachment_path) is the persisted, durable part of a Message; the signed URL itself is
 * short-lived by design (settings.attachment_download_url_expires_in) and must never be
 * cached as if it were permanent. */
export function MessageAttachmentImage({ messageId }: MessageAttachmentImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    getMessageAttachmentUrl(messageId)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  if (failed) {
    return <div style={{ fontSize: 12.5, color: '#94A3B8', fontStyle: 'italic' }}>Không thể tải ảnh.</div>;
  }

  if (!url) {
    return (
      <div
        aria-label="Đang tải ảnh"
        style={{ width: 160, height: 120, borderRadius: 10, background: 'rgba(148, 163, 184, 0.25)' }}
      />
    );
  }

  return (
    <>
      <img
        src={url}
        alt="Hình ảnh đính kèm"
        onClick={() => setIsOpen(true)}
        style={{
          maxWidth: 280,
          maxHeight: 280,
          borderRadius: 10,
          cursor: 'zoom-in',
          display: 'block',
          objectFit: 'contain',
        }}
      />
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
            padding: 24,
          }}
        >
          <img
            src={url}
            alt="Hình ảnh đính kèm"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      )}
    </>
  );
}
