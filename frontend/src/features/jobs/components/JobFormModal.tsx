import { ModalPortal } from '../../../components/common/ModalPortal';
import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { AlertTriangle, ChevronDown, ChevronUp, Lock, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CvTestCategory, CvTestWeights, JobDescription } from '../../../types';
import { jobFeatureApi, JobPayload } from '../api/jobApi';
import { useSubscriptionStore } from '../../subscription/subscriptionStore';

const DEFAULT_WEIGHTS: CvTestWeights = {
  skill_matching: 25,
  experience_relevance: 20,
  project_achievement: 20,
  soft_skills: 15,
  education_certification: 10,
  cv_quality: 10,
};

const WEIGHT_LABELS: Array<{ key: CvTestCategory; label: string }> = [
  { key: 'skill_matching', label: 'Khớp kỹ năng' },
  { key: 'experience_relevance', label: 'Kinh nghiệm liên quan' },
  { key: 'project_achievement', label: 'Dự án & thành tựu' },
  { key: 'soft_skills', label: 'Kỹ năng mềm' },
  { key: 'education_certification', label: 'Học vấn & chứng chỉ' },
  { key: 'cv_quality', label: 'Chất lượng CV' },
];

const weightValueSchema = z
  .number('Trọng số phải là số')
  .int('Trọng số phải là số nguyên')
  .min(0, 'Trọng số không được âm')
  .max(100, 'Trọng số tối đa là 100');

const jobFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Tiêu đề công việc phải có ít nhất 5 ký tự')
    .max(150, 'Tiêu đề công việc không được vượt quá 150 ký tự'),
  description: z
    .string()
    .trim()
    .min(10, 'Mô tả công việc phải có ít nhất 10 ký tự'),
  requiredSkills: z
    .array(z.string().trim().min(1))
    .min(1, 'Cần ít nhất 1 kỹ năng yêu cầu'),
  minExperience: z
    .number('Số năm kinh nghiệm không hợp lệ')
    .int('Số năm kinh nghiệm phải là số nguyên')
    .min(0, 'Số năm kinh nghiệm không được âm')
    .max(30, 'Số năm kinh nghiệm tối đa là 30 năm'),
  preferredSkills: z.array(z.string().trim().min(1)).optional(),
  weights: z
    .object({
      skill_matching: weightValueSchema,
      experience_relevance: weightValueSchema,
      project_achievement: weightValueSchema,
      soft_skills: weightValueSchema,
      education_certification: weightValueSchema,
      cv_quality: weightValueSchema,
    })
    .refine(
      (weights) => Object.values(weights).reduce((sum, value) => sum + value, 0) === 100,
      { message: 'Tổng trọng số 6 nhóm tiêu chí phải đúng bằng 100' },
    ),
});

const SUGGESTED_SKILLS = [
  'Node.js',
  'TypeScript',
  'React',
  'PostgreSQL',
  'Docker',
  'Redis',
  'Python',
  'Java',
  'AWS',
  'Git',
];

interface JobFormModalProps {
  isOpen: boolean;
  editingJob: JobDescription | null;
  plan?: 'FREE' | 'PLUS';
  onClose: () => void;
  onSuccess: (job: JobDescription, isEdit: boolean) => void;
}

