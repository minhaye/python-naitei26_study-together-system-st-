import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getMessageAttachmentUrl } from '../../lib/attachment.api';
import { MessageAttachmentImage } from './MessageAttachmentImage';

vi.mock('../../lib/attachment.api', () => ({
  getMessageAttachmentUrl: vi.fn(),
}));

const mockedGetUrl = vi.mocked(getMessageAttachmentUrl);

beforeEach(() => {
  mockedGetUrl.mockReset();
});

describe('MessageAttachmentImage', () => {
  it('fetches a signed URL for the message and renders the image', async () => {
    mockedGetUrl.mockResolvedValue({ url: 'https://signed/photo.png', expires_in: 300 });

    render(<MessageAttachmentImage messageId="msg-1" />);

    await waitFor(() => expect(screen.getByRole('img', { name: /hình ảnh đính kèm/i })).toBeInTheDocument());
    expect(mockedGetUrl).toHaveBeenCalledWith('msg-1');
    expect(screen.getByRole('img', { name: /hình ảnh đính kèm/i })).toHaveAttribute('src', 'https://signed/photo.png');
  });

  it('shows a fallback message when the signed URL request fails (e.g. access revoked)', async () => {
    mockedGetUrl.mockRejectedValue(new Error('403'));

    render(<MessageAttachmentImage messageId="msg-2" />);

    await waitFor(() => expect(screen.getByText(/không thể tải ảnh/i)).toBeInTheDocument());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('opens a lightbox with the full-size image on click, and closes it on click again', async () => {
    mockedGetUrl.mockResolvedValue({ url: 'https://signed/photo.png', expires_in: 300 });

    render(<MessageAttachmentImage messageId="msg-1" />);
    const thumbnail = await screen.findByRole('img', { name: /hình ảnh đính kèm/i });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(thumbnail);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Two <img> now: the thumbnail plus the lightbox's full-size image.
    expect(screen.getAllByRole('img', { name: /hình ảnh đính kèm/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('re-fetches a fresh signed URL when the messageId changes', async () => {
    mockedGetUrl.mockResolvedValueOnce({ url: 'https://signed/first.png', expires_in: 300 });
    const { rerender } = render(<MessageAttachmentImage messageId="msg-1" />);
    await waitFor(() => expect(mockedGetUrl).toHaveBeenCalledWith('msg-1'));

    mockedGetUrl.mockResolvedValueOnce({ url: 'https://signed/second.png', expires_in: 300 });
    rerender(<MessageAttachmentImage messageId="msg-2" />);

    await waitFor(() => expect(mockedGetUrl).toHaveBeenCalledWith('msg-2'));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /hình ảnh đính kèm/i })).toHaveAttribute('src', 'https://signed/second.png')
    );
  });
});
