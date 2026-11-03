/**
 * Script seed ứng viên phục vụ kiểm thử FR3
 * Cách chạy: npm run seed:candidates -- --count 500
 * CHỈ CHẠY TRONG MÔI TRƯỜNG DEVELOPMENT / TEST.
 */
import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { skillNormalizer } from '../modules/skills/skill-dictionary.js';
import { normalizeForSearch } from '../common/utils/normalize-for-search.js';
import { ExtractionStatus } from '@prisma/client';

if (env.NODE_ENV === 'production') {
  console.error('❌ LỖI BẢO MẬT: Script seed ứng viên chỉ được phép chạy trong môi trường development / test!');
  process.exit(1);
}

function parseCountArg(): number {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    const val = parseInt(args[countIdx + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 500;
}

const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const middleNames = ['Văn', 'Thị', 'Hoàng', 'Hữu', 'Minh', 'Quốc', 'Đức', 'Tuấn', 'Ngọc', 'Thu', 'Thanh', 'Đình', 'Hải', 'Quang'];
const firstNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hiếu', 'Hoàng', 'Huy', 'Hưng', 'Khoa', 'Kiên', 'Linh', 'Long', 'Mai', 'Nam', 'Nghĩa', 'Ngọc', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Tâm', 'Thảo', 'Thịnh', 'Tiến', 'Trang', 'Trung', 'Tuấn', 'Tùng', 'Việt', 'Vinh', 'Vũ', 'Xuân', 'Yên'];
const universities = [
  'Đại học Bách Khoa Hà Nội',
  'Đại học Quốc Gia TP.HCM',
  'Đại học Bách Khoa TP.HCM',
  'Đại học Công nghệ - ĐHQGHN',
  'Đại học FPT',
  'Đại học Sư phạm Kỹ thuật TP.HCM',
  'Học viện Công nghệ Bưu chính Viễn thông',
  'Đại học Khoa học Tự nhiên',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomSubarray<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function main() {
  const count = parseCountArg();
  console.info(`🌱 Bắt đầu tạo ${count} hồ sơ ứng viên mẫu cho môi trường ${env.NODE_ENV}...`);

  // Tìm tài khoản sở hữu dữ liệu (ưu tiên ENTERPRISE, sau đó ADMIN)
  let owner = await prisma.user.findFirst({
    where: { role: 'ENTERPRISE', isActive: true },
    select: { id: true, email: true },
  });

  if (!owner) {
    owner = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, email: true },
    });
  }

  if (!owner) {
    console.error('❌ Không tìm thấy người dùng nào trong cơ sở dữ liệu để gán quyền sở hữu. Vui lòng chạy npm run prisma:seed trước.');
    process.exit(1);
  }

  console.info(`👤 Dữ liệu sẽ thuộc về tài khoản: ${owner.email} (${owner.id})`);

  const canonicalSkills = skillNormalizer.getAllCanonicalSkills();

  // Đảm bảo ít nhất một ứng viên tên "Nguyễn Văn An" theo đúng US-03 Gherkin
  const records = [];

  for (let i = 0; i < count; i++) {
    const isFirstRecord = i === 0;
    const fullName = isFirstRecord
      ? 'Nguyễn Văn An'
      : `${pickRandom(lastNames)} ${pickRandom(middleNames)} ${pickRandom(firstNames)}`;

    const emailSlug = normalizeForSearch(fullName).replace(/\s+/g, '.');
    const email = `${emailSlug}.${i + 1}@example.com`;
    const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
    const yearsOfExperience = isFirstRecord ? 4 : Math.floor(Math.random() * 11); // 0-10
    const education = pickRandom(universities);

    // Kỹ năng
    let skills: string[];
    if (isFirstRecord) {
      skills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'];
    } else if (i === 1) {
      // Ứng viên thứ 2 có cả Node.js và Go
      skills = ['Node.js', 'Go', 'Docker', 'PostgreSQL'];
    } else if (i === 2) {
      // Ứng viên thứ 3 chỉ có Go
      skills = ['Go', 'Kubernetes', 'Linux'];
    } else if (i === 3) {
      // Ứng viên thứ 4 chỉ có Node.js
      skills = ['Node.js', 'Express.js', 'MongoDB'];
    } else {
      const numSkills = Math.floor(Math.random() * 5) + 2; // 2-6 skills
      skills = pickRandomSubarray(canonicalSkills, numSkills);
    }

    // Trạng thái trích xuất (đa dạng: SUCCESS ~88%, WARNING ~8%, FAILED ~4%)
    let extractionStatus: ExtractionStatus = ExtractionStatus.SUCCESS;
    let extractionMessage: string | null = null;
    let rawText = '';

    if (!isFirstRecord && i % 25 === 0) {
      // FAILED
      extractionStatus = ExtractionStatus.FAILED;
      extractionMessage = 'Không thể đọc nội dung văn bản. Vui lòng kiểm tra file không cài mật khẩu hoặc file ảnh scan chưa được hỗ trợ.';
      rawText = '';
    } else if (!isFirstRecord && i % 12 === 0) {
      // WARNING
      extractionStatus = ExtractionStatus.WARNING;
      extractionMessage = 'Đã đọc nội dung nhưng chưa tìm thấy số điện thoại.';
      rawText = `HỒ SƠ ỨNG VIÊN: ${fullName}\n` +
        `Trình độ: Tốt nghiệp ${education}\n` +
        `Kinh nghiệm làm việc: ${yearsOfExperience} năm trong lĩnh vực phần mềm.\n` +
        `Kỹ năng chuyên môn: ${skills.join(', ')}.\n` +
        `Mục tiêu nghề nghiệp: Mong muốn phát triển chuyên sâu về hệ thống phần mềm và kiến trúc microservices.`;
    } else {
      // SUCCESS
      extractionStatus = ExtractionStatus.SUCCESS;
      const roleDescription = isFirstRecord
        ? 'Lập trình viên ReactJS và NodeJS'
        : `Lập trình viên chuyên về ${skills.slice(0, 2).join(' và ')}`;

      rawText = `HỒ SƠ ỨNG VIÊN: ${fullName}\n` +
        `Email: ${email} | Số điện thoại: ${phone}\n` +
        `Học vấn: ${education}, chuyên ngành Công nghệ thông tin.\n` +
        `Kinh nghiệm: ${yearsOfExperience} năm làm việc thực tế với vai trò ${roleDescription}.\n` +
        `Tóm tắt năng lực: Đã tham gia phát triển nhiều dự án web application, nắm vững kiến trúc backend, cơ sở dữ liệu và tối ưu hiệu năng.\n` +
        `Công nghệ sử dụng thành thạo: ${skills.join(', ')}.\n` +
        `Dự án tiêu biểu: Xây dựng hệ thống quản lý dữ liệu lớn, triển khai hạ tầng đám mây và tối ưu hóa truy vấn cơ sở dữ liệu quan hệ.\n` +
        `Chứng chỉ và kỹ năng mềm: Đọc hiểu tài liệu kỹ thuật tốt, kỹ năng giải quyết vấn đề và làm việc nhóm Agile/Scrum.`;
    }

    const safeSlug = normalizeForSearch(fullName).replace(/\s+/g, '_');
    const fileName = `CV_${safeSlug}_${i + 1}.pdf`;
    const fileUrl = `/uploads/seed-cv-${i + 1}.pdf`;
    const searchText = normalizeForSearch(`${fullName} ${rawText}`);

    records.push({
      fullName,
      email: extractionStatus === ExtractionStatus.WARNING && i % 24 === 0 ? null : email,
      phone: extractionStatus === ExtractionStatus.WARNING ? null : phone,
      rawText,
      searchText,
      skills,
      yearsOfExperience,
      education,
      fileName,
      fileUrl,
      extractionStatus,
      extractionMessage,
      contentHash: crypto.createHash('sha256').update(`${fullName}-${i}`).digest('hex'),
      ownerId: owner.id,
      uploadedById: owner.id,
    });
  }

  // Chèn theo lô 100 bản ghi
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const result = await prisma.candidate.createMany({
      data: batch,
    });
    inserted += result.count;
    console.info(`  ✓ Đã chèn ${inserted}/${count} ứng viên...`);
  }

  console.info(`🎉 Hoàn tất seed ${inserted} ứng viên thành công vào cơ sở dữ liệu!`);
}

main()
  .catch((err) => {
    console.error('❌ Lỗi khi chạy seed candidates:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
