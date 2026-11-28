import toast from 'react-hot-toast';
import { httpClient } from '../api/httpClient';
import { getCapacitor, isNativeMobile } from './runtime';
import { offlineDb } from '../offline/offlineDb';
import { useNetworkStore } from '../offline/networkStore';

const CACHE_DIR = 'CACHE';
const trackedNativeCachePaths = new Set<string>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function openBlobInBrowser(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'cv-ung-vien.pdf';
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function openBlobOnNative(blob: Blob, fileName: string, contentType?: string): Promise<boolean> {
  const plugins = getCapacitor()?.Plugins;
  if (!plugins?.Filesystem?.writeFile) return false;
  const safeName = (fileName || 'cv.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `cvmikiri-cv/${Date.now()}-${safeName}`;
  const base64 = await blobToBase64(blob);
  const writeResult = await plugins.Filesystem.writeFile({
    path: relativePath,
    data: base64,
    directory: CACHE_DIR,
    recursive: true,
  });
  trackedNativeCachePaths.add(relativePath);
  const uri = writeResult?.uri;
  if (uri && plugins.FileOpener?.open) {
    await plugins.FileOpener.open({
      filePath: uri,
      contentType: contentType || blob.type || 'application/pdf',
    });
    return true;
  }
  if (uri && plugins.Share?.share) {
    await plugins.Share.share({
      title: fileName || 'Hồ sơ CV',
      url: uri,
    });
    return true;
  }
  return false;
}

export async function clearTrackedNativeCacheFiles(): Promise<void> {
  const fsPlugin = getCapacitor()?.Plugins?.Filesystem;
  if (!fsPlugin?.deleteFile || trackedNativeCachePaths.size === 0) {
    trackedNativeCachePaths.clear();
    return;
  }
  const paths = Array.from(trackedNativeCachePaths);
  trackedNativeCachePaths.clear();
  await Promise.all(
    paths.map((filePath) =>
      fsPlugin.deleteFile!({ path: filePath, directory: CACHE_DIR }).catch(() => undefined),
    ),
  );
}

export async function fetchCandidateFileBlob(
  candidateId: string,
): Promise<{ blob: Blob; contentType: string }> {
  const res = await httpClient.get<Blob>(`/candidates/${candidateId}/file`, {
    responseType: 'blob',
  });
  const contentType =
    (res.headers?.['content-type'] as string | undefined) ||
    res.data.type ||
    'application/pdf';
  return {
    blob: new Blob([res.data], { type: contentType }),
    contentType,
  };
}

export async function openCandidateCvFile(options: {
  candidateId: string;
  fileName?: string;
  userId?: string;
}): Promise<void> {
  const { candidateId, fileName = 'ho-so-cv.pdf', userId } = options;
  const isOnline = useNetworkStore.getState().isOnline;
  const pinned = userId ? await offlineDb.getPinnedCv(userId, candidateId) : null;

  let blob: Blob | undefined = !isOnline ? pinned?.fileBlob : undefined;
  let contentType = pinned?.contentType;

  if (!isOnline && !blob) {
    toast.error('Bạn đang ngoại tuyến và tệp CV gốc này chưa được lưu ngoại tuyến.');
    return;
  }

  if (isOnline) {
    try {
      const fetched = await fetchCandidateFileBlob(candidateId);
      blob = fetched.blob;
      contentType = fetched.contentType;
    } catch {
      if (pinned?.fileBlob) {
        blob = pinned.fileBlob;
      } else {
        toast.error('Không thể tải tệp CV gốc. Vui lòng thử lại.');
        return;
      }
    }
  }

  if (!blob) return;

  if (isNativeMobile()) {
    const handled = await openBlobOnNative(blob, fileName, contentType).catch(() => false);
    if (handled) return;
  }
  openBlobInBrowser(blob, fileName);
}
