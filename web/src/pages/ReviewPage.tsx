import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { errMsg } from '../ui';
import { STATUS_META, fmt } from '../status';

interface SampleRow {
  id: string;
  containerCode: string;
  status: string;
  sampledAt: string;
  well: { code: string; name: string };
  collectedBy: { id: string; name: string };
  results: {
    id: string;
    version: number;
    qualified: boolean;
    conclusion: string;
    abnormalItem: string | null;
    correctionNote: string | null;
  }[];
}

export default function ReviewPage() {
  const { user, hasRole } = useAuth();
  const [rows, setRows] = useState<SampleRow[]>([]);

  const load = () =>
    api<SampleRow[]>('/samples').then((rs) =>
      setRows(
        rs
          .filter((r) => ['TESTED', 'RELEASED', 'RETESTING'].includes(r.status))
          .sort((a, b) => (a.status === 'TESTED' ? -1 : 1)),
      ),
    );
  useEffect(() => {
    load();
  }, []);

  if (!user) return <div className="card empty">请先在右上角选择登录人员（周主任 / 钱主任）。</div>;
  if (!hasRole('OFFICIAL'))
    return (
      <div className="card">
        <h3>无负责人权限</h3>
        <p className="sec">当前登录人「{user.name}」不是负责人，不能审核放行或作出处置决定。</p>
      </div>
    );

  return (
    <div>
      <h2 className="page-title">负责人审核</h2>
      <p className="page-sub">
        核对封签、交接链与检测结果后放行；取样人不能签自己的放行（系统强制拦截）。
        放行后可决定<b>公告 / 复测 / 归档</b>：异常结果未完成复测合格前禁止归档。
      </p>
      {rows.length === 0 && <div className="card empty">暂无待审核批次。</div>}
      <div className="grid">
        {rows.map((r) => (
          <ReviewCard key={r.id} r={r} currentUserId={user.id} onDone={load} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({
  r,
  currentUserId,
  onDone,
}: {
  r: SampleRow;
  currentUserId: string;
  onDone: () => void;
}) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const cur = r.results[0];
  const selfCollected = r.collectedBy.id === currentUserId;

  async function call(action: string, body: any = {}) {
    setBusy(action);
    setErr('');
    try {
      if (action === 'release') {
        await api(`/samples/${r.id}/handovers/release`, {
          method: 'POST',
          body: JSON.stringify({ sealIntact: true, note: reason }),
        });
      } else {
        await api(`/samples/${r.id}/decisions`, {
          method: 'POST',
          body: JSON.stringify({ type: action, reason }),
        });
      }
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy('');
    }
  }

  const m = STATUS_META[r.status];
  return (
    <div className="card" data-container={r.containerCode}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>
            {r.well.code} {r.well.name}
            <span className="badge" style={{ color: m.color, background: m.bg, marginLeft: 8 }}>
              {m.icon} {m.label}
            </span>
          </h3>
          <div className="muted">
            容器 {r.containerCode} · 取样 {fmt(r.sampledAt)} · 取样人 {r.collectedBy.name}
            {' · '}
            <Link to={`/samples/${r.id}`}>完整报告 / 交接链</Link>
          </div>
        </div>
      </div>

      {cur && (
        <div
          className="alert"
          style={{
            marginTop: 12,
            background: cur.qualified ? '#e7f6e7' : '#fbe7e7',
            borderColor: cur.qualified ? '#b5dfb5' : '#eab3b3',
            color: cur.qualified ? '#1e5e1e' : '#8c2424',
          }}
        >
          当前结果 <b>v{cur.version}</b>：
          {cur.qualified ? ' 合格' : ` 异常 — ${cur.abnormalItem}`}
          {cur.correctionNote && (
            <div className="muted" style={{ marginTop: 4 }}>
              更正说明：{cur.correctionNote}
            </div>
          )}
        </div>
      )}

      {err && <div className="alert alert-error">操作被拒绝：{err}</div>}

      <label className="field" style={{ marginTop: 8 }}>
        <span>意见 / 原因（记入决定记录）</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：封签完好、记录齐全，同意…" />
      </label>

      <div className="row-inline">
        {r.status === 'TESTED' && (
          <>
            <button disabled={busy === 'release'} onClick={() => call('release', {})}>
              核对封签与记录，放行
            </button>
            {selfCollected && (
              <span className="alert alert-warn" style={{ margin: 0, padding: '6px 10px' }}>
                该样品由你本人取样，系统将拒绝你签自己的放行，请由另一位负责人办理。
              </span>
            )}
          </>
        )}
        {r.status === 'RELEASED' && (
          <>
            <button disabled={!!busy} onClick={() => call('PUBLISH')}>
              同意发布公告
            </button>
            <button
              className="btn-ghost"
              style={{ borderColor: 'var(--serious)', color: 'var(--serious)' }}
              disabled={!!busy}
              onClick={() => call('RETEST')}
            >
              要求复测（新容器重采）
            </button>
            <button className="btn-ghost" disabled={!!busy} onClick={() => call('ARCHIVE')}>
              归档
            </button>
            {!cur?.qualified && (
              <span className="muted">异常批次：未复测合格前「归档」会被系统拒绝。</span>
            )}
          </>
        )}
        {r.status === 'RETESTING' && (
          <span className="sec">
            已要求复测；采样员用新容器重新采样后，原批次与复测批次将在报告中关联保留。
          </span>
        )}
      </div>
    </div>
  );
}
