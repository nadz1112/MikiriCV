import 'dotenv/config';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ExtractionStatus, MatchingItemStatus, MatchingJobStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { normalizeForSearch } from '../common/utils/normalize-for-search.js';
import { PdfTextExtractor } from '../modules/candidates/text-extractor.js';
import { FieldParser } from '../modules/candidates/field-parser.js';
import { cloudinaryFileStorage } from '../modules/storage/file-storage.js';
import { evaluateCandidateWithAi } from '../modules/matching/evaluate-candidate.js';
import { geminiMatchingProvider } from '../modules/matching/ai-matching-provider.js';
import { subscriptionEnd } from '../services/subscription-period.js';
import { vietnamDay } from '../services/admin-dashboard.service.js';
import { vietnamMonth } from '../services/subscription.service.js';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-full-demo.ts must not run in production.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Test@123';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const FAILED_EXTRACT_MSG =
  'Không thể đọc nội dung văn bản. Vui lòng kiểm tra file không cài mật khẩu hoặc file ảnh scan chưa được hỗ trợ.';

interface DriveCvSpec {
  id: string;
  fileName: string;
  key: string;
}

const DRIVE_CVS: DriveCvSpec[] = [
  { id: '1ASy27WzP0t1Ao2D0FoLloT40Jpj9VvLS', fileName: 'BuiNgocMai_CareNest_cv.pdf', key: 'BuiNgocMai' },
  { id: '1t-DF1Dy07BhcRAqJ6mPnSJft6SR7xsgS', fileName: 'DangHoaiNam_BuildAxis_cv.pdf', key: 'DangHoaiNam' },
  { id: '1qK1GKVJB2ckWcjS0shrmlEG3bjdq3xty', fileName: 'DinhThaoVy_TravelCove_cv.pdf', key: 'DinhThaoVy' },
  { id: '1w5NxpJ58fSDH9Qv4mYWCTq6jvqBeyeQS', fileName: 'DoKhanhLinh_LexBridge_cv.pdf', key: 'DoKhanhLinh' },
  { id: '1ZOVbv09uPN3rvMblzzZodT6fPnkTPyJI', fileName: 'HoGiaHan_BrandMosaic_cv.pdf', key: 'HoGiaHan' },
  { id: '14brWmWzV2HbBiIU3M-lq8RB_y7X5kn1m', fileName: 'LeHoangPhuc_CloudVertex_cv.pdf', key: 'LeHoangPhuc' },
  { id: '1vth4QHDTBzxEn8dXSacdtpueGf2FRAPA', fileName: 'LeMinhChau_EduSpring_cv.pdf', key: 'LeMinhChau' },
  { id: '1NbyWbLhKggoNOYXDnfqNzTxz9L_nj26q', fileName: 'LyThuTrang_RetailBloom_cv.pdf', key: 'LyThuTrang' },
  { id: '1zxyXaFRUcgJ3Af300R3bX71Rnmf-dg2G', fileName: 'MaiTuanKiet_MotionWorks_cv.pdf', key: 'MaiTuanKiet' },
  { id: '1z2oNX5L1-78bay5UN33ivNYpe2W7XLtT', fileName: 'NguyenHaiAn_Finora_cv.pdf', key: 'NguyenHaiAn' },
  { id: '1jhHL9AGecK0VtKulC6qQRx8anCAFvfMa', fileName: 'PhamNgocAnh_BrightWeb_cv.pdf', key: 'PhamNgocAnh' },
  { id: '1kHv8u9GjvfAQmb5OwEMoz4UF32uZe8tX', fileName: 'PhamQuocBao_OceanStay_cv.pdf', key: 'PhamQuocBao' },
  { id: '1_57MtkDaomH6ugz5xKK7bDR6oyAVLaSd', fileName: 'PhanAnhThu_SupplyNest_cv.pdf', key: 'PhanAnhThu' },
  { id: '1ingxHqlkc-YqEEHIdNfbfjM-2S1sZHxD', fileName: 'PhanThuHa_LedgerPoint_cv.pdf', key: 'PhanThuHa' },
  { id: '1poMHpQb5jnx7UgftbH-xWf_TM8tjlDHY', fileName: 'TranBichNgoc_HarborLink_cv.pdf', key: 'TranBichNgoc' },
  { id: '10lxdNkNcCPNvx0ExuDIwxL_BlSkiVBEf', fileName: 'TranMinhDuc_NovaTech_cv.pdf', key: 'TranMinhDuc' },
  { id: '197L2N_m6PXGPl5ebDQ00QwEYDABKLQa8', fileName: 'TruongDucHoa_AgriVista_cv.pdf', key: 'TruongDucHoa' },
  { id: '1ybmHKKF8upnV1nGe01xYlxhyYA3N0SrL', fileName: 'TruongMyDuyen_QualityGate_cv.pdf', key: 'TruongMyDuyen' },
  { id: '1Pc3FzJ7yokgOk7ZxAtdybUZ49KzknriN', fileName: 'VoThanhTam_BistroLane_cv.pdf', key: 'VoThanhTam' },
  { id: '1GRk0_BkUXWTfNQcvOxri2kdounPVf1ln', fileName: 'VuNhatMinh_VoltField_cv.pdf', key: 'VuNhatMinh' },
];

interface RealJdSpec {
  code: string;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number;
  evaluationConfig?: Prisma.InputJsonValue;
  candidateKeys: string[];
  daysAgo: number;
}

