import { afterEach, describe, expect, it } from 'vitest';
import { offlineDb, stripPrivateCandidateFields } from './offlineDb';
import type { AuthUser } from '../../features/auth/authStore';
import type { CandidateItem } from '../../features/candidates/api/candidateApi';

const userA: AuthUser = {
  id: 'user-a',
  email: 'a@example.com',
  fullName: 'HR A',
  companyName: 'Công ty A',
  role: 'ENTERPRISE',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
};

afterEach(async () => {
  await offlineDb.purgeAllOfflineData();
});

describe('offlineDb tenant isolation and privacy', () => {
  it('isolates cached jobs and leaderboards strictly by userId', async () => {
    await offlineDb.saveJobs('user-a', [
      {
        id: 'jd-a',
        title: 'Backend A',
        description: 'Desc A',
        requiredSkills: ['Node.js'],
        minExperience: 2,
        createdAt: '2026-11-25',
        updatedAt: '2026-11-25',
      },
    ]);

    expect((await offlineDb.getJobs('user-a'))?.jobs).toHaveLength(1);
    expect(await offlineDb.getJobs('user-b')).toBeNull();
  });

  it('strips rawText, searchText, and fileUrl from cached candidate list items', async () => {
    const rawCandidate = {
      id: 'cv-1',
      fullName: 'Nguyễn Văn An',
      email: 'an@example.com',
      phone: null,
      yearsOfExperience: 3,
      skills: ['React'],
      education: null,
      fileName: 'an.pdf',
      extractionStatus: 'SUCCESS' as const,
      extractionMessage: null,
      matchScore: null,
      createdAt: '2026-11-25',
      rawText: 'SENSITIVE RAW CV TEXT',
      searchText: 'nguyen van an sensitive',
      fileUrl: '/uploads/secret.pdf',
    } as unknown as CandidateItem;

    const stripped = stripPrivateCandidateFields(rawCandidate) as unknown as Record<string, unknown>;
    expect(stripped.rawText).toBeUndefined();
    expect(stripped.searchText).toBeUndefined();
    expect(stripped.fileUrl).toBeUndefined();

    await offlineDb.saveCandidates('user-a', [rawCandidate], 1);
    const cached = await offlineDb.getCandidates('user-a');
    const stored = cached?.items[0] as unknown as Record<string, unknown>;
    expect(stored.rawText).toBeUndefined();
    expect(stored.searchText).toBeUndefined();
    expect(stored.fileUrl).toBeUndefined();
  });

  it('stores pinned CVs per user and purges all stores completely on logout', async () => {
    await offlineDb.saveSessionMeta(userA);
    await offlineDb.pinCv(
      'user-a',
      {
        id: 'cv-pin',
        fullName: 'Trần Thị Bình',
        email: null,
        phone: null,
        skills: ['TypeScript'],
        yearsOfExperience: 4,
        education: null,
        fileName: 'binh.pdf',
        createdAt: '2026-11-25',
      },
      new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      'application/pdf',
    );

    expect(await offlineDb.getPinnedCv('user-a', 'cv-pin')).not.toBeNull();
    expect(await offlineDb.getPinnedCv('user-b', 'cv-pin')).toBeNull();

    await offlineDb.purgeAllOfflineData();

    expect(await offlineDb.getValidSessionMeta()).toBeNull();
    expect(await offlineDb.getPinnedCv('user-a', 'cv-pin')).toBeNull();
  });
});
