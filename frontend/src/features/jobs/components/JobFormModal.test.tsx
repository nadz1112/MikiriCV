// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobFormModal } from './JobFormModal';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../api/jobApi', () => ({
  jobFeatureApi: {
    create: mocks.create,
    update: mocks.update,
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('rejects weights that do not sum to 100 and submits evaluationConfig when valid', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  const onClose = vi.fn();

  mocks.create.mockResolvedValue({
    id: 'jd-1',
    title: 'Senior Node.js Developer',
    description: 'Xây dựng hệ thống backend Node.js và PostgreSQL.',
    requiredSkills: ['Node.js'],
    minExperience: 3,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  });

  render(<JobFormModal isOpen editingJob={null} onClose={onClose} onSuccess={onSuccess} />);

  await user.type(screen.getByLabelText(/Tiêu đề công việc/), 'Senior Node.js Developer');
  await user.type(screen.getByLabelText(/Mô tả chi tiết công việc/), 'Xây dựng hệ thống backend Node.js và PostgreSQL.');
  await user.click(screen.getByRole('button', { name: '+ Node.js' }));

  await user.click(screen.getByRole('button', { name: /Tùy chỉnh trọng số chấm điểm/ }));
  const skillWeightInput = screen.getByLabelText('Trọng số Khớp kỹ năng');
  fireEvent.change(skillWeightInput, { target: { value: '40' } });

  await user.click(screen.getByRole('button', { name: 'Tạo Job Description' }));
  expect(await screen.findByText('Tổng trọng số 6 nhóm tiêu chí phải đúng bằng 100')).toBeTruthy();
  expect(mocks.create).not.toHaveBeenCalled();

  const expWeightInput = screen.getByLabelText('Trọng số Kinh nghiệm liên quan');
  fireEvent.change(expWeightInput, { target: { value: '5' } });

  await user.click(screen.getByRole('button', { name: 'Tạo Job Description' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());

  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Senior Node.js Developer',
    evaluationConfig: {
      weights: {
        skill_matching: 40,
        experience_relevance: 5,
        project_achievement: 20,
        soft_skills: 15,
        education_certification: 10,
        cv_quality: 10,
      },
    },
  }));
});

