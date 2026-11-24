export interface JdRequirement {
  requirement: string;
  priority: 'required' | 'preferred';
  evidence: string;
}

export interface JdAnalysis {
  title: string;
  level: 'intern' | 'junior' | 'middle' | 'senior' | 'lead' | 'unspecified';
  requiredSkills: string[];
  preferredSkills: string[];
  minimumExperience: number;
  responsibilities: string[];
  educationAndCertification: string[];
  softSkills: string[];
  requirements: JdRequirement[];
  uncertainty: string[];
}

function redactPii(value: string): string {
  return value
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email đã ẩn]')
    .replace(/(?:\+84|0084|0)(?:[ .()-]*\d){9,11}/g, '[số điện thoại đã ẩn]');
}

export function analyzeJobDescription(job: {
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  minExperience: number;
}) {
  const text = `${job.title}\n${job.description}`;
  const lower = text.toLocaleLowerCase('vi-VN');
  let level: JdAnalysis['level'] = 'unspecified';
  if (/(intern|thực tập)/i.test(lower)) level = 'intern';
  else if (/(junior|fresher)/i.test(lower)) level = 'junior';
  else if (/(middle|mid-level)/i.test(lower)) level = 'middle';
  else if (/(lead|principal|staff|architect|trưởng nhóm)/i.test(lower)) level = 'lead';
  else if (/senior/i.test(lower)) level = 'senior';

  const responsibilities = redactPii(job.description)
    .split(/\n|[;.]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 20)
    .slice(0, 12);
  const softSkills = ['giao tiếp', 'communication', 'làm việc nhóm', 'teamwork', 'giải quyết vấn đề', 'problem solving', 'lãnh đạo', 'leadership', 'thích nghi', 'adaptability', 'tự học', 'self-learning']
    .filter((skill) => lower.includes(skill));
  const education = ['bằng', 'đại học', 'cao đẳng', 'chứng chỉ', 'ielts', 'toeic', 'ngoại ngữ']
    .filter((term) => lower.includes(term))
    .map((term) => `CV/JD đề cập ${term}`);

  const requiredSkills = [...new Set(job.requiredSkills)];
  const preferredSkills = [...new Set(job.preferredSkills ?? [])];
  const requirements: JdRequirement[] = [
    ...requiredSkills.map((requirement) => ({ requirement, priority: 'required' as const, evidence: `JD requiredSkills: ${requirement}` })),
    ...preferredSkills.map((requirement) => ({ requirement, priority: 'preferred' as const, evidence: `JD preferredSkills: ${requirement}` })),
  ];

  return {
    title: job.title,
    level,
    requiredSkills,
    preferredSkills,
    minimumExperience: job.minExperience,
    responsibilities,
    educationAndCertification: education,
    softSkills,
    requirements,
    uncertainty: job.description.trim().length < 30 ? ['Mô tả JD ngắn, một số yêu cầu có thể chưa rõ.'] : [],
  } satisfies JdAnalysis;
}
