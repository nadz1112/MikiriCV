export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: 'https' | 'http';
    cleartext?: boolean;
  };
  plugins?: {
    SplashScreen?: {
      launchAutoHide?: boolean;
      backgroundColor?: string;
    };
  };
}

const allowDebugHttp =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CAP_DEBUG_HTTP === 'true';

const config: CapacitorConfig = {
  appId: 'vn.cvmikiri.app',
  appName: 'CVMikiri',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: allowDebugHttp ? 'http' : 'https',
    cleartext: allowDebugHttp,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#f8fafc',
    },
  },
};

export default config;
