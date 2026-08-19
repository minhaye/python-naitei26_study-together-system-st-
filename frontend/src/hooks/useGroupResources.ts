import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { ApiError } from '../lib/apiClient';
import {
  createResourceFile,
  createResourceUploadUrl,
  deleteResourceFile,
  getResourceDownloadUrl,
  listGroupResources,
  uploadResourceFile,
} from '../lib/resource.api';
import type { Resource } from '../lib/resource.types';

export interface ResourceError {
  status: number | null;
  message: string;
}

function toResourceError(err: unknown): ResourceError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Đã xảy ra lỗi không xác định.' };
}

/** Open/Preview: navigates to the plain signed URL in a new tab. Content types the browser
 * can render inline (images/PDF/txt) preview there; everything else (docx/xlsx/pptx/...) the
 * browser will typically download on its own -- no custom viewer/conversion is implemented,
 * per MVP scope. */
export function openResource(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Download: fetches the signed URL's bytes directly (not `window.open`, which would just
 * navigate to/preview the Supabase page) and saves them via a same-page, same-origin
 * `Blob` object URL. This is what makes it a real, silent download for every resource type,
 * including ones the browser would otherwise render inline (PDF/image) instead of saving --
 * a plain `<a download>` pointing straight at the cross-origin Supabase URL cannot force that
 * (the `download` attribute is only honored by browsers for same-origin links). The object
 * URL is revoked right after the click so it doesn't leak memory. */
export async function downloadResourceBlob(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function useGroupResources(groupId: string | undefined) {
  const { user, isLoggedIn } = useAuth();
  const currentUserId = user?.id ?? null;

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<ResourceError | null>(null);
  const [uploadError, setUploadError] = useState<ResourceError | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<ResourceError | null>(null);
  const [openError, setOpenError] = useState<ResourceError | null>(null);
  const [downloadError, setDownloadError] = useState<ResourceError | null>(null);
  const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);

  // Guards against a second upload firing while one is already in flight (e.g. a fast
  // double-click on the upload button), independent of the isUploading render state.
  const uploadInFlight = useRef(false);
  // Same guard, per-resource, for download -- a fast double-click on the Download button
  // must not start two overlapping fetch+blob downloads of the same file.
  const downloadInFlight = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!groupId || !isLoggedIn) {
      setResources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const data = await listGroupResources(groupId);
      setResources(data);
    } catch (err) {
      setResources([]);
      setListError(toResourceError(err));
    } finally {
      setLoading(false);
    }
  }, [groupId, isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      if (!groupId || uploadInFlight.current) return;
      uploadInFlight.current = true;
      setIsUploading(true);
      setUploadError(null);
      try {
        const contentType = file.type || 'application/octet-stream';
        const { path, upload_url } = await createResourceUploadUrl(groupId, {
          file_name: file.name,
          content_type: contentType,
          file_size: file.size,
        });
        await uploadResourceFile(upload_url, file);
        const created = await createResourceFile({
          group_id: groupId,
          name: file.name,
          file_path: path,
          file_type: contentType,
          file_size: file.size,
        });
        setResources((prev) => [created, ...prev]);
      } catch (err) {
        setUploadError(toResourceError(err));
        throw err;
      } finally {
        uploadInFlight.current = false;
        setIsUploading(false);
      }
    },
    [groupId]
  );

  const remove = useCallback(async (fileId: string) => {
    setPendingDeleteId(fileId);
    setDeleteError(null);
    try {
      await deleteResourceFile(fileId);
      setResources((prev) => prev.filter((r) => r.id !== fileId));
    } catch (err) {
      setDeleteError(toResourceError(err));
      throw err;
    } finally {
      setPendingDeleteId(null);
    }
  }, []);

  const open = useCallback(async (fileId: string) => {
    setOpenError(null);
    try {
      const { url } = await getResourceDownloadUrl(fileId);
      openResource(url);
    } catch (err) {
      setOpenError(toResourceError(err));
      throw err;
    }
  }, []);

  const download = useCallback(
    async (fileId: string) => {
      if (downloadInFlight.current.has(fileId)) return;
      downloadInFlight.current.add(fileId);
      setPendingDownloadId(fileId);
      setDownloadError(null);
      try {
        const { url } = await getResourceDownloadUrl(fileId, true);
        const resource = resources.find((r) => r.id === fileId);
        await downloadResourceBlob(url, resource?.name ?? 'download');
      } catch (err) {
        setDownloadError(toResourceError(err));
        throw err;
      } finally {
        downloadInFlight.current.delete(fileId);
        setPendingDownloadId(null);
      }
    },
    [resources]
  );

  const canDelete = useCallback(
    (resource: Resource, isGroupManager: boolean) =>
      !!currentUserId && (resource.uploader_id === currentUserId || isGroupManager),
    [currentUserId]
  );

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [resources]
  );

  return {
    resources: sortedResources,
    loading,
    listError,
    uploadError,
    isUploading,
    pendingDeleteId,
    deleteError,
    openError,
    downloadError,
    pendingDownloadId,
    upload,
    remove,
    open,
    download,
    canDelete,
    refetch: load,
  };
}
