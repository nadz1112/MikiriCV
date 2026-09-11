import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';
import { ExtractedCandidateInfo } from '../types/index.js';

// Danh sách kỹ năng phổ biến để đối soát sơ bộ
const COMMON_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'golang', 'go', 'php', 'ruby',
  'react', 'reactjs', 'vue', 'vuejs', 'angular', 'nextjs', 'nodejs', 'express', 'nest', 'nestjs',
  'html', 'css', 'tailwind', 'bootstrap', 'sass',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'oracle',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'git', 'linux',
  'restful api', 'graphql', 'grpc', 'microservices', 'agile', 'scrum'
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

  // 2. Trích xuất Số điện thoại (chuẩn định dạng Việt Nam & quốc tế cơ bản)
  const phoneRegex = /(?:\+84|0)(?:3|5|7|8|9|1[2689])[0-9]{8}\b/;
  const phoneMatch = cleanText.replace(/[\s.-]/g, '').match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 3. Trích xuất Họ tên (Ưu tiên từ tên file nếu có dạng CV_Nguyen_Van_A hoặc từ dòng đầu tiên)
  let fullName = '';
  const baseName = path.parse(originalName).name.replace(/[-_]/g, ' ');
  const cleanBaseName = baseName.replace(/^(cv|resume|curriculum vitae)\s*/i, '').trim();

  if (cleanBaseName && cleanBaseName.length >= 3 && cleanBaseName.length <= 50) {
    fullName = cleanBaseName;
  } else {
    const firstLines = cleanText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 2 && line.length < 40 && !line.includes('@'));
    fullName = firstLines[0] || 'Ứng viên chưa rõ tên';
  }

  // 4. Trích xuất số năm kinh nghiệm sơ bộ
  let yearsOfExperience = 0;
  const expPatterns = [
    /(\d+)\+?\s*(?:năm|years?)\s*(?:kinh nghiệm|experience)/i,
    /(?:kinh nghiệm|experience)\s*:?\s*(\d+)\+?\s*(?:năm|years?)/i,
  ];

  for (const pattern of expPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      yearsOfExperience = Math.min(parseInt(match[1], 10), 30);
      break;
    }
  }

  // 5. Nhận diện sơ bộ kỹ năng
  const lowerText = cleanText.toLowerCase();
  const detectedSkills = COMMON_SKILLS.filter((skill) => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });

  return {
    fullName,
    email,
    phone,
    yearsOfExperience,
    skills: Array.from(new Set(detectedSkills)),
    education: null,
    rawText,
  };
}
