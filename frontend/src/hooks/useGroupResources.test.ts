import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/apiClient';
import { useAuth } from './useAuth';
import {
  createResourceFile,
  createResourceUploadUrl,
  deleteResourceFile,
  getResourceDownloadUrl,
  listGroupResources,
  uploadResourceFile,
} from '../lib/resource.api';
import { useGroupResources } from './useGroupResources';
import type { Resource } from '../lib/resource.types';

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/resource.api', () => ({
  listGroupResources: vi.fn(),
  createResourceUploadUrl: vi.fn(),
  uploadResourceFile: vi.fn(),
  createResourceFile: vi.fn(),
  deleteResourceFile: vi.fn(),
  getResourceDownloadUrl: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedList = vi.mocked(listGroupResources);
const mockedCreateUploadUrl = vi.mocked(createResourceUploadUrl);
const mockedUploadFile = vi.mocked(uploadResourceFile);
const mockedCreateFile = vi.mocked(createResourceFile);
const mockedDelete = vi.mocked(deleteResourceFile);
const mockedDownloadUrl = vi.mocked(getResourceDownloadUrl);

const uploader = { id: 'user-1', username: 'alice', display_name: 'Alice', avatar_url: null, role: 'user' as const };

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'res-1',
    group_id: 'group-1',
    uploader_id: 'user-1',
    folder_id: null,
    name: 'notes.pdf',
    file_path: 'groups/group-1/user-1/obj/notes.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    uploader,
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    isLoggedIn: true,
    user: { id: 'user-1' },
  } as unknown as ReturnType<typeof useAuth>);
  mockedList.mockReset();
  mockedCreateUploadUrl.mockReset();
  mockedUploadFile.mockReset();
  mockedCreateFile.mockReset();
  mockedDelete.mockReset();
  mockedDownloadUrl.mockReset();
});

