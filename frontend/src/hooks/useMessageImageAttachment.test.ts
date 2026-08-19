import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ApiError } from '../lib/apiClient';
import { createMessageAttachmentUploadUrl, uploadMessageAttachmentFile } from '../lib/attachment.api';
import { useMessageImageAttachment, MAX_IMAGE_SIZE_BYTES } from './useMessageImageAttachment';

vi.mock('../lib/attachment.api', () => ({
  createMessageAttachmentUploadUrl: vi.fn(),
  uploadMessageAttachmentFile: vi.fn(),
}));

const mockedCreateUploadUrl = vi.mocked(createMessageAttachmentUploadUrl);
const mockedUploadFile = vi.mocked(uploadMessageAttachmentFile);

function makeImageFile(name = 'photo.png', type = 'image/png', size = 1024): File {
  const file = new File(['x'.repeat(Math.min(size, 10))], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('useMessageImageAttachment', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockedCreateUploadUrl.mockReset();
    mockedUploadFile.mockReset();
    if (!URL.createObjectURL) (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => '';
    if (!URL.revokeObjectURL) (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('starts with no selected image', () => {
    const { result } = renderHook(() => useMessageImageAttachment());
    expect(result.current.hasImage).toBe(false);
    expect(result.current.previewUrl).toBeNull();
  });

  it('selects a valid image and creates a preview object URL', () => {
    const { result } = renderHook(() => useMessageImageAttachment());
    const file = makeImageFile();

    act(() => {
      result.current.selectImage(file);
    });

    expect(result.current.hasImage).toBe(true);
    expect(result.current.file).toBe(file);
    expect(result.current.previewUrl).toBe('blob:mock-preview-url');
    expect(result.current.pickError).toBeNull();
    expect(createObjectURLSpy).toHaveBeenCalledWith(file);
  });

  it('rejects an unsupported content type without selecting the file', () => {
    const { result } = renderHook(() => useMessageImageAttachment());
    const file = makeImageFile('doc.pdf', 'application/pdf');

    act(() => {
      result.current.selectImage(file);
    });

    expect(result.current.hasImage).toBe(false);
    expect(result.current.previewUrl).toBeNull();
    expect(result.current.pickError).toMatch(/JPEG|PNG|WebP/);
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('rejects an oversized image without selecting the file', () => {
    const { result } = renderHook(() => useMessageImageAttachment());
    const file = makeImageFile('big.png', 'image/png', MAX_IMAGE_SIZE_BYTES + 1);

    act(() => {
      result.current.selectImage(file);
    });

    expect(result.current.hasImage).toBe(false);
    expect(result.current.pickError).toMatch(/10MB/);
  });

  it('revokes the previous preview URL when a second image is selected', () => {
    const { result } = renderHook(() => useMessageImageAttachment());

    act(() => {
      result.current.selectImage(makeImageFile('first.png'));
    });
    createObjectURLSpy.mockReturnValue('blob:second-preview-url');
    act(() => {
      result.current.selectImage(makeImageFile('second.png'));
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-preview-url');
    expect(result.current.previewUrl).toBe('blob:second-preview-url');
  });

  it('clearImage revokes the object URL and resets all selection/error state', () => {
    const { result } = renderHook(() => useMessageImageAttachment());
    act(() => {
      result.current.selectImage(makeImageFile());
    });

    act(() => {
      result.current.clearImage();
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-preview-url');
    expect(result.current.hasImage).toBe(false);
    expect(result.current.previewUrl).toBeNull();
    expect(result.current.pickError).toBeNull();
    expect(result.current.uploadError).toBeNull();
  });

  it('uploadImage requests a signed URL, PUTs the file, and returns the storage path', async () => {
    mockedCreateUploadUrl.mockResolvedValue({
      path: 'groups/g1/channels/c1/user-1/obj/photo.png',
      upload_url: 'https://x/upload',
      token: 'tok',
    });
    mockedUploadFile.mockResolvedValue(undefined);

    const { result } = renderHook(() => useMessageImageAttachment());
    const file = makeImageFile();
    act(() => {
      result.current.selectImage(file);
    });

    let path: string | null = null;
    await act(async () => {
      path = await result.current.uploadImage('conv-1');
    });

    expect(mockedCreateUploadUrl).toHaveBeenCalledWith('conv-1', {
      file_name: 'photo.png',
      content_type: 'image/png',
      file_size: file.size,
    });
    expect(mockedUploadFile).toHaveBeenCalledWith('https://x/upload', file);
    expect(path).toBe('groups/g1/channels/c1/user-1/obj/photo.png');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadError).toBeNull();
  });

  it('surfaces an upload failure and does not clear the selected image', async () => {
    mockedCreateUploadUrl.mockRejectedValue(new ApiError(413, 'File exceeds maximum size'));

    const { result } = renderHook(() => useMessageImageAttachment());
    act(() => {
      result.current.selectImage(makeImageFile());
    });

    await act(async () => {
      await expect(result.current.uploadImage('conv-1')).rejects.toThrow();
    });

    expect(result.current.uploadError).toEqual({ status: 413, message: 'File exceeds maximum size' });
    // Selection is preserved on failure so the caller can retry, not silently lost.
    expect(result.current.hasImage).toBe(true);
    expect(result.current.isUploading).toBe(false);
  });

  it('uploadImage is a no-op returning null when no image is selected', async () => {
    const { result } = renderHook(() => useMessageImageAttachment());

    let path: string | null = 'unset';
    await act(async () => {
      path = await result.current.uploadImage('conv-1');
    });

    expect(path).toBeNull();
    expect(mockedCreateUploadUrl).not.toHaveBeenCalled();
  });
});
