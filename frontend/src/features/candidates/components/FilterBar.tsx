import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { candidateApi } from '../api/candidateApi';
import { useCandidateFeatureStore } from '../store/candidateStore';

const POPULAR_SKILLS = ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Python', 'Tailwind'];

export const FilterBar: React.FC = () => {
  const {
    filter,
    setSearch,
    toggleSkill,
    setSkillMode,
    setMinExp,
    resetFilter,
  } = useCandidateFeatureStore();

  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for debouncing keyword search (250ms)
  const [localSearch, setLocalSearch] = useState(filter.search);

  // Sync from store if store resets
  useEffect(() => {
    setLocalSearch(filter.search);
  }, [filter.search]);

  // Debounce search update (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filter.search) {
        setSearch(localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, filter.search, setSearch]);

  // Load canonical skills for dropdown
  useEffect(() => {
    let mounted = true;
    async function loadSkills() {
      try {
        const skills = await candidateApi.getSkills();
        if (mounted) setAvailableSkills(skills);
      } catch {
        // Fallback: silently fail or handled by interceptor
      }
    }
    void loadSkills();
    return () => {
      mounted = false;
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        handleAddCustomSkill(skillSearch);
        setIsSkillDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [skillSearch, filter.skills, toggleSkill]);

  const filteredSkills = availableSkills.filter((s) =>
    s.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const handleAddCustomSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (!filter.skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      toggleSkill(trimmed);
    }
    setSkillSearch('');
  };

  const hasActiveFilters =
    Boolean(filter.search) ||
    filter.skills.length > 0 ||
    filter.minExp > 0 ||
    filter.skillMode !== 'any';

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all">
      <div className="flex flex-wrap items-center gap-3">
        {/* 1. Ô tìm từ khóa (Debounce 250ms) */}
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Tìm theo tên, kỹ năng, vị trí..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50/50 py-2 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 transition hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSearch('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              title="Xóa từ khóa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 2. Dropdown chọn nhiều kỹ năng */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              if (isSkillDropdownOpen) handleAddCustomSkill(skillSearch);
              setIsSkillDropdownOpen((prev) => !prev);
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              filter.skills.length > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Kỹ năng</span>
            {filter.skills.length > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                {filter.skills.length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isSkillDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSkillDropdownOpen && (
            <div onMouseDown={(event) => {
              if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
            }} className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="mb-2 px-1">
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  onBlur={() => handleAddCustomSkill(skillSearch)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSkill(skillSearch);
                    }
                  }}
                  placeholder="Gõ kỹ năng (Enter để thêm)..."
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {skillSearch.trim().length > 0 && !filter.skills.includes(skillSearch.trim()) && (
                <div className="mb-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => handleAddCustomSkill(skillSearch)}
                    className="flex w-full items-center justify-between rounded-lg bg-blue-50 px-2.5 py-1.5 text-left text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <span>+ Thêm "{skillSearch.trim()}"</span>
                    <span className="rounded bg-blue-200/60 px-1 py-0.5 text-[10px] font-normal text-blue-800">
                      Enter
                    </span>
                  </button>
                </div>
              )}

              <div onMouseDown={(event) => event.preventDefault()} className="max-h-60 overflow-y-auto px-1 divide-y divide-slate-50">
                {filteredSkills.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    {skillSearch.trim()
                      ? 'Không có trong danh mục gợi ý. Bấm nút "+ Thêm" ở trên để tìm.'
                      : 'Không tìm thấy kỹ năng phù hợp'}
                  </div>
                ) : (
                  filteredSkills.map((skill) => {
                    const isSelected = filter.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          toggleSkill(skill);
                          setSkillSearch('');
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition ${
                          isSelected
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{skill}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Công tắc Bất kỳ / Tất cả (skillMode) */}
        {filter.skills.length > 1 && (
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setSkillMode('any')}
              className={`rounded-md px-2.5 py-1 transition ${
                filter.skillMode === 'any'
                  ? 'bg-white font-semibold text-blue-700 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
              title="Khớp ít nhất 1 kỹ năng đã chọn"
            >
              Bất kỳ (OR)
            </button>
            <button
              type="button"
              onClick={() => setSkillMode('all')}
              className={`rounded-md px-2.5 py-1 transition ${
                filter.skillMode === 'all'
                  ? 'bg-white font-semibold text-blue-700 shadow-sm'
                  : 'hover:text-slate-900'
              }`}
              title="Khớp tất cả các kỹ năng đã chọn"
            >
              Tất cả (AND)
            </button>
          </div>
        )}

        {/* 4. Ô số năm kinh nghiệm tối thiểu */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="minExp" className="whitespace-nowrap text-xs font-medium text-slate-600">
            Kinh nghiệm:
          </label>
          <div className="relative">
            <select
              id="minExp"
              value={filter.minExp}
              onChange={(e) => setMinExp(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 transition hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value={0}>Tất cả số năm</option>
              <option value={1}>≥ 1 năm</option>
              <option value={2}>≥ 2 năm</option>
              <option value={3}>≥ 3 năm</option>
              <option value={5}>≥ 5 năm</option>
              <option value={7}>≥ 7 năm</option>
              <option value={10}>≥ 10 năm</option>
            </select>
          </div>
        </div>

        {/* 5. Nút xóa bộ lọc */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            title="Đặt lại toàn bộ tiêu chí lọc"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
        )}
      </div>

      {/* Gợi ý kỹ năng phổ biến */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
        <span className="text-[11px] font-medium text-slate-400">Gợi ý kỹ năng:</span>
        {POPULAR_SKILLS.map((skill) => {
          const isSelected = filter.skills.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`px-2 py-0.5 rounded-md text-xs font-medium transition ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {skill}
            </button>
          );
        })}
      </div>

      {/* Tags kỹ năng đang được chọn */}
      {filter.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5">
          <span className="text-[11px] font-medium text-slate-400">Đang lọc kỹ năng:</span>
          {filter.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200"
            >
              {skill}
              <button
                type="button"
                onClick={() => toggleSkill(skill)}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
