import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useUsers } from '../user';
import type { ApiError, SampleBrief, Well } from '../types';

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewSamplePage() {
  const { current } = useUsers();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [wells, setWells] = useState<Well[]>([]);
  const [replaceable, setReplaceable] = useState<SampleBrief[]>([]);
  const [wellId, setWellId] = useState(params.get('wellId') ?? '');
  const [containerNo, setContainerNo] = useState('');
  const [sampledAt, setSampledAt] = useState(nowLocal());
  const [weather, setWeather] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [turbidity, setTurbidity] = useState('');
  const [notes, setNotes] = useState('');
  const [replacesId, setReplacesId] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Well[]>('/wells').then(setWells).catch(() => {});
    // 可被替代的旧样品：作废 / 退样 / 待复测
    Promise.all([
      api<SampleBrief[]>('/samples?status=INVALIDATED'),
      api<SampleBrief[]>('/samples?status=REJECTED'),
      api<SampleBrief[]>('/samples?status=RETEST_REQUESTED'),
    ]).then(([a, b, c]) => setReplaceable([...a, ...b, ...c])).catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('wellId', wellId);
      fd.set('containerNo', containerNo);
      fd.set('sampledAt', new Date(sampledAt).toISOString());
      if (weather) fd.set('weather', weather);
      if (waterTemp) fd.set('waterTemp', waterTemp);
      if (turbidity) fd.set('turbidity', turbidity);
      if (notes) fd.set('notes', notes);
      if (replacesId) fd.set('replacesId', replacesId);
      if (photo) fd.set('sealPhoto', photo);
      const created = await api<{ id: number }>('/samples', { method: 'POST', formData: fd });
      navigate(`/samples/${created.id}`);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <h2>采样登记</h2>
      {current?.role !== 'SAMPLER' && (
        <div className="alert warn">当前身份不是采样员，提交将被拒绝。请在右上角切换为采样员（如：张岚）。</div>
      )}
      {error && (
        <div className="alert error">
          <b>登记失败（HTTP {error.status}）</b>：{error.message}
        </div>
      )}
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>井位 *</span>
            <select value={wellId} onChange={(e) => setWellId(e.target.value)} required>
              <option value="">请选择</option>
              {wells.map((w) => (
                <option key={w.id} value={w.id}>{w.code} {w.name}（{w.address}）</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>容器编号 *（全局唯一）</span>
            <input value={containerNo} onChange={(e) => setContainerNo(e.target.value)}
              placeholder="如 C-2026-0008" required />
          </label>
          <label className="field">
            <span>取样时间 *</span>
            <input type="datetime-local" value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} required />
          </label>
          <label className="field">
            <span>天气</span>
            <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="晴 / 阴 / 小雨…" />
          </label>
          <label className="field">
            <span>水温（℃）</span>
            <input type="number" step="0.1" value={waterTemp} onChange={(e) => setWaterTemp(e.target.value)} />
          </label>
          <label className="field">
            <span>现场浊度（NTU）</span>
            <input type="number" step="0.1" value={turbidity} onChange={(e) => setTurbidity(e.target.value)} />
          </label>
          <label className="field">
            <span>封签照片</span>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <label className="field">
            <span>替代旧样品（重新采样时选择）</span>
            <select value={replacesId} onChange={(e) => setReplacesId(e.target.value)}>
              <option value="">不替代（全新批次）</option>
              {replaceable.map((s) => (
                <option key={s.id} value={s.id}>#{s.id} {s.containerNo}（{s.well?.name}）</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>备注</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button disabled={busy}>{busy ? '提交中…' : '登记样品'}</button>
      </form>
    </div>
  );
}
