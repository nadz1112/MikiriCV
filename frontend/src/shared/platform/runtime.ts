export type ClientPlatform = 'ios' | 'android' | 'pwa' | 'web';

export interface CapacitorNetworkPlugin {
  getStatus?: () => Promise<{ connected: boolean; connectionType?: string }>;
  addListener?: (
    eventName: 'networkStatusChange',
    listener: (status: { connected: boolean; connectionType?: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
}

export interface CapacitorFilesystemPlugin {
  writeFile?: (options: {
    path: string;
    data: string;
    directory: string;
    recursive?: boolean;
  }) => Promise<{ uri: string }>;
  deleteFile?: (options: { path: string; directory: string }) => Promise<void>;
  readdir?: (options: { path: string; directory: string }) => Promise<{ files: Array<{ name: string }> }>;
}

export interface CapacitorSharePlugin {
  share?: (options: {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
    dialogTitle?: string;
  }) => Promise<void>;
}

export interface CapacitorFileOpenerPlugin {
  open?: (options: { filePath: string; contentType?: string }) => Promise<void>;
}

export interface CapacitorSecureStoragePlugin {
  get?: (options: { key: string }) => Promise<{ value: string | null }>;
  set?: (options: { key: string; value: string }) => Promise<{ value: boolean }>;
  remove?: (options: { key: string }) => Promise<{ value: boolean }>;
}

export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Network?: CapacitorNetworkPlugin;
    Filesystem?: CapacitorFilesystemPlugin;
    Share?: CapacitorSharePlugin;
    FileOpener?: CapacitorFileOpenerPlugin;
    SecureStoragePlugin?: CapacitorSecureStoragePlugin;
  };
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Capacitor;
}

export function isNativeMobile(): boolean {
  const cap = getCapacitor();
  return Boolean(cap?.isNativePlatform?.());
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return mediaMatch || iosStandalone;
}

export function getClientPlatform(): ClientPlatform {
  const cap = getCapacitor();
  if (cap?.isNativePlatform?.()) {
    const platform = cap.getPlatform?.();
    if (platform === 'ios') return 'ios';
    return 'android';
  }
  if (isStandalonePwa()) return 'pwa';
  return 'web';
}

export const API_BASE_URL_STORAGE_KEY = 'cvmikiri:api_base_url';

export function normalizeApiBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (trimmed === '/api' || trimmed.startsWith('/api/')) {
    return trimmed;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
      return null;
    }
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/api';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function getStoredApiBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY);
    return stored ? normalizeApiBaseUrl(stored) : null;
  } catch {
    return null;
  }
}

export function setApiBaseUrl(url: string): string {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) {
    throw new Error('Địa chỉ máy chủ API không hợp lệ. Vui lòng nhập dạng http://... hoặc https://...');
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota errors in restricted webviews
    }
  }
  return normalized;
}

export function resetApiBaseUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getApiBaseUrl(): string {
  if (isNativeMobile()) {
    const stored = getStoredApiBaseUrl();
    if (stored) return stored;
  }
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (isNativeMobile()) {
    return 'http://10.0.2.2:4000/api';
  }
  return '/api';
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function isNetworkOfflineError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: string;
    name?: string;
    message?: string;
    response?: unknown;
    isAxiosError?: boolean;
  };
  if (candidate.code === 'ERR_CANCELED' || candidate.name === 'CanceledError') return false;
  if (candidate.response !== undefined && candidate.response !== null) return false;
  if (candidate.code === 'ERR_NETWORK') return true;
  if (candidate.isAxiosError && (candidate.message === 'Network Error' || !candidate.response)) {
    return true;
  }
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false &&
    candidate.name === 'TypeError'
  ) {
    return true;
  }
  return false;
}