const REAL_JDS: RealJdSpec[] = [
  {
    code: 'JD01',
    title: 'Java Backend Developer',
    description:
      'NovaTech • Đà Nẵng • Toàn thời gian | Junior–Middle | 2 năm | 15–22 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Phát triển nền tảng quản lý đơn hàng và tồn kho cho khách hàng doanh nghiệp.\n\n' +
      'Mô tả công việc:\n' +
      '- Thiết kế REST API cho đơn hàng, sản phẩm, kho và phân quyền.\n' +
      '- Xây dựng lớp nghiệp vụ Java/Spring Boot, xử lý giao dịch và lỗi đồng thời.\n' +
      '- Thiết kế schema MySQL hoặc PostgreSQL, migration và tối ưu truy vấn.\n' +
      '- Viết unit test, integration test, tài liệu OpenAPI.\n' +
      '- Phối hợp frontend, QA và DevOps khi phát hành, phân tích log và sửa lỗi.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp CNTT hoặc liên quan; tối thiểu 2 năm phát triển backend; Java 17+, Spring Boot, JPA/Hibernate, SQL, REST API, Git, JWT, JUnit/Mockito; hiểu transaction, HTTP và bảo mật API.\n' +
      'Ưu tiên: Docker, Redis, Flyway, CI/CD, Kafka, Kubernetes.',
    requiredSkills: ['Java', 'Spring Boot', 'JPA/Hibernate', 'SQL', 'PostgreSQL', 'REST API', 'Git', 'JWT', 'JUnit'],
    preferredSkills: ['Docker', 'Redis', 'Flyway', 'CI/CD', 'Kafka', 'Kubernetes', 'MySQL'],
    minExperience: 2,
    evaluationConfig: {
      weights: {
        skill_matching: 35,
        experience_relevance: 25,
        project_achievement: 20,
        soft_skills: 8,
        education_certification: 7,
        cv_quality: 5,
      },
    },
    candidateKeys: ['TranMinhDuc', 'LeHoangPhuc', 'PhamNgocAnh', 'TruongMyDuyen', 'VoThanhTam'],
    daysAgo: 18,
  },
  {
    code: 'JD02',
    title: 'Digital Marketing Executive',
    description:
      'MarketPulse • TP. Hồ Chí Minh • Toàn thời gian | Junior | 1–2 năm | 10–16 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Tăng lượng khách hàng tiềm năng và hiệu quả quảng cáo cho nhóm sản phẩm bán lẻ.\n\n' +
      'Mô tả công việc:\n' +
      '- Lập kế hoạch quảng cáo theo mục tiêu và ngân sách từng tháng.\n' +
      '- Vận hành Google Ads Search và Meta Ads, theo dõi phân bổ chi phí.\n' +
      '- Thiết lập UTM, sự kiện chuyển đổi và kiểm tra dữ liệu GA4.\n' +
      '- Phân tích CTR, CPC, CPA, ROAS và đề xuất tối ưu theo tuần.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Marketing/Kinh tế; tối thiểu 1 năm vận hành chiến dịch; Google Ads, Meta Ads, GA4, Excel/Google Sheets, A/B testing.\n' +
      'Ưu tiên: Looker Studio, SEO, Canva, TikTok Ads, chứng chỉ Google Ads/GA4.',
    requiredSkills: ['Google Ads', 'Meta Ads', 'GA4', 'Excel', 'A/B testing', 'Digital Marketing'],
    preferredSkills: ['Looker Studio', 'SEO', 'Canva', 'TikTok Ads', 'Google Sheets'],
    minExperience: 1,
    candidateKeys: ['HoGiaHan', 'LyThuTrang', 'DinhThaoVy', 'VuNhatMinh'],
    daysAgo: 16,
  },
  {
    code: 'JD03',
    title: 'Nhân viên kế toán tổng hợp',
    description:
      'LedgerPoint • Đà Nẵng • Toàn thời gian | Middle | 2–4 năm | 12–18 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Đảm bảo số liệu kế toán đầy đủ, chính xác và hỗ trợ khóa sổ cho doanh nghiệp thương mại.\n\n' +
      'Mô tả công việc:\n' +
      '- Ghi nhận doanh thu, chi phí, mua bán hàng và các bút toán điều chỉnh.\n' +
      '- Đối chiếu tiền mặt, ngân hàng, công nợ phải thu/phải trả và tồn kho.\n' +
      '- Kiểm tra hóa đơn điện tử, tổng hợp thuế GTGT, lập báo cáo tài chính và khóa sổ.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Kế toán/Kiểm toán/Tài chính; tối thiểu 2 năm kinh nghiệm; nắm nguyên tắc hạch toán, công nợ, hóa đơn, thuế GTGT; Excel (SUMIFS, PivotTable) và MISA hoặc FAST.\n' +
      'Ưu tiên: Power Query, MOS Excel, kinh nghiệm thương mại hoặc kiểm toán.',
    requiredSkills: ['Kế toán tổng hợp', 'Thuế GTGT', 'Hóa đơn điện tử', 'Excel', 'MISA', 'Công nợ'],
    preferredSkills: ['FAST', 'Power Query', 'MOS Excel', 'Báo cáo tài chính'],
    minExperience: 2,
    candidateKeys: ['PhanThuHa', 'NguyenHaiAn', 'DoKhanhLinh', 'BuiNgocMai'],
    daysAgo: 14,
  },
  {
    code: 'JD04',
    title: 'Chuyên viên hành chính nhân sự tổng hợp',
    description:
      'PeopleSpring • TP. Hồ Chí Minh • Toàn thời gian | Middle | 2–4 năm | 12–18 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Phụ trách tuyển dụng và vận hành hồ sơ nhân sự, phối hợp kế toán trong công tác lương thưởng.\n\n' +
      'Mô tả công việc:\n' +
      '- Tiếp nhận nhu cầu tuyển dụng, xây dựng JD, sàng lọc hồ sơ và tổ chức phỏng vấn.\n' +
      '- Chuẩn hóa onboarding, cập nhật HRIS, hợp đồng lao động và hồ sơ BHXH.\n' +
      '- Kiểm tra chấm công, ngày phép, tăng ca và dữ liệu đầu vào bảng lương.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Quản trị nhân lực/Luật/Kinh tế; từ 2 năm kinh nghiệm HR; tuyển dụng, onboarding, Excel, quy trình chấm công và luật lao động.\n' +
      'Ưu tiên: ATS, HRIS, nghiệp vụ BHXH, C&B.',
    requiredSkills: ['Tuyển dụng', 'Onboarding', 'Quản trị nhân sự', 'Excel', 'Luật lao động', 'Chấm công'],
    preferredSkills: ['ATS', 'HRIS', 'BHXH', 'C&B'],
    minExperience: 2,
    evaluationConfig: {
      weights: {
        skill_matching: 25,
        experience_relevance: 25,
        project_achievement: 15,
        soft_skills: 18,
        education_certification: 10,
        cv_quality: 7,
      },
    },
    candidateKeys: ['BuiNgocMai', 'DoKhanhLinh', 'PhamQuocBao'],
    daysAgo: 12,
  },
  {
    code: 'JD05',
    title: 'Nhân viên logistics – chứng từ xuất nhập khẩu',
    description:
      'HarborLink • Hà Nội • Toàn thời gian | Nhân viên | 2–3 năm | 11–17 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Điều phối lô hàng xuất khẩu đường biển từ booking đến giao nhận và hoàn tất hồ sơ.\n\n' +
      'Mô tả công việc:\n' +
      '- Đặt booking, xác nhận lịch tàu, kiểm tra invoice, packing list và vận đơn.\n' +
      '- Theo dõi ETD/ETA, hạn cut-off, chuẩn bị dữ liệu khai báo hải quan.\n' +
      '- Theo dõi chi phí vận chuyển, đối soát hồ sơ và lập báo cáo giao hàng đúng hạn.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Logistics/Ngoại thương/Chuỗi cung ứng; ít nhất 2 năm nghiệp vụ; hiểu Incoterms 2020, booking, vận đơn, Excel và tiếng Anh chứng từ.\n' +
      'Ưu tiên: VNACCS, TMS/WMS, xử lý phụ phí đường biển.',
    requiredSkills: ['Logistics', 'Xuất nhập khẩu', 'Incoterms 2020', 'Chứng từ hải quan', 'Vận đơn', 'Excel'],
    preferredSkills: ['VNACCS', 'TMS', 'WMS', 'Tiếng Anh'],
    minExperience: 2,
    candidateKeys: ['TranBichNgoc', 'PhanAnhThu', 'TruongDucHoa', 'MaiTuanKiet'],
    daysAgo: 10,
  },
  {
    code: 'JD06',
    title: 'Kỹ sư xây dựng – giám sát thi công',
    description:
      'BuildAxis • Đà Nẵng • Toàn thời gian | Kỹ sư | 2–4 năm | 14–20 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Giám sát hạng mục kết cấu công trình dân dụng, kiểm soát chất lượng, tiến độ và an toàn.\n\n' +
      'Mô tả công việc:\n' +
      '- Đọc bản vẽ thiết kế, bóc tách khối lượng, theo dõi cốt thép, cốp pha, bê tông.\n' +
      '- Phối hợp nhà thầu phụ lập kế hoạch tuần, ghi nhật ký công trường và hồ sơ nghiệm thu.\n' +
      '- Kiểm tra kích thước, cao độ, an toàn lao động và cập nhật tiến độ.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Kỹ thuật xây dựng; tối thiểu 2 năm tại công trường; AutoCAD, Excel, bóc tách khối lượng, quy trình nghiệm thu và an toàn.\n' +
      'Ưu tiên: MS Project, máy thủy bình, chứng chỉ an toàn lao động.',
    requiredSkills: ['Giám sát thi công', 'AutoCAD', 'Bóc tách khối lượng', 'Nghiệm thu công trình', 'Excel', 'An toàn lao động'],
    preferredSkills: ['MS Project', 'Máy thủy bình', 'Kết cấu dân dụng'],
    minExperience: 2,
    candidateKeys: ['DangHoaiNam', 'VuNhatMinh', 'TruongDucHoa'],
    daysAgo: 8,
  },
  {
    code: 'JD07',
    title: 'Giáo viên tiếng Anh',
    description:
      'EduSpring • TP. Hồ Chí Minh • Toàn thời gian | Giáo viên | 1–3 năm | 12–18 triệu / tháng\n\n' +
      'Mục tiêu vị trí: Giảng dạy tiếng Anh giao tiếp cho học viên thiếu niên trình độ A2–B1.\n\n' +
      'Mô tả công việc:\n' +
      '- Thiết kế giáo án theo mục tiêu từng buổi và chương trình 12 tuần.\n' +
      '- Tổ chức hoạt động nghe, nói, đọc, viết và thực hành giao tiếp theo nhóm.\n' +
      '- Kiểm tra đầu vào, chấm bài, phản hồi cá nhân và trao đổi với phụ huynh.\n\n' +
      'Yêu cầu bắt buộc: Tốt nghiệp Ngôn ngữ Anh/Sư phạm Anh; tối thiểu 1 năm giảng dạy; IELTS 7.0+ hoặc tương đương; soạn giáo án và quản lý lớp.\n' +
      'Ưu tiên: TESOL/TEFL, Google Classroom, kinh nghiệm dạy thiếu niên A2–B1.',
    requiredSkills: ['Giảng dạy tiếng Anh', 'IELTS 7.0+', 'Soạn giáo án', 'Quản lý lớp học', 'Tiếng Anh'],
    preferredSkills: ['TESOL', 'TEFL', 'Google Classroom'],
    minExperience: 1,
    candidateKeys: ['LeMinhChau', 'DinhThaoVy', 'PhamQuocBao'],
    daysAgo: 6,
  },
];

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * HOUR_MS);
}

