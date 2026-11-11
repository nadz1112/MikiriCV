import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, it, vi } from 'vitest';
import { PdfTextExtractor } from '../src/modules/candidates/text-extractor.js';
import { toWhere } from '../src/modules/candidates/candidate.repository.js';
import { skillNormalizer } from '../src/modules/skills/skill-dictionary.js';

function pdfWithInvalidHex() {
  // Invalid bytes inside a hex string reproduce the reported PDF.js warnings.
  const stream = `BT /F1 12 Tf 20 100 Td <4865${String.fromCharCode(28, 143)}6c6c6f> Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

it('extracts recoverable PDF text without repeating hex warnings, but rejects unreadable files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mikiricv-pdf-'));
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    const file = path.join(dir, 'cv.pdf');
    await writeFile(file, pdfWithInvalidHex());
    expect(await new PdfTextExtractor().extract(file)).toContain('Hello');
    expect(log.mock.calls.flat().join(' ')).not.toContain('Ignoring invalid character');
    await writeFile(file, Buffer.from('not a pdf'));
    await expect(new PdfTextExtractor().extract(file)).rejects.toThrow();
  } finally {
    log.mockRestore();
    await rm(dir, { recursive: true, force: true });
  }
});

it('searches free text skills internally while retaining tenant and all-skills constraints', () => {
  expect(toWhere({ ownerId: 'owner', skills: ['reactjs', 'Team leadership'], skillMode: 'all' }, skillNormalizer)).toEqual({
    AND: [{ ownerId: 'owner' }, { AND: [{ skills: { has: 'React' } }, { searchText: { contains: 'team leadership' } }] }],
  });
});
