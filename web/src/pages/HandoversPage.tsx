import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { errMsg, useMessage } from '../ui';
import { STATUS_META, fmt } from '../status';

interface Sample {
  id: string;
  containerCode: string;
  batchNo: string;
  sampledAt: string;
  status: string;
  coldChainRequired: boolean;
  sealCode: string;
  well: { code: string; name: string };
}

export default function HandoversPage() {
  const { user, hasRole } = useAuth();
  const [rows, setRows] = useState<Sample[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, { sealIntact: boolean; coldChainOk: boolean; note: string }>>({});

  const load = () =>
    api<Sample[]>('/samples').then((ss) =>
      setRows(ss.filter((s) => ['COLLECTED', 'IN_TRANSIT', 'RECEIVED'].includes(s.status))),
    );
  useEffect(() => {
    load();
  }, []);

  const getForm = (id: string) =>
    form[id] ?? { sealIntact: true, coldChainOk: true, note: '' };
  const setF = (id: string, patch: any) =>
    setForm((f) => ({ ...f, [id]: { ...getForm(id), ...patch } }));

  async function act(id: string, action: string, patch: any = {}) {
    setBusy(id + action);
    setErrors((e) => ({ ...e, [id]: '' }));
    try {
      await api(`/samples/${id}/handovers/${action}`, {
        method: 'POST',
        body: JSON.stringify({ ...getForm(id), ...patch }),
      });
      await load();
    } catch (e) {
      // 顺序错误 / 封签破损 / 冷藏不达标 / 自放行等拦截原因在卡片内展示
      setErrors((prev) => ({ ...prev, [id]: `操作被系统拒绝：${errMsg(e)}` }));
    } finally {
      setBusy(null);
    }
  }

  if (!user)
    return <div className="card empty">请先在右上角选择登录人员。</div>;

  return (
    <div>
      <h2 className="page-title">送检交接</h2>
      <p className="page-sub">
        交接只能按实际顺序办理：<b>启运送检 → 实验室签收 →（检测）→ 负责人放行</b>。
        每一环都要核对封签与冷藏要求；封签破损/温控不达标须退样，系统将拒绝继续流转。
      </p>

      <Stage
        title="① 待启运（已采样）"
        rows={rows.filter((r) => r.status === 'COLLECTED')}
        can={hasRole('SAMPLER', 'COURIER')}
        roleHint="采样员/送检员"
        errors={errors}
        render={(r) => (
          <ActionForm r={r} getForm={getForm} setF={setF}>
            <button disabled={busy === r.id + 'send'} onClick={() => act(r.id, 'send')}>
              核对无误，启运送检
            </button>
          </ActionForm>
        )}
      />

      <Stage
        title="② 在途 · 待实验室签收"
        rows={rows.filter((r) => r.status === 'IN_TRANSIT')}
        can={hasRole('COURIER', 'LAB')}
        roleHint="送检员/实验室"
        errors={errors}
        render={(r) => (
          <ActionForm r={r} getForm={getForm} setF={setF}>
            <button disabled={busy === r.id + 'receive'} onClick={() => act(r.id, 'receive')}>
              核对无误，签收
            </button>
            {hasRole('LAB') && (
              <button
                className="btn-danger"
                disabled={busy === r.id + 'reject'}
                onClick={() =>
                  act(r.id, 'reject', {
                    sealIntact: getForm(r.id).sealIntact,
                    coldChainOk: getForm(r.id).coldChainOk,
                    note: getForm(r.id).note || '封签/冷藏不符合要求，退样',
                  })
                }
              >
                封签破损/温控异常，退样
              </button>
            )}
          </ActionForm>
        )}
      />

      {rows.length === 0 && (
        <div className="card empty">当前没有待交接的批次。</div>
      )}
    </div>
  );
}

function Stage({
  title,
  rows,
  can,
  roleHint,
  errors,
  render,
}: {
  title: string;
  rows: Sample[];
  can: boolean;
  roleHint: string;
  errors: Record<string, string>;
  render: (r: Sample) => React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="card">
      <h3>
        {title} <span className="muted">（{rows.length} 批，办理角色：{roleHint}）</span>
      </h3>
      <div className="grid">
        {rows.map((r) => (
          <div
            key={r.id}
            data-container={r.containerCode}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <b>{r.well.code} {r.well.name}</b>
                <span className="badge outline" style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                  {STATUS_META[r.status].icon} {STATUS_META[r.status].label}
                </span>
                <div className="muted" style={{ marginTop: 4 }}>
                  容器 {r.containerCode} · 封签 {r.sealCode} · 取样 {fmt(r.sampledAt)}
                  {r.coldChainRequired && ' · 需冷藏 0–4℃'}
                </div>
              </div>
              <Link className="muted" to={`/samples/${r.id}`}>
                交接记录 ›
              </Link>
            </div>
            <div style={{ marginTop: 10 }}>
              {can ? (
                render(r)
              ) : (
                <div className="muted">当前登录人无权在本环节办理（{roleHint}）。</div>
              )}
              {errors[r.id] && (
                <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
                  {errors[r.id]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionForm({
  r,
  getForm,
  setF,
  children,
}: {
  r: Sample;
  getForm: (id: string) => { sealIntact: boolean; coldChainOk: boolean; note: string };
  setF: (id: string, patch: any) => void;
  children: React.ReactNode;
}) {
  const f = getForm(r.id);
  return (
    <div>
      <div className="row-inline" style={{ marginBottom: 8 }}>
        <label className="checkline">
          <input
            type="checkbox"
            checked={f.sealIntact}
            onChange={(e) => setF(r.id, { sealIntact: e.target.checked })}
          />
          封签完好、编号一致
        </label>
        {r.coldChainRequired && (
          <label className="checkline">
            <input
              type="checkbox"
              checked={f.coldChainOk}
              onChange={(e) => setF(r.id, { coldChainOk: e.target.checked })}
            />
            冷藏温度 0–4℃ 达标
          </label>
        )}
      </div>
      <input
        style={{ marginBottom: 8 }}
        placeholder="备注（如异常情况说明）"
        value={f.note}
        onChange={(e) => setF(r.id, { note: e.target.value })}
      />
      <div className="row-inline">{children}</div>
    </div>
  );
}
