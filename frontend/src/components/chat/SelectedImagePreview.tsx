import { X } from 'lucide-react';

interface SelectedImagePreviewProps {
  previewUrl: string;
  onRemove: () => void;
  disabled?: boolean;
}

/** Local (not-yet-sent) image preview chip shown above the composer input, with a remove
 * button -- shared by Channel chat and Study Room chat composers. `previewUrl` is a
 * `URL.createObjectURL` blob URL owned by the caller (useMessageImageAttachment); this
 * component never creates or revokes it. */
export function SelectedImagePreview({ previewUrl, onRemove, disabled }: SelectedImagePreviewProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
      <img
        src={previewUrl}
        alt="Ảnh sẽ được gửi"
        style={{ maxHeight: 96, maxWidth: 160, borderRadius: 8, objectFit: 'cover', display: 'block' }}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Bỏ chọn ảnh"
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#0F172A',
          color: 'white',
          border: '2px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
