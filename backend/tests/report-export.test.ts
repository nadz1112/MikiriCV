import { beforeEach, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
const mocks = vi.hoisted(() => ({ subscription: vi.fn(), job: vi.fn(), candidates: vi.fn(), matches: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ prisma: { jobDescription: { findFirst: mocks.job }, candidate: { count: mocks.candidates }, matchResult: { findMany: mocks.matches } } }));
vi.mock('../src/services/subscription.service.js', () => ({ getUserSubscription: mocks.subscription }));
import { exportComparison } from '../src/services/report-export.service.js';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.subscription.mockResolvedValue({ name: 'PLUS' });
  mocks.job.mockResolvedValue({ title: '<script>private</script>' });
  mocks.candidates.mockResolvedValue(1);
  mocks.matches.mockResolvedValue([{ candidate: { fullName: '=1+1' }, score: 80, summary: '<script>alert(1)</script>', matchedSkills: ['React'], missingSkills: [], highlights: [], skillAnalysis: [], redFlags: [], interviewQuestions: [] }]);
});
it('requires PLUS before reading candidates', async () => {
  mocks.subscription.mockResolvedValue({ name: 'FREE' });
  await expect(exportComparison('hr', 'jd', ['cv'], 'excel')).rejects.toMatchObject({ code: 'PLUS_REQUIRED' });
  expect(mocks.candidates).not.toHaveBeenCalled();
});
it('rejects a foreign ID in a bulk export and scopes every lookup', async () => {
  await expect(exportComparison('hr', 'jd', ['cv', 'foreign'], 'excel')).rejects.toMatchObject({ status: 404 });
  expect(mocks.candidates).toHaveBeenCalledWith({ where: { id: { in: ['cv', 'foreign'] }, ownerId: 'hr' } });
  expect(mocks.job).toHaveBeenCalledWith({ where: { id: 'jd', ownerId: 'hr' }, select: { title: true } });
  expect(mocks.matches).not.toHaveBeenCalled();
});
it('creates a real XLSX with formula-like content stored as text and no private CV fields', async () => {
  const bytes = await exportComparison('hr', 'jd', ['cv'], 'excel');
  expect(Buffer.isBuffer(bytes)).toBe(true);
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">=1+1</t>');
  expect(sheet).not.toContain('<f>');
  expect(sheet).toContain('&lt;script&gt;');
  expect(JSON.stringify(mocks.matches.mock.calls)).not.toMatch(/rawText|searchText|fileUrl/);
});
it('escapes CV-derived content in the PDF print view and rejects incomplete results', async () => {
  const html = await exportComparison('hr', 'jd', ['cv'], 'print');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('window.print()');
  mocks.matches.mockResolvedValue([]);
  await expect(exportComparison('hr', 'jd', ['cv'], 'print')).rejects.toMatchObject({ code: 'REPORT_INCOMPLETE' });
});
