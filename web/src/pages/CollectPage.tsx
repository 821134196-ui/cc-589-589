import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, upload } from '../api';
import { useAuth } from '../auth';
import { errMsg, useMessage } from '../ui';

interface Well {
  id: string;
  code: string;
  name: string;
}

export default function CollectPage() {
  const { user, hasRole } = useAuth();
  const { flash, node } = useMessage();
  const [wells, setWells] = useState<Well[]>([]);
  const [retestables, setRetestables] = useState<{ id: string; containerCode: string; wellCode: string }[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    wellId: '',
    containerCode: '',
    sampledAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
    sealCode: '',
    weather: '晴',
    waterTempC: '18',
    chlorineSmell: false,
    visualNote: '',
    coldChainRequired: true,
    sealIntactAtCollect: true,
    retestOfId: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    api<any[]>('/wells/map').then((ws) =>
      setWells(ws.map((w) => ({ id: w.id, code: w.code, name: w.name }))),
    );
    api<any[]>('/samples').then((ss) =>
      setRetestables(
        ss
          .filter((s) => s.status === 'RETESTING')
          .map((s) => ({
            id: s.id,
            containerCode: s.containerCode,
            wellCode: s.well?.code ?? '',
          })),
      ),
    );
  }, []);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCreatedId(null);
    if (!file) {
      flash.error('请先拍摄/选择封签照片');
      return;
    }
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v === '' ? '' : String(v)));
      fd.set('sealPhoto', file);
      const s = await upload<any>('/samples', fd);
      flash.ok(`登记成功：容器 ${s.containerCode}，批次 ${s.batchNo}（封签照片已本地存档）`);
      setCreatedId(s.id);
    } catch (e) {
      flash.error(errMsg(e));
    }
  }

  if (!user) return <div className="card empty">请先在右上角选择登录人员（采样员）。</div>;
  if (!hasRole('SAMPLER'))
    return (
      <div className="card">
        <h3>无采样权限</h3>
        <p className="sec">当前登录人「{user.name}」不是采样员，不能登记样品。请切换为 李采样 / 孙采样 / 钱主任。</p>
      </div>
    );

  return (
    <div>
      <h2 className="page-title">采样登记</h2>
      <p className="page-sub">
        采样员按计划登记井号、容器编号、取样时间与现场条件并上传封签照片；容器编号全局唯一，重复登记将被拒绝。
      </p>
      {node}
      {createdId && (
        <div className="alert alert-ok">
          下一步：<Link to="/handovers">前往送检交接页核封签、核冷藏后启运 ›</Link>
          {' · '}
          <Link to={`/samples/${createdId}`}>查看该样品报告 ›</Link>
        </div>
      )}
      <form className="card" onSubmit={submit}>
        <div className="grid grid-2">
          <div>
            <label className="field">
              <span>井号 *</span>
              <select value={form.wellId} onChange={(e) => set('wellId', e.target.value)} required>
                <option value="">请选择井位</option>
                {wells.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>容器编号 *（全局唯一，如 C-W01-1005）</span>
              <input
                value={form.containerCode}
                onChange={(e) => set('containerCode', e.target.value)}
                placeholder="C-W01-1005"
                required
              />
            </label>
            <label className="field">
              <span>取样时间 *</span>
              <input
                type="datetime-local"
                step="60"
                value={form.sampledAt}
                onChange={(e) => set('sampledAt', e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>封签编号 *</span>
              <input
                value={form.sealCode}
                onChange={(e) => set('sealCode', e.target.value)}
                placeholder="S-A008"
                required
              />
            </label>
            <label className="field">
              <span>复测关联（可选；复测必须使用新容器，原样品保留）</span>
              <select value={form.retestOfId} onChange={(e) => set('retestOfId', e.target.value)}>
                <option value="">普通采样（非复测）</option>
                {retestables.map((s) => (
                  <option key={s.id} value={s.id}>
                    复测 {s.wellCode} 原容器 {s.containerCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>现场封签状态</span>
              <div className="checkline">
                <input
                  id="intact"
                  type="checkbox"
                  checked={form.sealIntactAtCollect}
                  onChange={(e) => set('sealIntactAtCollect', e.target.checked)}
                />
                <label htmlFor="intact">取样时封签完好</label>
              </div>
            </label>
          </div>
          <div>
            <label className="field">
              <span>天气 / 现场环境</span>
              <input value={form.weather} onChange={(e) => set('weather', e.target.value)} />
            </label>
            <label className="field">
              <span>水温（℃）</span>
              <input
                type="number"
                step="0.1"
                value={form.waterTempC}
                onChange={(e) => set('waterTempC', e.target.value)}
              />
            </label>
            <label className="field">
              <span>现场感官</span>
              <textarea
                rows={2}
                placeholder="清澈度、气味等"
                value={form.visualNote}
                onChange={(e) => set('visualNote', e.target.value)}
              />
            </label>
            <label className="field">
              <span>气味与温控</span>
              <div className="checkline" style={{ marginBottom: 6 }}>
                <input
                  id="cl"
                  type="checkbox"
                  checked={form.chlorineSmell}
                  onChange={(e) => set('chlorineSmell', e.target.checked)}
                />
                <label htmlFor="cl">有氯味/异味</label>
              </div>
              <div className="checkline">
                <input
                  id="cold"
                  type="checkbox"
                  checked={form.coldChainRequired}
                  onChange={(e) => set('coldChainRequired', e.target.checked)}
                />
                <label htmlFor="cold">需要 0–4℃ 冷藏运输</label>
              </div>
            </label>
            <label className="field">
              <span>封签照片 *（本地存档，作为交接核对依据）</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(f ? URL.createObjectURL(f) : '');
                }}
              />
              {preview && (
                <img src={preview} alt="封签预览" className="seal-photo" style={{ marginTop: 8 }} />
              )}
            </label>
          </div>
        </div>
        <button type="submit">登记采样批次</button>
      </form>
    </div>
  );
}
