import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectedImagePreview } from './SelectedImagePreview';

describe('SelectedImagePreview', () => {
  it('renders the preview image and calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<SelectedImagePreview previewUrl="blob:mock-preview" onRemove={onRemove} />);

    expect(screen.getByRole('img', { name: /ảnh sẽ được gửi/i })).toHaveAttribute('src', 'blob:mock-preview');

    fireEvent.click(screen.getByRole('button', { name: /bỏ chọn ảnh/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables the remove button while sending', () => {
    const onRemove = vi.fn();
    render(<SelectedImagePreview previewUrl="blob:mock-preview" onRemove={onRemove} disabled />);

    const button = screen.getByRole('button', { name: /bỏ chọn ảnh/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
