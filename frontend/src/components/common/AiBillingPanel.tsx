import { useEffect, useRef, useState } from 'react';
import { billingApi, type AiBillingInfo } from '../../services/subscriptionApi';
import { useNetworkStore } from '../../shared/offline/networkStore';

export function AiBillingPanel() {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const [info, setInfo] = useState<AiBillingInfo>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const receipt = useRef({ signature: '', key: '' });
  useEffect(() => {
    let cancelled = false;
    void billingApi.info().then((value) => { if (!cancelled) { setInfo(value); setInput(value.inputUsd ?? ''); setOutput(value.outputUsd ?? ''); setError(''); } })
      .catch(() => { if (!cancelled) setError('Không thể tải cấu hình chi phí Gemini.'); });
    return () => { cancelled = true; };
  }, [revision]);
  return <section aria-label="Chi phí Gemini" className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="font-bold">Chi phí sử dụng Gemini</h3>
    {!info && !error && <p role="status" className="mt-2 text-sm">Đang tải cấu hình chi phí…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error} <button className="underline" onClick={() => setRevision((v) => v + 1)}>Thử lại</button></p>}
    {info && <><p className="mt-2 text-sm">Model đang cấu hình: <strong>{info.model}</strong></p>
      {info.billingMode === 'FREE' ? <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Chế độ miễn phí · 0 USD cho lần gọi mới</p><p className="mt-1">Token sử dụng vẫn được tính vào hạn mức của HR.</p></div>
        : <><p className="mt-2 text-sm text-slate-600">Đang dùng chế độ trả phí. Chi phí = (token đầu vào × đơn giá đầu vào + token đầu ra và suy luận × đơn giá đầu ra) / 1.000.000. Chưa có đơn giá thì chi phí để trống, không tự suy đoán.</p>
          <details className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Cấu hình đơn giá trả phí cho model này</summary><p className="mt-2 text-xs text-slate-500">Chỉ áp dụng cho lần gọi mới; các lần gọi trước giữ nguyên đơn giá đã lưu.</p>
            <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(e) => {
              e.preventDefault(); if (saving) return; setSaving(true); setError('');
              const signature = JSON.stringify([info.model, input, output, reason]);
              if (receipt.current.signature !== signature) receipt.current = { signature, key: crypto.randomUUID() };
              void billingApi.savePrice(info.model, Number(input), Number(output), reason, receipt.current.key).then(() => { setRevision((v) => v + 1); setReason(''); }).catch(() => setError('Không thể lưu đơn giá Gemini.')).finally(() => setSaving(false));
            }}>{[['Đầu vào (USD / 1 triệu token)', input, setInput], ['Đầu ra, gồm suy luận (USD / 1 triệu token)', output, setOutput]].map(([label, value, setter]) => <label key={String(label)} className="text-sm">{String(label)}<input required type="number" min="0" max="10000" step="0.00000001" className="mt-1 block w-full rounded-lg border px-3 py-2" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} /></label>)}<label className="text-sm">Lý do thay đổi<input required minLength={3} className="mt-1 block w-full rounded-lg border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label><button disabled={!isOnline || saving} className="self-end rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu đơn giá trả phí</button></form>
          </details></>}
      <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer">Thông tin cấu hình</summary><p className="mt-2">Chế độ lấy từ cấu hình hệ thống. Giới hạn của Google áp dụng cho cả dự án Gemini, độc lập với hạn mức token của HR.</p><div className="mt-2 flex flex-wrap gap-4"><a className="text-blue-700 underline" href={info.pricingUrl} target="_blank" rel="noreferrer">Bảng giá Google</a><a className="text-blue-700 underline" href={info.rateLimitsUrl} target="_blank" rel="noreferrer">Giới hạn Gemini</a></div></details>
    </>}
  </section>;
}

export function PlanPriceCalculator({ onApply }: { onApply: (price: number) => void }) {
  const [operating, setOperating] = useState('70000');
  const [ai, setAi] = useState('0');
  const [margin, setMargin] = useState('30');
  const cost = Number(operating) + Number(ai);
  const valid = operating.trim() !== '' && Number.isFinite(cost) && Number(operating) >= 0 && Number(ai) >= 0 && Number(margin) >= 0 && Number(margin) < 100;
  const suggested = valid ? Math.ceil(cost / (1 - Number(margin) / 100) / 1000) * 1000 : null;
  return <details className="rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Tính giá PLUS / doanh nghiệp / tháng</summary><p className="mt-2 text-xs text-slate-600">Giá gợi ý = tổng chi phí dự kiến / (1 − biên lợi nhuận), làm tròn lên 1.000đ. Giả định demo có thể sửa: vận hành 70.000đ/tháng, chi phí AI 0đ khi dùng miễn phí, biên lợi nhuận 30%; chưa phải chi phí đã đo. Không giới hạn số tài khoản; chi phí dự kiến cần tính cho toàn bộ HR của doanh nghiệp.</p><div className="mt-3 grid gap-3 text-sm">{[['Chi phí vận hành phân bổ (VND/tháng)', operating, setOperating], ['Chi phí AI dự kiến cả doanh nghiệp (VND/tháng)', ai, setAi], ['Biên lợi nhuận mục tiêu (%)', margin, setMargin]].map(([label, value, setter]) => <label key={String(label)}>{String(label)}<input aria-label={String(label)} type="number" min="0" max={String(label).includes('(%)') ? '99' : '100000000'} className="mt-1 block w-full rounded-lg border px-3 py-2" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} /></label>)}</div>{suggested !== null && suggested <= 100000000 ? <div className="mt-3 text-sm"><p className="font-semibold">Giá gợi ý: {suggested.toLocaleString('vi-VN')}đ / doanh nghiệp / tháng</p><button type="button" className="mt-2 rounded-lg border border-blue-200 px-3 py-2 text-blue-700" onClick={() => onApply(suggested)}>Áp dụng giá gợi ý vào biểu mẫu</button></div> : <p className="mt-3 text-xs text-slate-500">Nhập chi phí dự kiến để tính giá. Hệ thống không tự thay đổi giá đang áp dụng.</p>}</details>;
}