function daysAgoDate(d: number, hourOffset = 2): Date {
  return new Date(Date.now() - d * DAY_MS - hourOffset * HOUR_MS);
}

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * DAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMinimalPdf(lines: string[]): Buffer {
  const safeAscii = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  let contentOps = 'BT\n/F1 11 Tf\n';
  let y = 740;
  for (const line of lines) {
    contentOps += `1 0 0 1 50 ${y} Tm (${safeAscii(line)}) Tj\n`;
    y -= 18;
  }
  contentOps += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(contentOps, 'ascii')} >>\nstream\n${contentOps}\nendstream`,
  ];

  let doc = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(doc, 'ascii'));
    doc += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(doc, 'ascii');
  doc += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  doc += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  doc += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(doc, 'ascii');
}

async function downloadDrivePdf(fileId: string, destPath: string): Promise<Buffer> {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString('ascii') === '%PDF-') {
      await fs.writeFile(destPath, buf);
      return buf;
    }
  }
  throw new Error(`Không thể tải file PDF hợp lệ từ Google Drive (${fileId})`);
}

async function uploadToCloudinaryWithRetry(sourcePath: string, storedName: string, tmpDir: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tempCopy = path.join(tmpDir, `upload-${crypto.randomUUID()}.pdf`);
    await fs.copyFile(sourcePath, tempCopy);
    try {
      return await cloudinaryFileStorage.save(tempCopy, storedName);
    } catch (error) {
      await fs.unlink(tempCopy).catch(() => undefined);
      if (attempt === 3) throw error;
      await sleep(attempt * 1500);
    }
  }
  throw new Error(`Cloudinary upload failed for ${storedName}`);
}

function resolveDisplayName(rawText: string, fileKey: string, parsedFallback: string): string {
  const spacedKey = fileKey.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  const normalizedKey = normalizeForSearch(spacedKey);
  const topLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 60 && !line.includes('@') && !/\d{4,}/.test(line))
    .slice(0, 6);

  for (const line of topLines) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (normalizeForSearch(clean) === normalizedKey) {
      return clean;
    }
  }
  for (const line of topLines) {
    const clean = line.replace(/\s+/g, ' ').trim();
    const norm = normalizeForSearch(clean);
    if (norm.includes(normalizedKey) && clean.split(' ').length <= 5) {
      return clean;
    }
  }
  return spacedKey || parsedFallback;
}

class QuotaExhaustedError extends Error {}

function isRateLimitErr(error: unknown): boolean {
  const err = error as { status?: number; code?: string };
  return err?.status === 429 || err?.code === 'AI_RATE_LIMIT' || err?.code === 'AI_RATE_LIMITED';
}

async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number, staggerMs: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let stopEarly = false;
  async function worker(workerId: number) {
    if (workerId > 0 && staggerMs > 0) {
      await sleep(workerId * staggerMs);
    }
    while (!stopEarly) {
      const current = nextIndex++;
      if (current >= tasks.length) break;
      try {
        results[current] = await tasks[current]();
        if (concurrency === 1 && current < tasks.length - 1) {
          await sleep(16_000);
        }
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          stopEarly = true;
          break;
        }
        throw err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, (_, idx) => worker(idx)));
  return results;
}

async function cleanupFailedReservationArtifact(operationKey: string, candidateId: string, jobId: string) {
  const prior = await prisma.tokenReservation.findUnique({ where: { operationKey } });
  if (!prior) return;
  const [priorUsage, existingMatch] = await Promise.all([
    prisma.aiUsage.findUnique({ where: { reservationId: prior.id } }),
    prisma.matchResult.findUnique({
      where: { candidateId_jobDescriptionId: { candidateId, jobDescriptionId: jobId } },
    }),
  ]);
  if (existingMatch && priorUsage?.succeeded) return;

  await prisma.$transaction(async (tx) => {
    if (prior.status === 'SETTLED' && priorUsage?.totalTokens && priorUsage.totalTokens > 0) {
      await tx.tokenWallet.update({
        where: { id: prior.walletId },
        data: { used: { decrement: priorUsage.totalTokens } },
      });
    } else if (['HELD', 'STARTED', 'UNKNOWN'].includes(prior.status)) {
      await tx.tokenWallet.update({
        where: { id: prior.walletId },
        data: { reserved: { decrement: prior.amount } },
      });
    }
    await tx.aiUsage.deleteMany({ where: { reservationId: prior.id } });
    await tx.tokenLedger.deleteMany({
      where: {
        operationKey: { in: [`reserve:${prior.id}`, `settle:${prior.id}`, `release:${prior.id}`] },
      },
    });
    await tx.tokenReservation.delete({ where: { id: prior.id } });
  });
}

async function runEvaluationWithRetry(
  job: Parameters<typeof evaluateCandidateWithAi>[0],
  candidate: Parameters<typeof evaluateCandidateWithAi>[1],
  ownerId: string,
  plan: 'FREE' | 'PLUS',
  companyId: string,
  preferredOperationKey: string,
) {
  try {
    await cleanupFailedReservationArtifact(preferredOperationKey, candidate.id, job.id);
    return await evaluateCandidateWithAi(
      job,
      candidate,
      geminiMatchingProvider,
      ownerId,
      plan,
      companyId,
      preferredOperationKey,
    );
  } catch (error) {
    await cleanupFailedReservationArtifact(preferredOperationKey, candidate.id, job.id);
    const status = (error as { status?: number })?.status;
    const code = (error as { code?: string })?.code;
    const rateLimited = isRateLimitErr(error);
    const retryable =
      rateLimited ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      ['AI_SERVICE_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE', 'AI_PROVIDER_ERROR'].includes(code ?? '');
    if (!retryable) throw error;

    const waitMs = rateLimited ? 65_000 : 15_000;
    console.warn(`  ⏳ Gemini tạm lỗi (${code ?? status ?? 'transient'}), thử lại 1 lần sau ${waitMs / 1000}s...`);
    await sleep(waitMs);
    try {
      return await evaluateCandidateWithAi(
        job,
        candidate,
        geminiMatchingProvider,
        ownerId,
        plan,
        companyId,
        preferredOperationKey,
      );
    } catch (retryErr) {
      await cleanupFailedReservationArtifact(preferredOperationKey, candidate.id, job.id);
      if (isRateLimitErr(retryErr)) {
        console.warn('⚠️ Đã chạm hạn mức ngày (RPD) của Gemini Free Tier — dừng gọi thêm và hoàn tất các bảng còn lại.');
        throw new QuotaExhaustedError('RPD_EXHAUSTED');
      }
      throw retryErr;
    }
  }
}

async function backdateEvaluationTimestamps(reservationOperationKey: string, candidateId: string, jobId: string, targetDate: Date) {
  const day = vietnamDay(targetDate);
  const reservation = await prisma.tokenReservation.findUnique({ where: { operationKey: reservationOperationKey } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "match_results"
      SET "createdAt" = ${targetDate}, "updatedAt" = ${targetDate}
      WHERE "candidateId" = ${candidateId} AND "jobDescriptionId" = ${jobId}
    `;
    if (reservation) {
      await tx.$executeRaw`
        UPDATE "token_reservations"
        SET "createdAt" = ${targetDate}, "updatedAt" = ${targetDate}
        WHERE "id" = ${reservation.id}
      `;
      await tx.$executeRaw`
        UPDATE "token_ledger"
        SET "createdAt" = ${targetDate}
        WHERE "operationKey" IN (${`reserve:${reservation.id}`}, ${`settle:${reservation.id}`}, ${`release:${reservation.id}`})
      `;
      await tx.$executeRaw`
        UPDATE "ai_usage"
        SET "createdAt" = ${targetDate}, "day" = ${day}::date
        WHERE "reservationId" = ${reservation.id}
      `;
    }
  });
}