export const JobFormModal: React.FC<JobFormModalProps> = ({
  isOpen,
  editingJob,
  plan,
  onClose,
  onSuccess,
}) => {
  const storePlan = useSubscriptionStore((state) => state.subscription?.name);
  const isFreePlan = (plan ?? storePlan) === 'FREE';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [preferredSkillInput, setPreferredSkillInput] = useState('');
  const [minExperience, setMinExperience] = useState('0');
  const [weights, setWeights] = useState<CvTestWeights>({ ...DEFAULT_WEIGHTS });
  const [showWeights, setShowWeights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (editingJob) {
      setTitle(editingJob.title);
      setDescription(editingJob.description);
      setSkills(editingJob.requiredSkills);
      setPreferredSkills(editingJob.preferredSkills ?? []);
      setSkillInput('');
      setPreferredSkillInput('');
      setMinExperience(String(editingJob.minExperience));
      const savedWeights = !isFreePlan ? editingJob.evaluationConfig?.weights : undefined;
      setWeights(savedWeights ? { ...DEFAULT_WEIGHTS, ...savedWeights } : { ...DEFAULT_WEIGHTS });
      setShowWeights(Boolean(savedWeights));
    } else {
      setTitle('');
      setDescription('');
      setSkills([]);
      setPreferredSkills([]);
      setSkillInput('');
      setPreferredSkillInput('');
      setMinExperience('0');
      setWeights({ ...DEFAULT_WEIGHTS });
      setShowWeights(false);
    }
  }, [isOpen, editingJob, isFreePlan]);

  if (!isOpen) return null;

  const addSkillsFromText = (raw: string) => {
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    setSkills((prev) => {
      const next = [...prev];
      items.forEach((item) => {
        if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
          next.push(item);
        }
      });
      return next;
    });
    setSkillInput('');
    setErrors((prev) => ({ ...prev, requiredSkills: '' }));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkillsFromText(skillInput);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Gop ca skill dang go do trong input (neu co)
    const pendingItems = skillInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedSkills = [...skills];
    pendingItems.forEach((item) => {
      if (!mergedSkills.some((s) => s.toLowerCase() === item.toLowerCase())) {
        mergedSkills.push(item);
      }
    });

    const parsed = jobFormSchema.safeParse({
      title,
      description,
      requiredSkills: mergedSkills,
      minExperience: Number(minExperience),
      preferredSkills,
      weights,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] || 'form');
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      });
      if (fieldErrors.weights) setShowWeights(true);
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    const { weights: validWeights, ...rest } = parsed.data;
    const payload: JobPayload = {
      ...rest,
      ...(isFreePlan ? {} : { evaluationConfig: { weights: validWeights } }),
    };

    try {
      if (editingJob) {
        const updated = await jobFeatureApi.update(editingJob.id, payload);
        if (updated) {
          toast.success('Cập nhật Job Description thành công');
          onSuccess(updated, true);
        }
      } else {
        const created = await jobFeatureApi.create(payload);
        if (created) {
          toast.success('Tạo Job Description thành công');
          onSuccess(created, false);
        }
      }
      onClose();
    } catch {
      // Lỗi từ server được hiển thị qua interceptor toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-form-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="job-form-title" className="text-lg font-bold text-slate-900">
              {editingJob ? 'Chỉnh sửa Job Description' : 'Tạo Job Description mới'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Thiết lập tiêu chuẩn vị trí tuyển dụng để đối chiếu và chấm điểm CV bằng AI.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {editingJob && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Lưu ý: Kết quả AI Matching đã chấm trước đó sẽ giữ nguyên và không tự động chấm lại khi cập nhật nội dung JD.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* 1. Tiêu đề */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="job-title" className="text-xs font-semibold text-slate-700">
                Tiêu đề công việc <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.trim().length}/150</span>
            </div>
            <input
              id="job-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="Ví dụ: Senior Backend NodeJS Developer"
              className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors.title
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
            {errors.title && <p className="mt-1 text-xs font-medium text-rose-600">{errors.title}</p>}
          </div>

          {/* 2. Mô tả công việc */}
          <div>
            <label htmlFor="job-description" className="mb-1 block text-xs font-semibold text-slate-700">
              Mô tả chi tiết công việc <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="job-description"
              rows={5}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Mô tả trách nhiệm, yêu cầu kỹ thuật, kinh nghiệm dự án thực tế..."
              className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors.description
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
            {errors.description && (
              <p className="mt-1 text-xs font-medium text-rose-600">{errors.description}</p>
            )}
          </div>

          {/* 3. Kỹ năng yêu cầu */}
          <div>
            <label htmlFor="job-skills" className="mb-1 block text-xs font-semibold text-slate-700">
              Kỹ năng yêu cầu <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="job-skills"
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                onBlur={() => skillInput.trim() && addSkillsFromText(skillInput)}
                placeholder="Nhập kỹ năng rồi nhấn Enter hoặc dấu phẩy (VD: Node.js, Docker)"
                className={`flex-1 rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                  errors.requiredSkills
                    ? 'border-rose-400 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              <button
                type="button"
                onClick={() => addSkillsFromText(skillInput)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm</span>
              </button>
            </div>

            {errors.requiredSkills && (
              <p className="mt-1 text-xs font-medium text-rose-600">{errors.requiredSkills}</p>
            )}

            {/* Chips kỹ năng đã chọn */}
            {skills.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-800"
                      title={`Xóa ${skill}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Gợi ý chọn nhanh */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Chọn nhanh:</span>
              {SUGGESTED_SKILLS.map((s) => {
                const active = skills.some((item) => item.toLowerCase() === s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      active ? removeSkill(s) : addSkillsFromText(s)
                    }
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    + {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Kỹ năng ưu tiên */}
          <div>
            <label htmlFor="job-preferred-skills" className="mb-1 block text-xs font-semibold text-slate-700">
              Kỹ năng ưu tiên / Nice-to-have
            </label>
            <input
              id="job-preferred-skills"
              type="text"
              value={preferredSkillInput}
              onChange={(e) => setPreferredSkillInput(e.target.value)}
              onBlur={() => {
                const items = preferredSkillInput.split(',').map((item) => item.trim()).filter(Boolean);
                if (items.length > 0) {
                  setPreferredSkills((current) => [...new Set([...current, ...items])]);
                  setPreferredSkillInput('');
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ',') return;
                event.preventDefault();
                const items = preferredSkillInput.split(',').map((item) => item.trim()).filter(Boolean);
                if (items.length > 0) {
                  setPreferredSkills((current) => [...new Set([...current, ...items])]);
                  setPreferredSkillInput('');
                }
              }}
              placeholder="Ví dụ: Kubernetes, AWS"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {preferredSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preferredSkills.map((skill) => (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => setPreferredSkills((current) => current.filter((item) => item !== skill))}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                  >
                    {skill} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Số năm kinh nghiệm tối thiểu */}
          <div>
            <label htmlFor="job-experience" className="mb-1 block text-xs font-semibold text-slate-700">
              Số năm kinh nghiệm tối thiểu
            </label>
            <input
              id="job-experience"
              type="number"
              min={0}
              max={30}
              step={1}
              value={minExperience}
              onChange={(e) => {
                setMinExperience(e.target.value);
                if (errors.minExperience) setErrors((prev) => ({ ...prev, minExperience: '' }));
              }}
              className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                errors.minExperience
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
            />
            {errors.minExperience && (
              <p className="mt-1 text-xs font-medium text-rose-600">{errors.minExperience}</p>
            )}
          </div>

          {/* 6. Trọng số 6 nhóm tiêu chí CVTest (Tổng 100) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowWeights((current) => !current)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                <span>Tùy chỉnh trọng số chấm điểm (Tổng 100)</span>
                {isFreePlan && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <Lock className="h-2.5 w-2.5" />
                    Gói PLUS
                  </span>
                )}
                {showWeights ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <span className="text-[11px] font-medium text-slate-500">
                Hiện tại: {WEIGHT_LABELS.map(({ key }) => weights[key]).join('/')}
              </span>
            </div>

            {showWeights && (
              <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
                {isFreePlan && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Tùy chỉnh trọng số 6 tiêu chí dành cho gói PLUS. Gói FREE sử dụng bộ trọng số tiêu chuẩn (25/20/20/15/10/10).
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {WEIGHT_LABELS.map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                      <span className="font-medium text-slate-700">{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={isFreePlan}
                        aria-label={`Trọng số ${label}`}
                        value={weights[key]}
                        onChange={(e) => {
                          const nextVal = e.target.value === '' ? 0 : Number(e.target.value);
                          setWeights((prev) => ({ ...prev, [key]: Number.isFinite(nextVal) ? nextVal : 0 }));
                          if (errors.weights) setErrors((prev) => ({ ...prev, weights: '' }));
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right font-semibold text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${Object.values(weights).reduce((s, v) => s + v, 0) === 100 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    Tổng điểm tối đa: {Object.values(weights).reduce((s, v) => s + v, 0)}/100
                  </span>
                  <button
                    type="button"
                    disabled={isFreePlan}
                    onClick={() => {
                      setWeights({ ...DEFAULT_WEIGHTS });
                      setErrors((prev) => ({ ...prev, weights: '' }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Đặt lại mặc định</span>
                  </button>
                </div>
                {errors.weights && (
                  <p className="text-xs font-medium text-rose-600">{errors.weights}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? 'Đang lưu...'
                : editingJob
                  ? 'Lưu thay đổi'
                  : 'Tạo Job Description'}
            </button>
          </div>
        </form>
      </section>
    </div>
    </ModalPortal>
  );
};
