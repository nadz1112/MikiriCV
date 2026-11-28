import { getCapacitor, isNativeMobile } from './runtime';

const REFRESH_TOKEN_KEY = 'cvmikiri_refresh_token';

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export interface NativeTokenPair {
  accessToken: string;
  refreshToken: string;
}

export function getNativeAccessToken(): string | null {
  return memoryAccessToken;
}

export function setNativeAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export async function getNativeRefreshToken(): Promise<string | null> {
  if (!isNativeMobile()) return memoryRefreshToken;
  const securePlugin = getCapacitor()?.Plugins?.SecureStoragePlugin;
  if (securePlugin?.get) {
    try {
      const res = await securePlugin.get({ key: REFRESH_TOKEN_KEY });
      return res?.value ?? memoryRefreshToken;
    } catch {
      return memoryRefreshToken;
    }
  }
  return memoryRefreshToken;
}

export async function setNativeTokens(tokens: NativeTokenPair): Promise<void> {
  memoryAccessToken = tokens.accessToken;
  memoryRefreshToken = tokens.refreshToken;
  if (!isNativeMobile()) return;
  const securePlugin = getCapacitor()?.Plugins?.SecureStoragePlugin;
  if (securePlugin?.set) {
    try {
      await securePlugin.set({ key: REFRESH_TOKEN_KEY, value: tokens.refreshToken });
    } catch {
      // Fall back to in-memory refresh token for the active session if Keychain/Keystore plugin is unavailable.
    }
  }
}

export async function clearNativeTokens(): Promise<void> {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  if (!isNativeMobile()) return;
  const securePlugin = getCapacitor()?.Plugins?.SecureStoragePlugin;
  if (securePlugin?.remove) {
    try {
      await securePlugin.remove({ key: REFRESH_TOKEN_KEY });
    } catch {
      // Ignore missing key during cleanup.
    }
  }
}
