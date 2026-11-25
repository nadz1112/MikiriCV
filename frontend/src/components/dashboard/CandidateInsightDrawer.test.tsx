// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CandidateInsightDrawer } from './CandidateInsightDrawer';
import type { Candidate, MatchResult } from '../../types';

afterEach(cleanup);

const candidate: Candidate = {
  id: 'cand-1',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  phone: '0987654321',
  skills: ['Node.js', 'PostgreSQL'],
  yearsOfExperience: 4,
  education: 'Đại học Bách Khoa',
  fileName: 'CV_An.pdf',
  createdAt: '2026-11-24T00:00:00.000Z',
};

const matchResult: MatchResult = {
  id: 'match-1',
  candidateId: 'cand-1',
  jobDescriptionId: 'jd-1',
  score: 82,
  summary: 'Ứng viên có bằng chứng kinh nghiệm Node.js phù hợp.',
  matchedSkills: ['Node.js'],
  missingSkills: ['Docker'],
  createdAt: '2026-11-24T00:00:00.000Z',
  matchLevel: 'strong_match',
  confidence: 'high',
  scoreBreakdown: [
    {
      category: 'skill_matching',
      score: 23,
      maxScore: 25,
      reason: 'Đáp ứng tốt kỹ năng backend.',
      evidence: [{ source: 'CV', section: 'Projects', text: 'Xây dựng REST API Node.js.' }],
      gaps: [],
      status: 'strongly_matched',
      confidence: 'high',
    },
    {
      category: 'experience_relevance',
      score: 16,
      maxScore: 20,
      reason: 'Kinh nghiệm liên quan.',
      evidence: [],
      gaps: [],
      status: 'matched',
      confidence: 'medium',
    },
    {
      category: 'project_achievement',
      score: 18,
      maxScore: 20,
      reason: 'Có dự án thực tế.',
      evidence: [],
      gaps: [],
      status: 'matched',
      confidence: 'high',
    },
    {
      category: 'soft_skills',
      score: 12,
      maxScore: 15,
      reason: 'Có phối hợp nhóm.',
      evidence: [],
      gaps: [],
      status: 'partially_matched',
      confidence: 'medium',
    },
    {
      category: 'education_certification',
      score: 7,
      maxScore: 10,
      reason: 'Bằng đại học phù hợp.',
      evidence: [],
      gaps: [],
      status: 'matched',
      confidence: 'high',
    },
    {
      category: 'cv_quality',
      score: 6,
      maxScore: 10,
      reason: 'Rõ ràng.',
      evidence: [],
      gaps: [],
      status: 'matched',
      confidence: 'high',
    },
  ],
  requirementsAnalysis: [
    {
      requirement: 'Node.js',
      priority: 'required',
      status: 'strongly_matched',
      evidence: [{ source: 'CV', section: 'Projects', text: 'Phát triển REST API bằng Node.js.' }],
    },
    {
      requirement: 'Docker',
      priority: 'preferred',
      status: 'not_found',
      evidence: [],
      gap: 'Chưa thấy kinh nghiệm triển khai Docker',
    },
  ],
  careerPotential: {
    assessment: 'positive_evidence',
    reason: 'Thể hiện tiến bộ rõ qua các dự án gần đây.',
  },
  interviewQuestions: ['Bạn đã tối ưu hiệu năng API Node.js như thế nào?'],
  highlights: ['3 năm kinh nghiệm Node.js', 'Làm chủ PostgreSQL', 'Phát triển REST API chuẩn mực'],
  limitations: [],
};

it('renders CVTest breakdown, requirementsAnalysis, careerPotential and human-in-the-loop note', () => {
  render(
    <CandidateInsightDrawer
      isOpen
      onClose={vi.fn()}
      candidate={candidate}
      matchResult={matchResult}
      jobTitle="Backend Node.js"
      plan="PLUS"
      onDeleteRequest={vi.fn()}
    />,
  );

  expect(screen.getByText('Phân tích theo 6 nhóm tiêu chí')).toBeTruthy();
  expect(screen.getByText('Phân tích yêu cầu theo JD')).toBeTruthy();
  expect(screen.getByText('Bắt buộc')).toBeTruthy();
  expect(screen.getByText('Ưu tiên')).toBeTruthy();
  expect(screen.getByText('Cần xác minh: Chưa thấy kinh nghiệm triển khai Docker')).toBeTruthy();
  expect(screen.getByText('Tiềm năng phát triển (Career Potential)')).toBeTruthy();
  expect(screen.getByText('Nhận xét bổ trợ — không cộng vào tổng 100 điểm.')).toBeTruthy();
  expect(screen.getByText(/Kết quả AI chỉ hỗ trợ sàng lọc/)).toBeTruthy();
});

it('renders only score, summary, 3 highlights, skills contrast and PLUS upgrade card for FREE plan', () => {
  render(
    <CandidateInsightDrawer
      isOpen
      onClose={vi.fn()}
      candidate={candidate}
      matchResult={matchResult}
      jobTitle="Backend Node.js"
      plan="FREE"
      onDeleteRequest={vi.fn()}
    />,
  );

  expect(screen.getByText('Tóm tắt nhanh 3 điểm nổi bật của ứng viên')).toBeTruthy();
  expect(screen.getByText('3 năm kinh nghiệm Node.js')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Tính năng nâng cao Gói PLUS' })).toBeTruthy();
  expect(screen.queryByText('Phân tích theo 6 nhóm tiêu chí')).toBeNull();
  expect(screen.queryByText('Phân tích yêu cầu theo JD')).toBeNull();
  expect(screen.queryByText('Tiềm năng phát triển (Career Potential)')).toBeNull();
  expect(screen.queryByText('Câu hỏi phỏng vấn gợi ý')).toBeNull();
});