describe('useGroupResources', () => {
  it('loads resources for the group on mount', async () => {
    mockedList.mockResolvedValue([makeResource()]);

    const { result } = renderHook(() => useGroupResources('group-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedList).toHaveBeenCalledWith('group-1');
    expect(result.current.resources).toHaveLength(1);
    expect(result.current.listError).toBeNull();
  });

  it('surfaces an empty list distinctly from an error', async () => {
    mockedList.mockResolvedValue([]);

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.resources).toEqual([]);
    expect(result.current.listError).toBeNull();
  });

  it('surfaces an API error from the list call', async () => {
    mockedList.mockRejectedValue(new ApiError(500, 'Server error'));

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.resources).toEqual([]);
    expect(result.current.listError).toEqual({ status: 500, message: 'Server error' });
  });

  it('uploads a file end-to-end and prepends it to the list', async () => {
    mockedList.mockResolvedValue([]);
    mockedCreateUploadUrl.mockResolvedValue({ path: 'groups/group-1/user-1/obj/new.pdf', upload_url: 'https://x/upload', token: 't' });
    mockedUploadFile.mockResolvedValue(undefined);
    const created = makeResource({ id: 'res-new', name: 'new.pdf' });
    mockedCreateFile.mockResolvedValue(created);

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(['content'], 'new.pdf', { type: 'application/pdf' });
    await act(async () => {
      await result.current.upload(file);
    });

    expect(mockedCreateUploadUrl).toHaveBeenCalledWith('group-1', {
      file_name: 'new.pdf',
      content_type: 'application/pdf',
      file_size: file.size,
    });
    expect(mockedUploadFile).toHaveBeenCalledWith('https://x/upload', file);
    expect(mockedCreateFile).toHaveBeenCalledWith({
      group_id: 'group-1',
      name: 'new.pdf',
      file_path: 'groups/group-1/user-1/obj/new.pdf',
      file_type: 'application/pdf',
      file_size: file.size,
    });
    expect(result.current.resources.map((r) => r.id)).toEqual(['res-new']);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadError).toBeNull();
  });

  it('ignores a second upload call while one is already in flight', async () => {
    mockedList.mockResolvedValue([]);
    let resolveUpload!: () => void;
    mockedCreateUploadUrl.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = () => resolve({ path: 'p', upload_url: 'https://x/upload', token: 't' });
      })
    );

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(['a'], 'a.pdf', { type: 'application/pdf' });
    let firstUpload!: Promise<void>;
    act(() => {
      firstUpload = result.current.upload(file);
      result.current.upload(file); // should be a no-op, upload already in flight
    });

    expect(mockedCreateUploadUrl).toHaveBeenCalledTimes(1);

    resolveUpload();
    mockedUploadFile.mockResolvedValue(undefined);
    mockedCreateFile.mockResolvedValue(makeResource());
    await act(async () => {
      await firstUpload;
    });
  });

  it('surfaces an upload failure without adding a resource', async () => {
    mockedList.mockResolvedValue([]);
    mockedCreateUploadUrl.mockRejectedValue(new ApiError(400, 'Unsupported content type'));

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const file = new File(['a'], 'a.exe', { type: 'application/x-msdownload' });
    await act(async () => {
      await expect(result.current.upload(file)).rejects.toThrow();
    });

    expect(result.current.resources).toEqual([]);
    expect(result.current.uploadError).toEqual({ status: 400, message: 'Unsupported content type' });
  });

  it('deletes a resource and removes it from the list on success', async () => {
    const resource = makeResource();
    mockedList.mockResolvedValue([resource]);
    mockedDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.resources).toHaveLength(1));

    await act(async () => {
      await result.current.remove(resource.id);
    });

    expect(mockedDelete).toHaveBeenCalledWith(resource.id);
    expect(result.current.resources).toEqual([]);
    expect(result.current.deleteError).toBeNull();
  });

  it('keeps the resource in the list when delete fails', async () => {
    const resource = makeResource();
    mockedList.mockResolvedValue([resource]);
    mockedDelete.mockRejectedValue(new ApiError(403, 'Forbidden'));

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.resources).toHaveLength(1));

    await act(async () => {
      await expect(result.current.remove(resource.id)).rejects.toThrow();
    });

    expect(result.current.resources).toHaveLength(1);
    expect(result.current.deleteError).toEqual({ status: 403, message: 'Forbidden' });
  });

  it('opens a resource using a freshly fetched signed download URL', async () => {
    mockedList.mockResolvedValue([makeResource()]);
    mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/notes.pdf', expires_in: 300 });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useGroupResources('group-1'));
    await waitFor(() => expect(result.current.resources).toHaveLength(1));

    await act(async () => {
      await result.current.open('res-1');
    });

    expect(mockedDownloadUrl).toHaveBeenCalledWith('res-1');
    expect(openSpy).toHaveBeenCalledWith('https://signed/notes.pdf', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  describe('download (fetch + Blob, never window.open)', () => {
    let fetchSpy: ReturnType<typeof vi.fn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let openSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      // jsdom doesn't implement these -- define them if missing so vi.spyOn has something
      // real to wrap (and to restore afterward), rather than replacing the global URL class.
      if (!URL.createObjectURL) (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => '';
      if (!URL.revokeObjectURL) (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-object-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      clickSpy.mockRestore();
      openSpy.mockRestore();
    });

    function mockFakeFile(): File {
      return new File(['file-bytes'], 'ignored', { type: 'application/octet-stream' });
    }

    it('downloads a PDF via Blob, never navigating with window.open, and preserves the filename', async () => {
      mockedList.mockResolvedValue([makeResource({ id: 'res-1', name: 'Lesson 1.pdf', file_type: 'application/pdf' })]);
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/lesson1.pdf?download=Lesson+1.pdf', expires_in: 300 });
      fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockFakeFile()) });
      const appendSpy = vi.spyOn(document.body, 'appendChild');

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await result.current.download('res-1');
      });

      // download=true distinguishes this from open()'s plain preview URL request.
      expect(mockedDownloadUrl).toHaveBeenCalledWith('res-1', true);
      expect(fetchSpy).toHaveBeenCalledWith('https://signed/lesson1.pdf?download=Lesson+1.pdf');
      expect(openSpy).not.toHaveBeenCalled();

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      const anchorCall = appendSpy.mock.calls.find((call) => (call[0] as HTMLElement).tagName === 'A');
      const anchor = anchorCall?.[0] as HTMLAnchorElement;
      expect(anchor.href).toBe('blob:mock-object-url');
      expect(anchor.download).toBe('Lesson 1.pdf');
      expect(clickSpy).toHaveBeenCalled();
      expect(result.current.downloadError).toBeNull();

      appendSpy.mockRestore();
    });

    it('downloads an image via Blob without window.open', async () => {
      mockedList.mockResolvedValue([makeResource({ id: 'res-1', name: 'photo.jpg', file_type: 'image/jpeg' })]);
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/photo.jpg?download=photo.jpg', expires_in: 300 });
      fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockFakeFile()) });

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await result.current.download('res-1');
      });

      expect(fetchSpy).toHaveBeenCalledWith('https://signed/photo.jpg?download=photo.jpg');
      expect(openSpy).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('downloads an Office document (docx) the same way, uniformly across resource types', async () => {
      mockedList.mockResolvedValue([
        makeResource({
          id: 'res-2',
          name: 'notes.docx',
          file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ]);
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/notes.docx?download=notes.docx', expires_in: 300 });
      fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockFakeFile()) });

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await result.current.download('res-2');
      });

      expect(mockedDownloadUrl).toHaveBeenCalledWith('res-2', true);
      expect(openSpy).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('revokes the Blob object URL after triggering the download (no leak)', async () => {
      mockedList.mockResolvedValue([makeResource()]);
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/notes.pdf?download=notes.pdf', expires_in: 300 });
      fetchSpy.mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockFakeFile()) });

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await result.current.download('res-1');
      });

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-object-url');
      // click must happen before revoke, otherwise the browser has nothing to download.
      const clickOrder = clickSpy.mock.invocationCallOrder[0];
      const revokeOrder = revokeObjectURLSpy.mock.invocationCallOrder[0];
      expect(clickOrder).toBeLessThan(revokeOrder);
    });

    it('surfaces a network-level fetch error without adding a stray Blob URL', async () => {
      mockedList.mockResolvedValue([makeResource()]);
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/notes.pdf?download=notes.pdf', expires_in: 300 });
      fetchSpy.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await expect(result.current.download('res-1')).rejects.toThrow();
      });

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(result.current.downloadError).toEqual({ status: null, message: 'Đã xảy ra lỗi không xác định.' });
      expect(result.current.resources).toHaveLength(1);
      expect(result.current.pendingDownloadId).toBeNull();
    });

    it('surfaces a 4xx from the signed-URL request as a download error', async () => {
      mockedList.mockResolvedValue([makeResource()]);
      mockedDownloadUrl.mockRejectedValue(new ApiError(403, 'Forbidden'));

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      await act(async () => {
        await expect(result.current.download('res-1')).rejects.toThrow();
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.downloadError).toEqual({ status: 403, message: 'Forbidden' });
      expect(result.current.resources).toHaveLength(1);
    });

    it('sets a pending-download state and ignores a duplicate click on the same resource', async () => {
      mockedList.mockResolvedValue([makeResource()]);
      let resolveFetch!: (value: { ok: boolean; blob: () => Promise<File> }) => void;
      fetchSpy.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );
      mockedDownloadUrl.mockResolvedValue({ url: 'https://signed/notes.pdf?download=notes.pdf', expires_in: 300 });

      const { result } = renderHook(() => useGroupResources('group-1'));
      await waitFor(() => expect(result.current.resources).toHaveLength(1));

      let firstDownload!: Promise<void>;
      act(() => {
        firstDownload = result.current.download('res-1');
        result.current.download('res-1'); // duplicate click on the same resource -> no-op
      });

      await waitFor(() => expect(result.current.pendingDownloadId).toBe('res-1'));
      expect(mockedDownloadUrl).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, blob: () => Promise.resolve(mockFakeFile()) });
      await act(async () => {
        await firstDownload;
      });

      expect(result.current.pendingDownloadId).toBeNull();
    });
  });

  it('canDelete allows the uploader or a group manager, and no one else', () => {
    const { result } = renderHook(() => useGroupResources('group-1'));
    const resource = makeResource({ uploader_id: 'user-1' });
    const othersResource = makeResource({ uploader_id: 'someone-else' });

    expect(result.current.canDelete(resource, false)).toBe(true);
    expect(result.current.canDelete(othersResource, false)).toBe(false);
    expect(result.current.canDelete(othersResource, true)).toBe(true);
  });
});