async function main() {
  if (env.STORAGE_DRIVER !== 'cloudinary') {
    throw new Error('Script yêu cầu STORAGE_DRIVER=cloudinary trong backend/.env.');
  }

  console.info('🚀 Bắt đầu khởi tạo cơ sở dữ liệu thử nghiệm đầy đủ cho MikiriCV...');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mikiricv-demo-seed-'));

  try {
    // 1. Clean up existing Cloudinary files referenced in DB (best effort)
    const oldCloudinaryCandidates = await prisma.candidate.findMany({
      where: { fileUrl: { startsWith: 'cloudinary:' } },
      select: { fileUrl: true },
    });
    if (oldCloudinaryCandidates.length > 0) {
      console.info(`🧹 Dọn ${oldCloudinaryCandidates.length} file CV cũ trên Cloudinary...`);
      await Promise.all(
        oldCloudinaryCandidates.map((c) => cloudinaryFileStorage.remove(c.fileUrl).catch(() => undefined)),
      );
    }

    // 2. Preserve ADMIN & service_plans, clear old demo rows in FK-safe order
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.BCRYPT_ROUNDS);
    let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!adminUser) {
      const adminEmail = (env.SEED_ADMIN_EMAIL || 'admin@mikiricv.vn').trim().toLowerCase();
      const adminPassHash = env.SEED_ADMIN_PASSWORD
        ? await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_ROUNDS)
        : passwordHash;
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: adminPassHash,
          fullName: 'Quản trị viên MikiriCV',
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.matchingJobItem.deleteMany();
      await tx.matchingJob.deleteMany();
      await tx.matchResult.deleteMany();
      await tx.aiUsage.deleteMany();
      await tx.tokenLedger.deleteMany();
      await tx.tokenReservation.deleteMany();
      await tx.tokenWallet.deleteMany();
      await tx.billingAudit.deleteMany({
        where: { id: { not: 'demo-company-price-20261126' } },
      });
      await tx.aiPrice.deleteMany();
      await tx.idempotencyKey.deleteMany();
      await tx.matchingRequest.deleteMany();
      await tx.candidate.deleteMany();
      await tx.jobDescription.deleteMany();
      await tx.user.deleteMany({ where: { role: 'ENTERPRISE' } });
      await tx.company.deleteMany();
    });

    // Ensure FREE and PLUS service_plans exist and read current version
    const freePlan = await prisma.servicePlan.upsert({
      where: { name: 'FREE' },
      update: {},
      create: {
        name: 'FREE',
        monthlyPriceVnd: 0,
        tokenLimit: 100000,
        cycleDays: 30,
        maxCvPerCall: 1,
        maxOutputTokens: 4096,
      },
    });
    const plusPlan = await prisma.servicePlan.upsert({
      where: { name: 'PLUS' },
      update: {},
      create: {
        name: 'PLUS',
        monthlyPriceVnd: 100000,
        tokenLimit: 3000000,
        cycleDays: 30,
        maxCvPerCall: 200,
        maxOutputTokens: 8192,
      },
    });

    // 3. Seed ai_prices (5 rows)
    const priceSpecs = [
      { model: 'gemini-2.5-flash', inputUsd: '0.15000000', outputUsd: '0.60000000', thinkingUsd: '0.60000000', daysAgo: 55 },
      { model: 'gemini-2.5-pro', inputUsd: '1.25000000', outputUsd: '5.00000000', thinkingUsd: '5.00000000', daysAgo: 40 },
      { model: env.GEMINI_MODEL, inputUsd: '0.10000000', outputUsd: '0.40000000', thinkingUsd: '0.40000000', daysAgo: 25 },
      { model: env.GEMINI_MODEL, inputUsd: '0.07500000', outputUsd: '0.30000000', thinkingUsd: '0.30000000', daysAgo: 12 },
      { model: env.GEMINI_MODEL, inputUsd: '0.00000000', outputUsd: '0.00000000', thinkingUsd: '0.00000000', daysAgo: 3 },
    ];
    for (const p of priceSpecs) {
      await prisma.aiPrice.create({
        data: {
          model: p.model,
          inputUsd: new Prisma.Decimal(p.inputUsd),
          outputUsd: new Prisma.Decimal(p.outputUsd),
          thinkingUsd: new Prisma.Decimal(p.thinkingUsd),
          createdAt: daysAgoDate(p.daysAgo),
        },
      });
    }

    // 4. Seed 7 Companies + 12 ENTERPRISE Users
    const currentMonth = vietnamMonth();
    const c1Start = daysAgoDate(22, 0);
    const c2Start = daysAgoDate(20, 0);
    const c3Start = daysAgoDate(25, 0);
    const c4Start = daysAgoDate(24, 0);
    const c5Start = daysAgoDate(19, 0);
    const c6Start = daysAgoDate(27, 0);
    const c7Start = daysAgoDate(35, 0);

    const companies = {
      mikiri: await prisma.company.create({
        data: {
          name: 'Mikiri Talent Hub',
          key: 'mikiri talent hub',
          plan: 'PLUS',
          billingCycle: 'YEARLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c1Start,
          subscriptionEndsAt: subscriptionEnd('PLUS', 'YEARLY', c1Start),
        },
      }),
      novatech: await prisma.company.create({
        data: {
          name: 'NovaTech Solutions',
          key: 'novatech solutions',
          plan: 'PLUS',
          billingCycle: 'MONTHLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c2Start,
          subscriptionEndsAt: subscriptionEnd('PLUS', 'MONTHLY', c2Start),
        },
      }),
      vietretail: await prisma.company.create({
        data: {
          name: 'VietRetail Group',
          key: 'vietretail group',
          plan: 'FREE',
          billingCycle: 'MONTHLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c3Start,
          subscriptionEndsAt: null,
        },
      }),
      saigonlogistics: await prisma.company.create({
        data: {
          name: 'Saigon Logistics JSC',
          key: 'saigon logistics jsc',
          plan: 'PLUS',
          billingCycle: 'YEARLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c4Start,
          subscriptionEndsAt: subscriptionEnd('PLUS', 'YEARLY', c4Start),
        },
      }),
      buildaxis: await prisma.company.create({
        data: {
          name: 'BuildAxis Engineering',
          key: 'buildaxis engineering',
          plan: 'FREE',
          billingCycle: 'MONTHLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c5Start,
          subscriptionEndsAt: null,
        },
      }),
      eduspring: await prisma.company.create({
        data: {
          name: 'EduSpring Academy',
          key: 'eduspring academy',
          plan: 'PLUS',
          billingCycle: 'MONTHLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c6Start,
          subscriptionEndsAt: daysFromNow(3),
        },
      }),
      finora: await prisma.company.create({
        data: {
          name: 'Finora Capital',
          key: 'finora capital',
          plan: 'PLUS',
          billingCycle: 'MONTHLY',
          quotaMonth: currentMonth,
          subscriptionStartedAt: c7Start,
          subscriptionEndsAt: daysAgoDate(5, 0),
        },
      }),
    };

    const hrMain = await prisma.user.create({
      data: {
        email: 'hr.main@mikiricv.vn',
        passwordHash,
        fullName: 'Nguyễn Minh Anh',
        companyName: companies.mikiri.name,
        companyId: companies.mikiri.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: hoursAgo(2),
        createdAt: daysAgoDate(25),
      },
    });
    const hrSupport = await prisma.user.create({
      data: {
        email: 'hr.support@mikiricv.vn',
        passwordHash,
        fullName: 'Trần Quốc Huy',
        companyName: companies.mikiri.name,
        companyId: companies.mikiri.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: hoursAgo(26),
        createdAt: daysAgoDate(20),
      },
    });
    const hrNova = await prisma.user.create({
      data: {
        email: 'hr@novatech.vn',
        passwordHash,
        fullName: 'Lê Thị Thảo',
        companyName: companies.novatech.name,
        companyId: companies.novatech.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: hoursAgo(5),
        createdAt: daysAgoDate(24),
      },
    });
    const hrNovaRecruiter = await prisma.user.create({
      data: {
        email: 'recruiter@novatech.vn',
        passwordHash,
        fullName: 'Phạm Đức Anh',
        companyName: companies.novatech.name,
        companyId: companies.novatech.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: daysAgoDate(3),
        createdAt: daysAgoDate(18),
      },
    });
    const hrRetail = await prisma.user.create({
      data: {
        email: 'hr@vietretail.vn',
        passwordHash,
        fullName: 'Võ Hoàng Yến',
        companyName: companies.vietretail.name,
        companyId: companies.vietretail.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: hoursAgo(6),
        createdAt: daysAgoDate(25),
      },
    });
    const hrRetailLocked = await prisma.user.create({
      data: {
        email: 'tuyendung@vietretail.vn',
        passwordHash,
        fullName: 'Ngô Quang Vinh',
        companyName: companies.vietretail.name,
        companyId: companies.vietretail.id,
        role: 'ENTERPRISE',
        isActive: false,
        mustChangePassword: false,
        lastLoginAt: daysAgoDate(12),
        createdAt: daysAgoDate(23),
      },
    });
    const hrLogistics = await prisma.user.create({
      data: {
        email: 'hr@saigonlogistics.vn',
        passwordHash,
        fullName: 'Đỗ Thanh Tùng',
        companyName: companies.saigonlogistics.name,
        companyId: companies.saigonlogistics.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: daysAgoDate(1),
        createdAt: daysAgoDate(24),
      },
    });
    const hrLogisticsOps = await prisma.user.create({
      data: {
        email: 'ops.hr@saigonlogistics.vn',
        passwordHash,
        fullName: 'Bùi Lan Hương',
        companyName: companies.saigonlogistics.name,
        companyId: companies.saigonlogistics.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
        createdAt: daysAgoDate(10),
      },
    });
    const hrBuild = await prisma.user.create({
      data: {
        email: 'hr@buildaxis.vn',
        passwordHash,
        fullName: 'Trương Văn Khoa',
        companyName: companies.buildaxis.name,
        companyId: companies.buildaxis.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: daysAgoDate(2),
        createdAt: daysAgoDate(19),
      },
    });
    const hrEdu = await prisma.user.create({
      data: {
        email: 'hr@eduspring.vn',
        passwordHash,
        fullName: 'Hoàng Mai Phương',
        companyName: companies.eduspring.name,
        companyId: companies.eduspring.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: hoursAgo(8),
        createdAt: daysAgoDate(27),
      },
    });
    const hrEduLocked = await prisma.user.create({
      data: {
        email: 'talent@eduspring.vn',
        passwordHash,
        fullName: 'Đặng Minh Quân',
        companyName: companies.eduspring.name,
        companyId: companies.eduspring.id,
        role: 'ENTERPRISE',
        isActive: true,
        mustChangePassword: false,
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 2 * HOUR_MS),
        lastLoginAt: daysAgoDate(4),
        createdAt: daysAgoDate(21),
      },
    });
    const hrFinora = await prisma.user.create({
      data: {
        email: 'hr@finora.vn',
        passwordHash,
        fullName: 'Lý Khánh Ngọc',
        companyName: companies.finora.name,
        companyId: companies.finora.id,
        role: 'ENTERPRISE',
        isActive: false,
        mustChangePassword: false,
        lastLoginAt: daysAgoDate(9),
        createdAt: daysAgoDate(35),
      },
    });

    // 5. Seed active TokenWallets & Ledger entries BEFORE calling Gemini
    const activePeriodStart = daysAgoDate(20, 0);
    const allEnterpriseWallets = [
      { user: hrMain, company: companies.mikiri, plan: plusPlan, bonusAdjust: 500000 },
      { user: hrSupport, company: companies.mikiri, plan: plusPlan, bonusAdjust: 0 },
      { user: hrNova, company: companies.novatech, plan: plusPlan, bonusAdjust: 0 },
      { user: hrNovaRecruiter, company: companies.novatech, plan: plusPlan, bonusAdjust: 0 },
      { user: hrRetail, company: companies.vietretail, plan: freePlan, bonusAdjust: 0 },
      { user: hrRetailLocked, company: companies.vietretail, plan: freePlan, bonusAdjust: 0 },
      { user: hrLogistics, company: companies.saigonlogistics, plan: plusPlan, bonusAdjust: 0 },
      { user: hrLogisticsOps, company: companies.saigonlogistics, plan: plusPlan, bonusAdjust: 0 },
      { user: hrBuild, company: companies.buildaxis, plan: freePlan, bonusAdjust: 0 },
      { user: hrEdu, company: companies.eduspring, plan: plusPlan, bonusAdjust: 0 },
      { user: hrEduLocked, company: companies.eduspring, plan: plusPlan, bonusAdjust: 0 },
      { user: hrFinora, company: companies.finora, plan: plusPlan, bonusAdjust: 0 },
    ];

    const walletByUserId = new Map<string, { id: string; periodStart: Date; periodEnd: Date }>();
    for (const item of allEnterpriseWallets) {
      const periodEnd = new Date(activePeriodStart.getTime() + item.plan.cycleDays * DAY_MS);
      const wallet = await prisma.tokenWallet.create({
        data: {
          userId: item.user.id,
          companyId: item.company.id,
          periodStart: activePeriodStart,
          periodEnd,
          baseLimit: item.plan.tokenLimit,
          adjustment: item.bonusAdjust,
          used: 0,
          reserved: 0,
          planVersion: `${item.plan.name}:${item.plan.version}`,
        },
      });
      walletByUserId.set(item.user.id, wallet);
      await prisma.tokenLedger.create({
        data: {
          walletId: wallet.id,
          kind: 'GRANT',
          amount: item.plan.tokenLimit,
          operationKey: `grant:${wallet.id}`,
          reason: `Gói ${item.plan.name}, phiên bản ${item.plan.version}`,
          createdAt: activePeriodStart,
        },
      });
      if (item.bonusAdjust > 0) {
        await prisma.tokenLedger.create({
          data: {
            walletId: wallet.id,
            kind: 'ADJUST',
            amount: item.bonusAdjust,
            actorId: adminUser.id,
            operationKey: `adjust:${adminUser.id}:seed-bonus-${item.user.id}`,
            reason: 'Cấp thêm hạn mức dùng thử chiến dịch tuyển dụng Q4',
            createdAt: daysAgoDate(18),
          },
        });
      }
    }

    // Add previous closed-cycle wallet for hrMain & hrNova + PLAN_CHANGE ledger history for hrMain
    const prevStart = new Date(activePeriodStart.getTime() - 30 * DAY_MS);
    const hrMainPrevWallet = await prisma.tokenWallet.create({
      data: {
        userId: hrMain.id,
        companyId: companies.mikiri.id,
        periodStart: prevStart,
        periodEnd: activePeriodStart,
        baseLimit: plusPlan.tokenLimit,
        adjustment: 0,
        used: 184250,
        reserved: 0,
        planVersion: `${plusPlan.name}:${plusPlan.version}`,
      },
    });
    await prisma.tokenLedger.createMany({
      data: [
        {
          walletId: hrMainPrevWallet.id,
          kind: 'GRANT',
          amount: freePlan.tokenLimit,
          operationKey: `grant:${hrMainPrevWallet.id}`,
          reason: `Gói FREE, phiên bản ${freePlan.version}`,
          createdAt: prevStart,
        },
        {
          walletId: hrMainPrevWallet.id,
          kind: 'PLAN_CHANGE',
          amount: plusPlan.tokenLimit - freePlan.tokenLimit,
          actorId: adminUser.id,
          operationKey: `plan:${hrMainPrevWallet.id}:upgrade-plus`,
          reason: `Nâng cấp gói ${plusPlan.name}, phiên bản ${plusPlan.version}`,
          createdAt: new Date(prevStart.getTime() + 2 * DAY_MS),
        },
      ],
    });

    const hrNovaPrevWallet = await prisma.tokenWallet.create({
      data: {
        userId: hrNova.id,
        companyId: companies.novatech.id,
        periodStart: prevStart,
        periodEnd: activePeriodStart,
        baseLimit: plusPlan.tokenLimit,
        adjustment: 0,
        used: 92400,
        reserved: 0,
        planVersion: `${plusPlan.name}:${plusPlan.version}`,
      },
    });
    await prisma.tokenLedger.create({
      data: {
        walletId: hrNovaPrevWallet.id,
        kind: 'GRANT',
        amount: plusPlan.tokenLimit,
        operationKey: `grant:${hrNovaPrevWallet.id}`,
        reason: `Gói ${plusPlan.name}, phiên bản ${plusPlan.version}`,
        createdAt: prevStart,
      },
    });

    // 6. Seed 13 Job Descriptions (7 real JDs for hrMain + 6 across secondary companies)
    console.info('📋 Đang tạo danh sách Job Description từ 7_JD_MikiriCV.docx và các doanh nghiệp...');
    const realJobsByCode = new Map<string, Awaited<ReturnType<typeof prisma.jobDescription.create>>>();
    for (const jd of REAL_JDS) {
      const created = await prisma.jobDescription.create({
        data: {
          title: jd.title,
          description: jd.description,
          requiredSkills: jd.requiredSkills,
          preferredSkills: jd.preferredSkills,
          minExperience: jd.minExperience,
          evaluationConfig: jd.evaluationConfig,
          ownerId: hrMain.id,
          createdById: hrMain.id,
          createdAt: daysAgoDate(jd.daysAgo),
        },
      });
      realJobsByCode.set(jd.code, created);
    }

    const secJobs = {
      novaBackend: await prisma.jobDescription.create({
        data: {
          title: 'Node.js & TypeScript Backend Engineer',
          description: 'Phát triển microservices Express/NestJS, PostgreSQL, Prisma ORM và tối ưu hàng đợi bất đồng bộ.',
          requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Express.js', 'REST API'],
          preferredSkills: ['Docker', 'Redis', 'Prisma'],
          minExperience: 2,
          ownerId: hrNova.id,
          createdById: hrNova.id,
          createdAt: daysAgoDate(16),
        },
      }),
      novaSupport: await prisma.jobDescription.create({
        data: {
          title: 'Senior DevOps & Cloud Engineer',
          description: 'Quản trị hạ tầng AWS, Kubernetes, CI/CD GitHub Actions và giám sát hệ thống cho Mikiri Talent Hub.',
          requiredSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux'],
          preferredSkills: ['Terraform', 'Prometheus'],
          minExperience: 3,
          ownerId: hrSupport.id,
          createdById: hrSupport.id,
          createdAt: daysAgoDate(11),
        },
      }),
      retailMarketing: await prisma.jobDescription.create({
        data: {
          title: 'Chuyên viên Performance Marketing (Bán lẻ)',
          description: 'Quản lý chiến dịch Meta Ads, Google Ads, tối ưu chuyển đổi cho chuỗi cửa hàng VietRetail.',
          requiredSkills: ['Google Ads', 'Meta Ads', 'GA4', 'Excel'],
          preferredSkills: ['TikTok Ads', 'Canva'],
          minExperience: 1,
          ownerId: hrRetail.id,
          createdById: hrRetail.id,
          createdAt: daysAgoDate(15),
        },
      }),
      logisticsXnk: await prisma.jobDescription.create({
        data: {
          title: 'Chuyên viên Điều phối Xuất nhập khẩu Đường biển',
          description: 'Xử lý chứng từ Vận đơn, Invoice, Packing List, Incoterms 2020 và khai báo VNACCS.',
          requiredSkills: ['Xuất nhập khẩu', 'Incoterms 2020', 'Vận đơn', 'VNACCS', 'Excel'],
          preferredSkills: ['TMS', 'Tiếng Anh'],
          minExperience: 2,
          ownerId: hrLogistics.id,
          createdById: hrLogistics.id,
          createdAt: daysAgoDate(14),
        },
      }),
      buildSite: await prisma.jobDescription.create({
        data: {
          title: 'Kỹ sư Hiện trường Kết cấu Dân dụng',
          description: 'Giám sát thi công, đọc bản vẽ AutoCAD, bóc tách khối lượng và kiểm soát an toàn lao động.',
          requiredSkills: ['AutoCAD', 'Giám sát thi công', 'Bóc tách khối lượng', 'Excel'],
          preferredSkills: ['MS Project'],
          minExperience: 2,
          ownerId: hrBuild.id,
          createdById: hrBuild.id,
          createdAt: daysAgoDate(13),
        },
      }),
      eduTeacher: await prisma.jobDescription.create({
        data: {
          title: 'Giáo viên Tiếng Anh Giao tiếp Thiếu niên',
          description: 'Giảng dạy giáo trình A2-B1, soạn giáo án tương tác và đánh giá tiến độ học viên.',
          requiredSkills: ['Giảng dạy tiếng Anh', 'IELTS 7.0+', 'Soạn giáo án'],
          preferredSkills: ['TESOL', 'Google Classroom'],
          minExperience: 1,
          ownerId: hrEdu.id,
          createdById: hrEdu.id,
          createdAt: daysAgoDate(10),
        },
      }),
      finoraAnalyst: await prisma.jobDescription.create({
        data: {
          title: 'Chuyên viên Phân tích Tài chính Doanh nghiệp',
          description: 'Phân tích báo cáo tài chính, kiểm soát công nợ và dự báo dòng tiền doanh nghiệp.',
          requiredSkills: ['Kế toán tổng hợp', 'Báo cáo tài chính', 'Excel', 'Thuế GTGT'],
          preferredSkills: ['Power Query', 'SQL'],
          minExperience: 2,
          ownerId: hrFinora.id,
          createdById: hrFinora.id,
          createdAt: daysAgoDate(28),
        },
      }),
    };

    // 7. Download 20 real Drive CVs, extract real text/fields, upload to Cloudinary
    console.info('📥 Đang tải 20 CV PDF từ Google Drive, trích xuất nội dung và đẩy lên Cloudinary...');
    const extractor = new PdfTextExtractor();
    const parser = new FieldParser();
    const realCandidatesByKey = new Map<string, Awaited<ReturnType<typeof prisma.candidate.create>>>();

    for (let index = 0; index < DRIVE_CVS.length; index++) {
      const spec = DRIVE_CVS[index];
      const localPath = path.join(tmpDir, spec.fileName);
      const pdfBytes = await downloadDrivePdf(spec.id, localPath);
      const contentHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

      let rawText = '';
      let pageCount: number | null = null;
      let extractionStatus: ExtractionStatus = ExtractionStatus.SUCCESS;
      let extractionMessage: string | null = null;
      let fields = parser.parse('', spec.fileName);

      try {
        const doc = await extractor.extractDocument(localPath);
        rawText = doc.text.trim();
        pageCount = doc.pageCount;
        if (!rawText) throw new Error('EMPTY_TEXT');
        fields = parser.parse(rawText, spec.fileName);
        const missing: string[] = [];
        if (!fields.email) missing.push('email');
        if (!fields.phone) missing.push('số điện thoại');
        if (fields.skills.length === 0) missing.push('kỹ năng');
        if (missing.length > 0) {
          extractionStatus = ExtractionStatus.WARNING;
          extractionMessage = `Đã đọc nội dung nhưng chưa tìm thấy ${missing.join(', ')}.`;
        }
      } catch {
        rawText = '';
        pageCount = null;
        extractionStatus = ExtractionStatus.FAILED;
        extractionMessage = FAILED_EXTRACT_MSG;
      }

      const fullName = resolveDisplayName(rawText, spec.key, fields.fullName);
      const storedName = `${crypto.randomUUID()}-${spec.fileName}`;
      const storedUrl = await uploadToCloudinaryWithRetry(localPath, storedName, tmpDir);

      const candidate = await prisma.candidate.create({
        data: {
          fullName,
          email: fields.email,
          phone: fields.phone,
          rawText,
          pageCount,
          searchText: normalizeForSearch(`${fullName} ${rawText}`),
          skills: fields.skills,
          yearsOfExperience: fields.yearsOfExperience,
          education: fields.education,
          fileName: spec.fileName,
          fileUrl: storedUrl,
          extractionStatus,
          extractionMessage,
          contentHash,
          ownerId: hrMain.id,
          uploadedById: hrMain.id,
          createdAt: daysAgoDate(17 - Math.floor(index * 0.7)),
        },
      });
      realCandidatesByKey.set(spec.key, candidate);
      console.info(`  ✓ [${index + 1}/20] ${spec.fileName} -> ${extractionStatus} (${pageCount ?? 0} trang, ${fields.skills.length} kỹ năng)`);
    }

    // 8. Seed 9 secondary Candidates with real PDF files uploaded to Cloudinary
    console.info('📄 Đang tạo và tải lên Cloudinary 9 hồ sơ CV cho các doanh nghiệp phụ...');
    async function createSyntheticCandidate(opts: {
      ownerId: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      education: string | null;
      yearsOfExperience: number;
      skills: string[];
      lines: string[];
      fileName: string;
      status: ExtractionStatus;
      message?: string | null;
      daysAgo: number;
    }) {
      const pdfBytes = buildMinimalPdf(opts.lines);
      const localPath = path.join(tmpDir, opts.fileName);
      await fs.writeFile(localPath, pdfBytes);
      const storedUrl = await uploadToCloudinaryWithRetry(localPath, `${crypto.randomUUID()}-${opts.fileName}`, tmpDir);

      let rawText = '';
      let pageCount: number | null = 1;
      if (opts.status !== ExtractionStatus.FAILED) {
        const doc = await extractor.extractDocument(localPath);
        rawText = doc.text.trim();
        pageCount = doc.pageCount;
      }

      return prisma.candidate.create({
        data: {
          fullName: opts.fullName,
          email: opts.email,
          phone: opts.phone,
          rawText,
          pageCount,
          searchText: opts.status === ExtractionStatus.FAILED ? '' : normalizeForSearch(`${opts.fullName} ${rawText}`),
          skills: opts.status === ExtractionStatus.FAILED ? [] : opts.skills,
          yearsOfExperience: opts.status === ExtractionStatus.FAILED ? 0 : opts.yearsOfExperience,
          education: opts.status === ExtractionStatus.FAILED ? null : opts.education,
          fileName: opts.fileName,
          fileUrl: storedUrl,
          extractionStatus: opts.status,
          extractionMessage: opts.message ?? null,
          contentHash: crypto.createHash('sha256').update(pdfBytes).digest('hex'),
          ownerId: opts.ownerId,
          uploadedById: opts.ownerId,
          createdAt: daysAgoDate(opts.daysAgo),
        },
      });
    }

    const secCandidates = {
      nova1: await createSyntheticCandidate({
        ownerId: hrNova.id,
        fullName: 'Phạm Hữu Khang',
        email: 'khang.pham.dev@example.test',
        phone: '0905123456',
        education: 'Đại học Bách Khoa Đà Nẵng',
        yearsOfExperience: 3,
        skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'REST API'],
        lines: [
          'PHAM HUU KHANG - Backend Software Engineer',
          'Email: khang.pham.dev@example.test | Phone: 0905123456',
          'Education: Dai hoc Bach Khoa Da Nang - Cong nghe thong tin',
          'Experience: 3 nam kinh nghiem Node.js, TypeScript, Express.js, PostgreSQL, Prisma, Docker, Redis.',
          'Projects: Xay dung he thong don hang REST API phuc vu 20,000 nguoi dung, viet unit test Vitest.',
        ],
        fileName: 'PhamHuuKhang_Backend_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 15,
      }),
      nova2: await createSyntheticCandidate({
        ownerId: hrNova.id,
        fullName: 'Nguyễn Thảo Nhi',
        email: 'nhi.nguyen.qa@example.test',
        phone: '0912345678',
        education: 'Đại học FPT Đà Nẵng',
        yearsOfExperience: 2,
        skills: ['TypeScript', 'SQL', 'Postman', 'Git'],
        lines: [
          'NGUYEN THAO NHI - Junior Fullstack & QA Engineer',
          'Email: nhi.nguyen.qa@example.test | Phone: 0912345678',
          'Education: Dai hoc FPT Da Nang',
          'Experience: 2 nam kinh nghiem kiem thu API Postman, viet truy van PostgreSQL va phat trien web TypeScript.',
        ],
        fileName: 'NguyenThaoNhi_QA_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 12,
      }),
      retail1: await createSyntheticCandidate({
        ownerId: hrRetail.id,
        fullName: 'Trần Ngọc Hân',
        email: 'han.tran.mkt@example.test',
        phone: '0938112233',
        education: 'Đại học Kinh tế TP.HCM',
        yearsOfExperience: 2,
        skills: ['Google Ads', 'Meta Ads', 'GA4', 'Excel', 'Canva'],
        lines: [
          'TRAN NGOC HAN - Digital Marketing Executive',
          'Email: han.tran.mkt@example.test | Phone: 0938112233',
          'Education: Dai hoc Kinh te TP.HCM - Marketing',
          'Experience: 2 nam kinh nghiem van hanh Google Ads Search, Meta Ads, doc so lieu GA4 va bao cao Excel.',
        ],
        fileName: 'TranNgocHan_Marketing_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 13,
      }),
      retail2: await createSyntheticCandidate({
        ownerId: hrRetail.id,
        fullName: 'Lê Minh Tuấn',
        email: 'tuan.le.sales@example.test',
        phone: '0977445566',
        education: 'Đại học Thương mại',
        yearsOfExperience: 1,
        skills: ['Excel', 'Bán lẻ', 'Chăm sóc khách hàng'],
        lines: [
          'LE MINH TUAN - Retail Sales Coordinator',
          'Email: tuan.le.sales@example.test | Phone: 0977445566',
          'Education: Dai hoc Thuong mai',
          'Experience: 1 nam kinh nghiem van hanh cua hang ban le, tong hop bao cao doanh so bang Excel.',
        ],
        fileName: 'LeMinhTuan_Sales_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 10,
      }),
      logistics1: await createSyntheticCandidate({
        ownerId: hrLogistics.id,
        fullName: 'Vũ Thị Minh Thư',
        email: 'thu.vu.logistics@example.test',
        phone: '0989223344',
        education: 'Đại học Ngoại thương',
        yearsOfExperience: 3,
        skills: ['Logistics', 'Xuất nhập khẩu', 'Incoterms 2020', 'VNACCS', 'Excel'],
        lines: [
          'VU THI MINH THU - Export Documentation Specialist',
          'Email: thu.vu.logistics@example.test | Phone: 0989223344',
          'Education: Dai hoc Ngoai thuong - Kinh te doi ngoai',
          'Experience: 3 nam kinh nghiem chung tu xuat khau duong bien, Incoterms 2020, booking, VNACCS, Excel.',
        ],
        fileName: 'VuThiMinhThu_Logistics_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 11,
      }),
      logisticsWarn: await createSyntheticCandidate({
        ownerId: hrLogistics.id,
        fullName: 'Hoàng Gia Bảo',
        email: 'bao.hoang.ops@example.test',
        phone: null,
        education: 'Đại học Giao thông Vận tải TP.HCM',
        yearsOfExperience: 2,
        skills: ['Logistics', 'TMS', 'Excel'],
        lines: [
          'HOANG GIA BAO - Supply Chain Coordinator',
          'Email: bao.hoang.ops@example.test',
          'Education: Dai hoc Giao thong Van tai TP.HCM',
          'Experience: 2 nam kinh nghiem dieu phoi kho van TMS va theo doi chi phi van tai bang Excel.',
        ],
        fileName: 'HoangGiaBao_SupplyChain_cv.pdf',
        status: ExtractionStatus.WARNING,
        message: 'Đã đọc nội dung nhưng chưa tìm thấy số điện thoại.',
        daysAgo: 9,
      }),
      build1: await createSyntheticCandidate({
        ownerId: hrBuild.id,
        fullName: 'Đỗ Văn Hùng',
        email: 'hung.do.civil@example.test',
        phone: '0918776655',
        education: 'Đại học Xây dựng Hà Nội',
        yearsOfExperience: 3,
        skills: ['AutoCAD', 'Giám sát thi công', 'Bóc tách khối lượng', 'Excel'],
        lines: [
          'DO VAN HUNG - Civil Site Engineer',
          'Email: hung.do.civil@example.test | Phone: 0918776655',
          'Education: Dai hoc Xay dung Ha Noi - Ky thuat xay dung',
          'Experience: 3 nam kinh nghiem giam sat thi cong ket cau dan dung, AutoCAD, Excel, boc tach khoi luong.',
        ],
        fileName: 'DoVanHung_Civil_cv.pdf',
        status: ExtractionStatus.SUCCESS,
        daysAgo: 12,
      }),
      eduFailed: await createSyntheticCandidate({
        ownerId: hrEdu.id,
        fullName: 'Hồ sơ ảnh scan chưa đọc được (EduSpring)',
        email: null,
        phone: null,
        education: null,
        yearsOfExperience: 0,
        skills: [],
        lines: [],
        fileName: 'Scan_Teacher_CV_01.pdf',
        status: ExtractionStatus.FAILED,
        message: FAILED_EXTRACT_MSG,
        daysAgo: 6,
      }),
      finoraFailed: await createSyntheticCandidate({
        ownerId: hrFinora.id,
        fullName: 'Hồ sơ ảnh scan chưa đọc được (Finora)',
        email: null,
        phone: null,
        education: null,
        yearsOfExperience: 0,
        skills: [],
        lines: [],
        fileName: 'Scan_Finance_CV_02.pdf',
        status: ExtractionStatus.FAILED,
        message: FAILED_EXTRACT_MSG,
        daysAgo: 22,
      }),
    };

    // 9. Run REAL Gemini AI matching evaluations (26 primary PLUS + 6 secondary PLUS/FREE) with bounded concurrency = 2
    console.info(`🤖 Đang chạy AI Matching thật với model ${env.GEMINI_MODEL} (song song tối đa 2 luồng)...`);
    const evaluationEvents: Array<{ reservationOperationKey: string; candidateId: string; jobId: string; targetDate: Date }> = [];
    let callCounter = 0;

    // 9.1 Primary HR: 7 MatchingJobs covering 26 CV-JD evaluations
    const primaryScheduleDays = [13, 12, 10, 9, 7, 4, 1];
    const primaryJobBatches: Array<{
      jdSpec: RealJdSpec;
      job: Awaited<ReturnType<typeof prisma.jobDescription.create>>;
      mJobId: string;
      jobBaseDate: Date;
      itemCount: number;
    }> = [];
    const primaryTasks: Array<() => Promise<void>> = [];

    for (let jdIndex = 0; jdIndex < REAL_JDS.length; jdIndex++) {
      const jdSpec = REAL_JDS[jdIndex];
      const job = realJobsByCode.get(jdSpec.code)!;
      const jobBaseDate = daysAgoDate(primaryScheduleDays[jdIndex], 3);

      const mJob = await prisma.matchingJob.create({
        data: {
          jobDescriptionId: job.id,
          ownerId: hrMain.id,
          companyId: companies.mikiri.id,
          planName: 'PLUS',
          quotaMonth: currentMonth,
          status: MatchingJobStatus.QUEUED,
          total: jdSpec.candidateKeys.length,
          processed: 0,
          failed: 0,
          createdAt: jobBaseDate,
          startedAt: jobBaseDate,
        },
      });

      const items = [];
      for (const cKey of jdSpec.candidateKeys) {
        const cand = realCandidatesByKey.get(cKey)!;
        const item = await prisma.matchingJobItem.create({
          data: {
            jobId: mJob.id,
            candidateId: cand.id,
            status: MatchingItemStatus.PENDING,
          },
        });
        items.push({ item, cand });
      }

      primaryJobBatches.push({ jdSpec, job, mJobId: mJob.id, jobBaseDate, itemCount: items.length });

      for (let i = 0; i < items.length; i++) {
        const { item, cand } = items[i];
        const opKey = `item:${item.id}`;
        const evalTime = new Date(jobBaseDate.getTime() + (i + 1) * 90_000);
        primaryTasks.push(async () => {
          const result = await runEvaluationWithRetry(job, cand, hrMain.id, 'PLUS', companies.mikiri.id, opKey);
          await backdateEvaluationTimestamps(opKey, cand.id, job.id, evalTime);
          await prisma.matchingJobItem.update({
            where: { id: item.id },
            data: { status: MatchingItemStatus.DONE, attempts: 1, finishedAt: evalTime },
          });
          callCounter++;
          evaluationEvents.push({ reservationOperationKey: opKey, candidateId: cand.id, jobId: job.id, targetDate: evalTime });
          console.info(`  ✓ [${callCounter}/32] ${jdSpec.code} × ${cand.fullName} => ${result.score}/100 (PLUS)`);
        });
      }
    }

    await runPool(primaryTasks, 1, 0);

    for (const batch of primaryJobBatches) {
      const doneItems = await prisma.matchingJobItem.findMany({ where: { jobId: batch.mJobId, status: MatchingItemStatus.DONE } });
      await prisma.matchingJobItem.deleteMany({ where: { jobId: batch.mJobId, status: MatchingItemStatus.PENDING } });
      await prisma.matchingJob.update({
        where: { id: batch.mJobId },
        data: {
          status: MatchingJobStatus.COMPLETED,
          total: doneItems.length,
          processed: doneItems.length,
          finishedAt: new Date(batch.jobBaseDate.getTime() + (doneItems.length + 1) * 90_000),
        },
      });
    }

    // 9.2 Secondary PLUS & FREE accounts (6 calls with bounded concurrency = 2)
    const secondaryPlusRuns = [
      { user: hrNova, company: companies.novatech, job: secJobs.novaBackend, candidate: secCandidates.nova1, daysAgo: 8 },
      { user: hrNova, company: companies.novatech, job: secJobs.novaBackend, candidate: secCandidates.nova2, daysAgo: 5 },
      { user: hrLogistics, company: companies.saigonlogistics, job: secJobs.logisticsXnk, candidate: secCandidates.logistics1, daysAgo: 3 },
    ];
    const secondaryFreeRuns = [
      { user: hrRetail, company: companies.vietretail, job: secJobs.retailMarketing, candidate: secCandidates.retail1, daysAgo: 6 },
      { user: hrRetail, company: companies.vietretail, job: secJobs.retailMarketing, candidate: secCandidates.retail2, daysAgo: 2 },
      { user: hrBuild, company: companies.buildaxis, job: secJobs.buildSite, candidate: secCandidates.build1, daysAgo: 4 },
    ];

    const secondaryTasks: Array<() => Promise<void>> = [
      ...secondaryPlusRuns.map((run) => async () => {
        const t = daysAgoDate(run.daysAgo, 4);
        const mJob = await prisma.matchingJob.create({
          data: {
            jobDescriptionId: run.job.id,
            ownerId: run.user.id,
            companyId: run.company.id,
            planName: 'PLUS',
            quotaMonth: currentMonth,
            status: MatchingJobStatus.COMPLETED,
            total: 1,
            processed: 1,
            failed: 0,
            createdAt: t,
            startedAt: t,
            finishedAt: new Date(t.getTime() + 60_000),
          },
        });
        const item = await prisma.matchingJobItem.create({
          data: { jobId: mJob.id, candidateId: run.candidate.id, status: MatchingItemStatus.DONE, attempts: 1, finishedAt: t },
        });
        const opKey = `item:${item.id}`;
        const result = await runEvaluationWithRetry(run.job, run.candidate, run.user.id, 'PLUS', run.company.id, opKey);
        await backdateEvaluationTimestamps(opKey, run.candidate.id, run.job.id, t);
        callCounter++;
        evaluationEvents.push({ reservationOperationKey: opKey, candidateId: run.candidate.id, jobId: run.job.id, targetDate: t });
        console.info(`  ✓ [${callCounter}/32] ${run.company.name} × ${run.candidate.fullName} => ${result.score}/100 (PLUS)`);
      }),
      ...secondaryFreeRuns.map((run) => async () => {
        const t = daysAgoDate(run.daysAgo, 5);
        const reqKey = `${run.user.id}:/run:${crypto.randomUUID()}`;
        const opKey = `${reqKey}:${run.candidate.id}`;
        const result = await runEvaluationWithRetry(run.job, run.candidate, run.user.id, 'FREE', run.company.id, opKey);
        await prisma.matchingRequest.create({
          data: {
            key: reqKey,
            hash: crypto.createHash('sha256').update(reqKey).digest('hex'),
            statusCode: 200,
            response: { success: true, data: [{ jobDescriptionId: run.job.id, candidateId: run.candidate.id }] },
            createdAt: t,
          },
        });
        await backdateEvaluationTimestamps(opKey, run.candidate.id, run.job.id, t);
        callCounter++;
        evaluationEvents.push({ reservationOperationKey: opKey, candidateId: run.candidate.id, jobId: run.job.id, targetDate: t });
        console.info(`  ✓ [${callCounter}/32] ${run.company.name} × ${run.candidate.fullName} => ${result.score}/100 (FREE)`);
      }),
    ];

    await runPool(secondaryTasks, 1, 0);

    // 10. Additional MatchingJob edge-case history (CANCELLED, SKIPPED FAILED CV, FAILED job)
    const jd01 = realJobsByCode.get('JD01')!;
    const cancelTime = daysAgoDate(6, 7);
    const cancelledJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: jd01.id,
        ownerId: hrMain.id,
        companyId: companies.mikiri.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.CANCELLED,
        total: 2,
        processed: 2,
        failed: 0,
        cancelRequested: true,
        errorMessage: null,
        createdAt: cancelTime,
        startedAt: cancelTime,
        finishedAt: new Date(cancelTime.getTime() + 45_000),
      },
    });
    await prisma.matchingJobItem.createMany({
      data: [
        {
          jobId: cancelledJob.id,
          candidateId: realCandidatesByKey.get('DangHoaiNam')!.id,
          status: MatchingItemStatus.SKIPPED,
          attempts: 0,
          errorCode: 'JOB_CANCELLED',
          errorMessage: 'Đã hủy theo yêu cầu',
          finishedAt: new Date(cancelTime.getTime() + 45_000),
        },
        {
          jobId: cancelledJob.id,
          candidateId: realCandidatesByKey.get('LeMinhChau')!.id,
          status: MatchingItemStatus.SKIPPED,
          attempts: 0,
          errorCode: 'JOB_CANCELLED',
          errorMessage: 'Đã hủy theo yêu cầu',
          finishedAt: new Date(cancelTime.getTime() + 45_000),
        },
      ],
    });

    const skipJobTime = daysAgoDate(5, 3);
    const eduSkipJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: secJobs.eduTeacher.id,
        ownerId: hrEdu.id,
        companyId: companies.eduspring.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.COMPLETED,
        total: 1,
        processed: 1,
        failed: 0,
        createdAt: skipJobTime,
        finishedAt: skipJobTime,
      },
    });
    await prisma.matchingJobItem.create({
      data: {
        jobId: eduSkipJob.id,
        candidateId: secCandidates.eduFailed.id,
        status: MatchingItemStatus.SKIPPED,
        attempts: 0,
        errorCode: 'CANDIDATE_NOT_READABLE',
        errorMessage: 'CV chưa đọc được nội dung nên không thể chấm điểm',
        finishedAt: skipJobTime,
      },
    });

    const failedJobTime = daysAgoDate(2, 6);
    const failedJob = await prisma.matchingJob.create({
      data: {
        jobDescriptionId: secJobs.novaBackend.id,
        ownerId: hrNova.id,
        companyId: companies.novatech.id,
        planName: 'PLUS',
        quotaMonth: currentMonth,
        status: MatchingJobStatus.FAILED,
        total: 1,
        processed: 1,
        failed: 1,
        errorMessage: 'Có hồ sơ chấm điểm thất bại do giới hạn tần suất tạm thời của nhà cung cấp AI',
        createdAt: failedJobTime,
        startedAt: failedJobTime,
        finishedAt: new Date(failedJobTime.getTime() + 20_000),
      },
    });
    await prisma.matchingJobItem.create({
      data: {
        jobId: failedJob.id,
        candidateId: secCandidates.nova2.id,
        status: MatchingItemStatus.FAILED,
        attempts: 2,
        errorCode: 'AI_RATE_LIMITED',
        errorMessage: 'Nhà cung cấp AI đang quá tải, vui lòng thử lại sau ít phút.',
        finishedAt: new Date(failedJobTime.getTime() + 20_000),
      },
    });

    // 11. Historical multi-day usage + RELEASED + UNKNOWN reconciliation rows (within current wallets' period)
    console.info('📊 Đang bổ sung lịch sử token 30 ngày, đối soát UNKNOWN và audit log cho Admin...');
    const historicalSettledSpecs = [
      { userId: hrSupport.id, companyId: companies.mikiri.id, daysAgo: 19, input: 1620, output: 1180, thinking: 320 },
      { userId: hrSupport.id, companyId: companies.mikiri.id, daysAgo: 15, input: 1710, output: 1240, thinking: 290 },
      { userId: hrNovaRecruiter.id, companyId: companies.novatech.id, daysAgo: 17, input: 1540, output: 1120, thinking: 260 },
      { userId: hrNova.id, companyId: companies.novatech.id, daysAgo: 14, input: 1850, output: 1310, thinking: 340 },
      { userId: hrLogistics.id, companyId: companies.saigonlogistics.id, daysAgo: 18, input: 1480, output: 1090, thinking: 220 },
      { userId: hrLogistics.id, companyId: companies.saigonlogistics.id, daysAgo: 11, input: 1590, output: 1150, thinking: 280 },
      { userId: hrEdu.id, companyId: companies.eduspring.id, daysAgo: 16, input: 1680, output: 1210, thinking: 310 },
      { userId: hrEdu.id, companyId: companies.eduspring.id, daysAgo: 9, input: 1740, output: 1290, thinking: 350 },
      { userId: hrRetail.id, companyId: companies.vietretail.id, daysAgo: 17, input: 1120, output: 460, thinking: 0 },
      { userId: hrBuild.id, companyId: companies.buildaxis.id, daysAgo: 15, input: 1180, output: 490, thinking: 0 },
      { userId: hrFinora.id, companyId: companies.finora.id, daysAgo: 19, input: 1610, output: 1140, thinking: 240 },
      { userId: hrFinora.id, companyId: companies.finora.id, daysAgo: 14, input: 1690, output: 1200, thinking: 270 },
    ];

    const freeTierSnapshot: Prisma.InputJsonValue = {
      model: env.GEMINI_MODEL,
      currency: 'USD',
      unit: 1000000,
      input: '0',
      output: '0',
      thinking: '0',
      billingMode: 'FREE',
      source: 'FREE_TIER',
    };

    for (let idx = 0; idx < historicalSettledSpecs.length; idx++) {
      const h = historicalSettledSpecs[idx];
      const wallet = walletByUserId.get(h.userId)!;
      const t = daysAgoDate(h.daysAgo, 4);
      const total = h.input + h.output + h.thinking;
      const holdAmount = total + 6000;
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:settled:${idx + 1}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: holdAmount,
          status: 'SETTLED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenWallet.update({
        where: { id: wallet.id },
        data: { used: { increment: total } },
      });
      await prisma.tokenLedger.createMany({
        data: [
          {
            walletId: wallet.id,
            kind: 'RESERVE',
            amount: holdAmount,
            operationKey: `reserve:${res.id}`,
            reason: 'Tạm giữ trước khi gọi AI',
            createdAt: t,
          },
          {
            walletId: wallet.id,
            kind: 'SETTLE',
            amount: total,
            operationKey: `settle:${res.id}`,
            reason: 'Quyết toán token thực tế do provider trả về',
            createdAt: t,
          },
          {
            walletId: wallet.id,
            kind: 'RELEASE',
            amount: holdAmount,
            operationKey: `release:${res.id}`,
            reason: 'Giải phóng tạm giữ sau quyết toán',
            createdAt: t,
          },
        ],
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: h.userId,
          companyId: h.companyId,
          model: env.GEMINI_MODEL,
          inputTokens: h.input,
          outputTokens: h.output,
          thinkingTokens: h.thinking,
          totalTokens: total,
          actualCostUsd: new Prisma.Decimal(0),
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: true,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }

    // 2 RELEASED reservations (canceled/failed before execution)
    for (const userId of [hrMain.id, hrNova.id]) {
      const wallet = walletByUserId.get(userId)!;
      const t = daysAgoDate(3, 6);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:released:${userId}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: 9500,
          status: 'RELEASED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenLedger.createMany({
        data: [
          { walletId: wallet.id, kind: 'RESERVE', amount: 9500, operationKey: `reserve:${res.id}`, reason: 'Tạm giữ trước khi gọi AI', createdAt: t },
          { walletId: wallet.id, kind: 'RELEASE', amount: 9500, operationKey: `release:${res.id}`, reason: 'Provider từ chối yêu cầu trước khi tạo nội dung', createdAt: t },
        ],
      });
    }

    // 2 UNKNOWN reservations (ready for Admin reconciliation UI)
    for (const entry of [
      { userId: hrNova.id, companyId: companies.novatech.id, amount: 9800, minutesAgo: 35 },
      { userId: hrLogistics.id, companyId: companies.saigonlogistics.id, amount: 9600, minutesAgo: 25 },
    ]) {
      const wallet = walletByUserId.get(entry.userId)!;
      const t = new Date(Date.now() - entry.minutesAgo * 60_000);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:unknown:${entry.userId}:${crypto.randomUUID()}`,
          walletId: wallet.id,
          amount: entry.amount,
          status: 'UNKNOWN',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.tokenWallet.update({
        where: { id: wallet.id },
        data: { reserved: { increment: entry.amount } },
      });
      await prisma.tokenLedger.create({
        data: {
          walletId: wallet.id,
          kind: 'RESERVE',
          amount: entry.amount,
          operationKey: `reserve:${res.id}`,
          reason: 'Tạm giữ trước khi gọi AI',
          createdAt: t,
        },
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: entry.userId,
          companyId: entry.companyId,
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: false,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }

    // Also add 3 older settled ai_usage points inside prev wallets (-28d..-23d) so 30d/all charts span ~4 weeks
    const oldCycleSpecs = [
      { walletId: hrMainPrevWallet.id, userId: hrMain.id, companyId: companies.mikiri.id, daysAgo: 28, input: 1820, output: 1350, thinking: 410 },
      { walletId: hrMainPrevWallet.id, userId: hrMain.id, companyId: companies.mikiri.id, daysAgo: 25, input: 1940, output: 1410, thinking: 380 },
      { walletId: hrNovaPrevWallet.id, userId: hrNova.id, companyId: companies.novatech.id, daysAgo: 26, input: 1710, output: 1220, thinking: 320 },
    ];
    for (let i = 0; i < oldCycleSpecs.length; i++) {
      const o = oldCycleSpecs[i];
      const t = daysAgoDate(o.daysAgo, 3);
      const res = await prisma.tokenReservation.create({
        data: {
          operationKey: `hist:prevcycle:${i + 1}:${crypto.randomUUID()}`,
          walletId: o.walletId,
          amount: 10000,
          status: 'SETTLED',
          model: env.GEMINI_MODEL,
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          createdAt: t,
          updatedAt: t,
        },
      });
      await prisma.aiUsage.create({
        data: {
          reservationId: res.id,
          enterpriseId: o.userId,
          companyId: o.companyId,
          model: env.GEMINI_MODEL,
          inputTokens: o.input,
          outputTokens: o.output,
          thinkingTokens: o.thinking,
          totalTokens: o.input + o.output + o.thinking,
          actualCostUsd: new Prisma.Decimal(0),
          priceVersion: 'gemini-free-tier',
          priceSnapshot: freeTierSnapshot,
          succeeded: true,
          createdAt: t,
          day: vietnamDay(t),
        },
      });
    }

    // 12. Seed 7 BillingAudit entries (total 8 including migration row if present)
    const auditSpecs = [
      {
        action: 'COMPANY_PLAN',
        targetId: companies.mikiri.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'YEARLY' },
        reason: 'Kích hoạt gói PLUS theo năm cho doanh nghiệp tuyển dụng trọng điểm Mikiri Talent Hub',
        daysAgo: 22,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: companies.novatech.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        reason: 'Nâng cấp gói PLUS theo tháng theo hợp đồng dịch vụ tháng 11',
        daysAgo: 20,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: companies.saigonlogistics.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'YEARLY' },
        reason: 'Gia hạn gói PLUS chu kỳ năm cho Saigon Logistics JSC',
        daysAgo: 18,
      },
      {
        action: 'PRICE_VERSION',
        targetId: env.GEMINI_MODEL,
        before: { inputUsd: '0.10000000', outputUsd: '0.40000000' },
        after: { model: env.GEMINI_MODEL, inputUsd: 0.075, outputUsd: 0.3, thinkingUsd: 0.3 },
        reason: 'Cập nhật biểu giá tham chiếu theo bảng giá Gemini mới nhất',
        daysAgo: 12,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: companies.eduspring.id,
        before: { plan: 'FREE', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        reason: 'Duyệt gói PLUS thử nghiệm 30 ngày cho EduSpring Academy',
        daysAgo: 9,
      },
      {
        action: 'PLAN_CONFIG',
        targetId: 'PLUS',
        before: { tokenLimit: 2000000, maxCvPerCall: 100 },
        after: { tokenLimit: 3000000, maxCvPerCall: 200, cycleDays: 30, maxOutputTokens: 8192 },
        reason: 'Mở rộng hạn mức gói PLUS lên 3.000.000 token mỗi chu kỳ cho tuyển dụng hàng loạt',
        daysAgo: 6,
      },
      {
        action: 'COMPANY_PLAN',
        targetId: companies.finora.id,
        before: { plan: 'PLUS', billingCycle: 'MONTHLY' },
        after: { plan: 'PLUS', billingCycle: 'MONTHLY', expiredNote: true },
        reason: 'Ghi nhận hết hạn chu kỳ gói PLUS đối với Finora Capital',
        daysAgo: 5,
      },
    ];
    for (let i = 0; i < auditSpecs.length; i++) {
      const a = auditSpecs[i];
      await prisma.billingAudit.create({
        data: {
          actorId: adminUser.id,
          action: a.action,
          targetId: a.targetId,
          before: a.before,
          after: a.after,
          reason: a.reason,
          operationKey: `admin:${adminUser.id}:seed-audit-${i + 1}`,
          createdAt: daysAgoDate(a.daysAgo),
        },
      });
    }

    // 13. Seed 5 IdempotencyKeys + 3 extra MatchingRequests (6 total MatchingRequests)
    for (let i = 1; i <= 5; i++) {
      await prisma.idempotencyKey.create({
        data: {
          key: crypto.randomUUID(),
          endpoint: '/api/candidates/upload',
          requestHash: crypto.createHash('sha256').update(`upload-seed-${i}`).digest('hex'),
          statusCode: 200,
          responseBody: { success: true, message: 'Đã xử lý tải lên thành công' },
          createdAt: daysAgoDate(i * 2),
          expiresAt: daysFromNow(1),
        },
      });
    }

    for (let i = 1; i <= 3; i++) {
      const key = `${hrSupport.id}:/run:${crypto.randomUUID()}`;
      await prisma.matchingRequest.create({
        data: {
          key,
          hash: crypto.createHash('sha256').update(key).digest('hex'),
          statusCode: 200,
          response: { success: true, data: [{ jobDescriptionId: secJobs.novaSupport.id }] },
          createdAt: daysAgoDate(i + 1),
        },
      });
    }

    // Keep company monthlyUsed / quotaMonth synchronized with current month succeeded usage
    for (const company of Object.values(companies)) {
      const succeededCount = await prisma.aiUsage.count({
        where: { companyId: company.id, succeeded: true, day: { gte: currentMonth } },
      });
      await prisma.company.update({
        where: { id: company.id },
        data: { quotaMonth: currentMonth, monthlyUsed: succeededCount },
      });
    }

    console.info(`✅ Hoàn tất khởi tạo dữ liệu thử nghiệm cho ${DRIVE_CVS.length + 9} CV, ${REAL_JDS.length + 7} JD, ${evaluationEvents.length} đánh giá AI thật!`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi chạy seed-full-demo:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
