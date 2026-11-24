import { prisma } from '../config/database.js';
import { AppError } from '../common/errors/app-error.js';
import { getUserSubscription } from './subscription.service.js';
import JSZip from 'jszip';
const escape = (value: unknown) => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
export async function exportComparison(userId: string, jobId: string, candidateIds: string[], format: 'excel' | 'print') {
  const subscription = await getUserSubscription(userId);
  if (subscription.name !== 'PLUS') throw new AppError(403, 'PLUS_REQUIRED', 'Xuất báo cáo Excel/PDF dành cho gói PLUS.');
  const ids = [...new Set(candidateIds)];
  const job = await prisma.jobDescription.findFirst({ where: { id: jobId, ownerId: userId }, select: { title: true } });
  const owned = await prisma.candidate.count({ where: { id: { in: ids }, ownerId: userId } });
  if (!job || owned !== ids.length) throw new AppError(404, 'REPORT_NOT_FOUND', 'Không tìm thấy JD hoặc một số CV được chọn');
  const matches = await prisma.matchResult.findMany({ where: { jobDescriptionId: jobId, candidateId: { in: ids }, candidate: { ownerId: userId }, jobDescription: { ownerId: userId } }, select: {
    score: true, summary: true, matchedSkills: true, missingSkills: true, highlights: true, skillAnalysis: true, redFlags: true, interviewQuestions: true,
    candidate: { select: { fullName: true } },
  }, orderBy: { score: 'desc' } });
  if (matches.length !== ids.length) throw new AppError(422, 'REPORT_INCOMPLETE', 'Một số CV chưa có kết quả đánh giá. Vui lòng tải lại bảng kết quả.');
  const headings = ['Ứng viên', 'Điểm', 'Nhận xét', 'Kỹ năng khớp', 'Kỹ năng thiếu', '3 điểm nổi bật', 'Phân tích kỹ năng', 'Điểm cần xác minh', 'Câu hỏi phỏng vấn'];
  const rows = matches.map((match) => [match.candidate.fullName, match.score, match.summary, match.matchedSkills.join(', '), match.missingSkills.join(', '), match.highlights.join('\n'), match.skillAnalysis.join('\n'), match.redFlags.join('\n'), match.interviewQuestions.join('\n')]);
  if (format === 'excel') {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="So sanh ung vien" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    const sheetRows = [headings, ...rows].map((values, row) => `<row r="${row + 1}">${values.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${row + 1}" t="${typeof value === 'number' ? 'n' : 'inlineStr'}">${typeof value === 'number' ? `<v>${value}</v>` : `<is><t xml:space="preserve">${escape(value)}</t></is>`}</c>`).join('')}</row>`).join('');
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo so sánh ứng viên</title><style>body{font:14px Arial;margin:24px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:8px;white-space:pre-wrap;text-align:left}h1{font-size:22px}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}thead{display:table-header-group}}</style></head><body><button onclick="window.print()">In / Lưu PDF</button><h1>${escape(job.title)}</h1><p>Báo cáo so sánh dựa trên kỹ năng và kinh nghiệm đã trích xuất. Các điểm cần xác minh không phải kết luận về ứng viên.</p><table><thead><tr>${headings.map((heading) => `<th>${escape(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map((values) => `<tr>${values.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
