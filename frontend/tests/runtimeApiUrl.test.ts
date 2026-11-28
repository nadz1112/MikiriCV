// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_BASE_URL_STORAGE_KEY,
  getApiBaseUrl,
  normalizeApiBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../src/shared/platform/runtime';

describe('runtime API URL configuration', () => {
  afterEach(() => {
    window.localStorage.clear();
    delete window.Capacitor;
    vi.unstubAllEnvs();
  });

  it('defaults to /api on web/PWA when VITE_API_BASE_URL is unset', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(getApiBaseUrl()).toBe('/api');
  });

  it('defaults to Android emulator loopback URL on native mobile when unconfigured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
    expect(getApiBaseUrl()).toBe('http://10.0.2.2:4000/api');
  });

  it('normalizes root URLs to include /api and applies override on native mobile', () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };

    const saved = setApiBaseUrl('http://192.168.1.50:4000');
    expect(saved).toBe('http://192.168.1.50:4000/api');
    expect(window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)).toBe('http://192.168.1.50:4000/api');
    expect(getApiBaseUrl()).toBe('http://192.168.1.50:4000/api');

    resetApiBaseUrl();
    expect(window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)).toBeNull();
    expect(getApiBaseUrl()).toBe('http://10.0.2.2:4000/api');
  });

  it('rejects invalid URLs and preserves custom subpaths', () => {
    expect(normalizeApiBaseUrl('ftp://invalid')).toBeNull();
    expect(normalizeApiBaseUrl('')).toBeNull();
    expect(normalizeApiBaseUrl('https://demo.example.com/custom/api/')).toBe('https://demo.example.com/custom/api');
  });
});
