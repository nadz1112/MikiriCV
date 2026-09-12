import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';
import { ExtractedCandidateInfo } from '../types/index.js';

// Danh mục kỹ năng và các từ đồng nghĩa (alias mapping)
const SKILL_ALIASES: Record<string, string> = {
  // Frontend
  react: 'react',
  reactjs: 'react',
  'react.js': 'react',
  vue: 'vue.js',
  vuejs: 'vue.js',
  'vue.js': 'vue.js',
  angular: 'angular',
  angularjs: 'angular',
  nextjs: 'next.js',
  'next.js': 'next.js',
  nuxtjs: 'nuxt.js',
  'nuxt.js': 'nuxt.js',
  html: 'html',
  html5: 'html',
  css: 'css',
  css3: 'css',
  tailwind: 'tailwindcss',
  tailwindcss: 'tailwindcss',
  bootstrap: 'bootstrap',
  sass: 'sass',
  scss: 'sass',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',

  // Backend
  nodejs: 'node.js',
  'node.js': 'node.js',
  express: 'express',
  expressjs: 'express',
  nest: 'nestjs',
  nestjs: 'nestjs',
  python: 'python',
  django: 'django',
  fastapi: 'fastapi',
  flask: 'flask',
  java: 'java',
  'spring boot': 'spring boot',
  springboot: 'spring boot',
  'c#': 'c#',
  '.net': '.net',
  dotnet: '.net',
  'c++': 'c++',
  golang: 'go',
  go: 'go',
  php: 'php',
  laravel: 'laravel',
  ruby: 'ruby',
  rails: 'rails',

  // Database
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  mongodb: 'mongodb',
  mongo: 'mongodb',
  redis: 'redis',
  sqlite: 'sqlite',
  oracle: 'oracle',
  prisma: 'prisma',

  // Cloud & DevOps
  docker: 'docker',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  aws: 'aws',
  azure: 'azure',
  gcp: 'gcp',
  'ci/cd': 'ci/cd',
  cicd: 'ci/cd',
  git: 'git',
  github: 'git',
  gitlab: 'git',
  linux: 'linux',

  // Architecture & Methods
  'restful api': 'restful api',
  restapi: 'restful api',
  graphql: 'graphql',
  grpc: 'grpc',
  microservices: 'microservices',
  agile: 'agile',
  scrum: 'scrum',
};

// Danh sách các tiêu đề/câu hành chính cần lọc bỏ khi tìm tên ứng viên
const HEADER_NOISE_PATTERNS = [
  /cộng\s+hòa\s+xã\s+hội\s+chủ\s+nghĩa\s+việt\s+nam/i,
  /độc\s+lập\s+-\s+tự\s+do\s+-\s+hạnh\s+phúc/i,
  /curriculum\s+vitae/i,
  /resume/i,
  /hồ\s+sơ\s+xin\s+việc/i,
  /sơ\s+yếu\s+lý\s+lịch/i,
  /thông\s+tin\s+cá\s+nhân/i,
  /bản\s+tự\s+thuật/i,
  /profile/i,
  /personal\s+information/i,
];

export async function extractTextFromFile(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(fileBuffer);
    return data.text || '';
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
  }

  throw new Error(`Định dạng tệp không được hỗ trợ: ${ext}`);
}

export function parseCandidateInfo(rawText: string, originalName: string): ExtractedCandidateInfo {
  const cleanText = rawText.replace(/\r\n/g, '\n');

  // 1. Trích xuất Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = cleanText.match(emailRegex);
  const email = emailMatch ? emailMatch[0].toLowerCase() : null;

  // 2. Trích xuất Số điện thoại (chuẩn định dạng Việt Nam & quốc tế)
  const phoneRegex = /(?:\+84|0)(?:3|5|7|8|9|1[2689])[0-9]{8}\b/;
  const phoneMatch = cleanText.replace(/[\s.-]/g, '').match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 3. Trích xuất Họ tên
  let fullName = '';
  const baseName = path.parse(originalName).name.replace(/[-_]/g, ' ');
  const cleanBaseName = baseName.replace(/^(cv|resume|curriculum vitae|ho so)\s*/i, '').trim();

  if (cleanBaseName && cleanBaseName.length >= 3 && cleanBaseName.length <= 40 && !cleanBaseName.includes('@')) {
    fullName = cleanBaseName;
  } else {
    // Quét các dòng đầu tiên để tìm tên, bỏ qua các dòng tiêu đề rác
    const candidateLines = cleanText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (!line || line.length < 3 || line.length > 40 || line.includes('@') || line.includes('http')) {
          return false;
        }
        return !HEADER_NOISE_PATTERNS.some((pattern) => pattern.test(line));
      });

    // Ưu tiên dòng có dạng chữ In Hoa hoặc từ 2-4 từ không chứa số
    const nameLine = candidateLines.find((line) => {
      const words = line.split(/\s+/);
      const hasNumbers = /\d/.test(line);
      return words.length >= 2 && words.length <= 5 && !hasNumbers;
    });

    fullName = nameLine || candidateLines[0] || 'Ứng viên chưa rõ tên';
  }

  // 4. Trích xuất số năm kinh nghiệm
  let yearsOfExperience = 0;

  // Pattern 1: Tìm câu ghi rõ "X năm kinh nghiệm"
  const directExpPatterns = [
    /(\d+)\+?\s*(?:năm|years?)\s*(?:kinh nghiệm|experience)/i,
    /(?:kinh nghiệm|experience)\s*:?\s*(\d+)\+?\s*(?:năm|years?)/i,
  ];

  for (const pattern of directExpPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      yearsOfExperience = Math.min(parseInt(match[1], 10), 30);
      break;
    }
  }

  // Pattern 2: Nếu không thấy ghi rõ, phân tích các khoảng năm (ví dụ: 2020 - 2023, 2021 - Present)
  if (yearsOfExperience === 0) {
    const currentYear = new Date().getFullYear();
    const yearRangeRegex = /(20\d{2})\s*[-–]\s*(20\d{2}|nay|hiện tại|present)/gi;
    let totalYearsFromRanges = 0;
    let match: RegExpExecArray | null;

    while ((match = yearRangeRegex.exec(cleanText)) !== null) {
      const startYear = parseInt(match[1], 10);
      const endYearStr = match[2].toLowerCase();
      const endYear = /^(nay|hiện tại|present)$/.test(endYearStr) ? currentYear : parseInt(endYearStr, 10);

      if (endYear >= startYear && startYear >= 1990) {
        totalYearsFromRanges += Math.max(1, endYear - startYear);
      }
    }

    if (totalYearsFromRanges > 0) {
      yearsOfExperience = Math.min(totalYearsFromRanges, 30);
    }
  }

  // 5. Nhận diện kỹ năng dựa trên từ điển và alias
  const lowerText = cleanText.toLowerCase();
  const matchedSkillSet = new Set<string>();

  for (const [alias, standardName] of Object.entries(SKILL_ALIASES)) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;.:/()[\\]-])${escapedAlias}(?:$|[\\s,;.:/()[\\]-])`, 'i');
    if (regex.test(lowerText)) {
      matchedSkillSet.add(standardName.toLowerCase());
    }
  }

  return {
    fullName,
    email,
    phone,
    yearsOfExperience,
    skills: Array.from(matchedSkillSet),
    education: null,
    rawText,
  };
}
