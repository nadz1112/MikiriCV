// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CandidateTable } from '../features/candidates/components/CandidateTable';
import { BottomNav } from './common/BottomNav';
import { NetworkStatusBanner } from './common/NetworkStatusBanner';
import { AccountPage } from '../pages/AccountPage';
import { CompaniesPage } from '../pages/admin/CompaniesPage';
import { useNetworkStore } from '../shared/offline/networkStore';
import { useSubscriptionStore } from '../features/subscription/subscriptionStore';
import * as subscriptionApi from '../services/subscriptionApi';
import * as adminDashboardApi from '../services/adminDashboardApi';
import type { CandidateItem } from '../features/candidates/api/candidateApi';

const authState = vi.hoisted(() => ({
  user: {
    id: 'hr-1',
    email: 'hr@example.com',
    fullName: 'HR Mobile',
    companyName: 'Mikiri',
    role: 'ENTERPRISE' as 'ENTERPRISE' | 'ADMIN',
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
  },
  isOfflineSession: false,
}));

vi.mock('../features/auth/authStore', () => ({
  useAuthStore: Object.assign(
    (select?: (s: typeof authState) => unknown) => (select ? select(authState) : authState),
    { getState: () => authState },
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useNetworkStore.setState({ isOnline: true, isSyncing: false, pendingCount: 0, conflictCount: 0 });
  useSubscriptionStore.setState({ subscription: null, isLoading: false, error: '', hasLoaded: false });
  authState.user.role = 'ENTERPRISE';
});

function mockMobileViewport(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('767px') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('mobile responsive UI and offline banner', () => {
  it('renders mobile candidate cards instead of desktop table when viewport is <= 767px', () => {
    mockMobileViewport(true);
    const candidate: CandidateItem = {
      id: 'cv-m1',
      fullName: 'Lê Hoàng Minh',
      email: 'minh@example.com',
      phone: null,
      yearsOfExperience: 4,
      skills: ['React', 'TypeScript', 'Node.js'],
      education: null,
      fileName: 'minh.pdf',
      extractionStatus: 'SUCCESS',
      extractionMessage: null,
      matchScore: 88,
      createdAt: '2026-11-25',
    };

    render(
      <CandidateTable
        candidates={[candidate]}
        total={1}
        page={1}
        limit={50}
        isLoading={false}
        onPageChange={() => {}}
      />,
    );

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Lê Hoàng Minh')).toBeTruthy();
    expect(screen.getByText('4 năm KN')).toBeTruthy();
  });

  it('renders role-aware BottomNav items and Vietnamese offline status banner', () => {
    useNetworkStore.setState({ isOnline: false, pendingCount: 2, conflictCount: 0 });
    render(
      <MemoryRouter>
        <NetworkStatusBanner />
        <BottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status').textContent).toContain('Đang ở chế độ ngoại tuyến');
    expect(screen.getByRole('status').textContent).toContain('2 mục chờ đồng bộ');
    expect(screen.getByText('AI Studio')).toBeTruthy();
    expect(screen.getByText('JD')).toBeTruthy();
    expect(screen.getByText('Tài khoản')).toBeTruthy();

    cleanup();
    authState.user.role = 'ADMIN';
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Doanh nghiệp')).toBeTruthy();
    expect(screen.getByText('Tài khoản')).toBeTruthy();
    expect(screen.queryByText('AI Studio')).toBeNull();
    expect(screen.queryByText('Quản lý CV')).toBeNull();
  });

  it('renders AccountPage personal usage history as mobile cards when viewport is <= 767px', async () => {
    mockMobileViewport(true);
    useSubscriptionStore.setState({
      subscription: {
        companyId: 'c1',
        name: 'FREE',
        billingCycle: 'MONTHLY',
        tokenLimit: 100000,
        cycleDays: 30,
        maxCvPerCall: 1,
        maxOutputTokens: 4096,
        maxPages: 2,
        maxCharacters: 3000,
        bulk: false,
        endsAt: null,
        used: 1000,
        remaining: 99000,
        reservedTokens: 0,
        periodEnd: '2026-12-26T00:00:00Z',
      },
      isLoading: false,
      error: '',
      hasLoaded: true,
      fetchSubscription: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(subscriptionApi, 'getPersonalUsageHistory').mockResolvedValue({
      entries: [
        {
          id: 'u-1',
          createdAt: '2026-11-26T03:00:00Z',
          jobTitle: 'Mobile React Engineer',
          cvCount: 1,
          tokensUsed: 1200,
          succeeded: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      estimate: { averageTokensPerCv: 1200, sampleCount: 1, source: 'PERSONAL_HISTORY' },
    });

    render(
      <MemoryRouter initialEntries={['/account?tab=plan']}>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Mobile React Engineer')).toBeTruthy();
    expect(screen.getByText('1.200 token')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders CompaniesPage activity as mobile cards when viewport is <= 767px', async () => {
    mockMobileViewport(true);
    vi.spyOn(subscriptionApi.billingApi, 'plans').mockResolvedValue([]);
    vi.spyOn(subscriptionApi.billingApi, 'info').mockResolvedValue({
      model: 'gemini-3.6-flash',
      billingMode: 'FREE',
      status: 'FREE',
      inputUsd: null,
      outputUsd: null,
      priceVersion: null,
      pricingUrl: 'https://ai.google.dev',
      rateLimitsUrl: 'https://ai.google.dev',
    });
    vi.spyOn(adminDashboardApi, 'getAdminDashboard').mockResolvedValue({
      aiUsageSince: null,
      range: '7d',
      overview: {
        totalUsers: 1,
        activeUsers: 1,
        lockedUsers: 0,
        totalJobs: 2,
        totalCandidates: 5,
        failedCandidates: 0,
        totalMatches: 3,
      },
      distribution: [],
      ai: {
        simulatedCostVnd: 0,
        demoInputRate: 0,
        demoOutputRate: 0,
        billingMode: 'FREE',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostUsd: null,
        inputRate: null,
        outputRate: null,
        calls: 1,
        callsWithoutTokenData: 0,
        daily: [],
      },
      enterprises: [
        {
          id: 'co-1',
          companyName: 'Công ty Mobile Test',
          fullName: 'HR Co',
          lastLoginAt: null,
          hrCount: 1,
          members: [],
          jobCount: 2,
          candidateCount: 5,
          matchCount: 3,
          inputTokens: 100,
          outputTokens: 50,
          calls: 1,
          estimatedCostUsd: null,
          actualCostUsd: '0',
        },
      ],
    });

    render(
      <MemoryRouter>
        <CompaniesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Công ty Mobile Test' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
