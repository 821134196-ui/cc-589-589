import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { errMsg, useMessage } from '../ui';
import { STATUS_META, fmt } from '../status';

interface Sample {
  id: string;
  containerCode: string;
  status: string;
  well: { code: string; name: string };
  sampledAt: string;
}

export default function LabPage() {
  const { user, hasRole } = useAuth();
  const [rows, setRows] = useState<Sample[]>([]);

  const load = () =>
    api<Sample[]>('/samples').then(setRows);
  useEffect(() => {
    load();
  }, []);

  if (!user) return <div className="card empty">请先在右上角选择登录人员（赵实验）。</div>;
  if (!hasRole('LAB'))
    return (
      <div className="card">
        <h3>无实验室权限</h3>
        <p className="sec">当前登录人「{user.name}」不能办理实验室业务，请切换为 赵实验。</p>
      </div>
    );

  const received = rows.filter((r) => r.status === 'RECEIVED');
  const tested = rows.filter((r) => ['TESTED', 'RELEASED', 'RETESTING', 'ARCHIVED'].includes(r.status));

  return (
    <div>
      <h2 className="page-title">实验室（本地模拟）</h2>
      <p className="page-sub">
        对已签收样品模拟检测并回传结果；结果需要变更时必须走「结果更正」生成新版本，
        <b>原结果永久保留、不会被覆盖</b>。
      </p>

      <div className="card">
        <h3>已签收 · 待检测（{received.length}）</h3>
        {received.length === 0 && <div className="muted">暂无待检测样品。</div>}
        <div className="grid grid-2">
          {received.map((r) => (
            <ReceivedCard key={r.id} r={r} onDone={load} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3>已出结果批次（可发起结果更正）</h3>
        <table>
          <thead>
            <tr>
              <th>容器</th>
              <th>井位</th>
              <th>状态</th>
              <th>取样时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tested.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.containerCode}</b>
                </td>
                <td>
                  {r.well.code} {r.well.name}
                </td>
                <td>
                  <span className="badge" style={{ color: STATUS_META[r.status].color, background: STATUS_META[r.status].bg }}>
                    {STATUS_META[r.status].icon} {STATUS_META[r.status].label}
                  </span>
                </td>
                <td>{fmt(r.sampledAt)}</td>
                <td>
                  <Link className="btn btn-ghost btn-sm" to={`/samples/${r.id}`}>
                    报告/更正入口
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceivedCard({ r, onDone }: { r: Sample; onDone: () => void }) {
  const { flash, node } = useMessage();
  const [busy, setBusy] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [m, setM] = useState({ ph: '7.1', turb: '1.2', coliform: '0', cl: '0.12', abnormalItem: '' });

  async function simulate(outcome: 'qualified' | 'abnormal') {
    setBusy(outcome);
    try {
      await api(`/samples/${r.id}/lab/simulate`, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      });
      flash.ok(`已回传${outcome === 'qualified' ? '合格' : '异常'}结果（v1）。`);
      onDone();
    } catch (e) {
      flash.error(errMsg(e));
    } finally {
      setBusy('');
    }
  }

  async function submitManual() {
    setBusy('manual');
    try {
      await api(`/samples/${r.id}/lab/results`, {
        method: 'POST',
        body: JSON.stringify({
          indicators: {
            ph: Number(m.ph),
            turbidityNTU: Number(m.turb),
            coliformMPN: Number(m.coliform),
            residualCl: Number(m.cl),
          },
          abnormalItem: m.abnormalItem || undefined,
        }),
      });
      flash.ok('结果已回传（v1）。');
      setShowManual(false);
      onDone();
    } catch (e) {
      flash.error(errMsg(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14 }}>
      {node}
      <b>{r.well.code} {r.well.name}</b>
      <div className="muted">容器 {r.containerCode} · 取样 {fmt(r.sampledAt)}</div>
      {!showManual ? (
        <div className="row-inline" style={{ marginTop: 10 }}>
          <button disabled={!!busy} onClick={() => simulate('qualified')}>
            模拟检测：合格
          </button>
          <button className="btn-danger" disabled={!!busy} onClick={() => simulate('abnormal')}>
            模拟检测：异常
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => setShowManual(true)}>
            手工录入指标
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="grid grid-2">
            <label className="field">
              <span>pH</span>
              <input value={m.ph} onChange={(e) => setM({ ...m, ph: e.target.value })} />
            </label>
            <label className="field">
              <span>浑浊度 NTU</span>
              <input value={m.turb} onChange={(e) => setM({ ...m, turb: e.target.value })} />
            </label>
            <label className="field">
              <span>总大肠菌群 MPN</span>
              <input value={m.coliform} onChange={(e) => setM({ ...m, coliform: e.target.value })} />
            </label>
            <label className="field">
              <span>余氯 mg/L</span>
              <input value={m.cl} onChange={(e) => setM({ ...m, cl: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>异常项（留空表示合格）</span>
            <input
              value={m.abnormalItem}
              onChange={(e) => setM({ ...m, abnormalItem: e.target.value })}
              placeholder="如：总大肠菌群超标"
            />
          </label>
          <div className="row-inline">
            <button disabled={busy === 'manual'} onClick={submitManual}>
              回传结果 v1
            </button>
            <button className="btn-ghost" onClick={() => setShowManual(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
