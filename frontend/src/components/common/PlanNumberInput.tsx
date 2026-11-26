import { useEffect, useState } from 'react';

export function PlanNumberInput({ value, onChange, label, min, max, disabled = false }: { value: number; onChange: (value: number) => void; label: string; min: number; max: number; disabled?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return <input aria-label={label} required disabled={disabled} type="number" min="0" max={max} step="1" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={text} onChange={(e) => {
    const next = e.target.value.replace(/^0+(?=\d)/, ''); setText(next);
    const number = Number(next);
    e.target.setCustomValidity(next === '' || !Number.isInteger(number) || number < min || number > max ? `Nhập số nguyên từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}.` : '');
    if (next !== '' && Number.isFinite(number)) onChange(number);
  }} />;
}
