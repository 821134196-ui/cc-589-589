import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { errMsg } from '../ui';
import { HANDOVER_LABEL, STATUS_META, fmt } from '../status';

interface Report {
  id: string;
  containerCode: string;
  batchNo: string;
  sampledAt: string;
  status: string;
  weather: string;
  waterTempC: number;
  chlorineSmell: boolean;
  visualNote: string;
  sealCode: string;
  sealPhotoPath: string;
  sealIntactAtCollect: boolean;
  coldChainRequired: boolean;
  createdAt: string;
  well: { code: string; name: string; address: string };
  collectedBy: { name: string; login: string };
  retestOf: null | { id: string; containerCode: string; batchNo: string; status: string };
  retest: null | { id: string; containerCode: string; batchNo: string; status: string };
  handovers: {
    id: string;
    seq: number;
    type: string;
    sealIntact: boolean;
    coldChainOk: boolean | null;
    note: string;
    occurredAt: string;
    fromUser: { name: string } | null;
    approver: { name: string } | null;
  }[];
  results: {
    id: string;
    version: number;
    isCurrent: boolean;
    indicators: Record<string, number>;
    conclusion: string;
    qualified: boolean;
    abnormalItem: string | null;
    testedAt: string;
    correctionNote: string | null;
    recordedBy: { name: string };
  }[];
  decisions: {
    id: string;
    type: string;
    reason: string;
    createdAt: string;
    official: { name: string };
    result: { version: number } | null;
  }[];
  announcements: {
    id: string;
    title: string;
    publishedAt: string;
    publishedBy: { name: string };
    withdrawn: boolean;
  }[];
}

const DECISION_LABEL: Record<string, string> = {
  PUBLISH: '同意发布公告',
  RETEST: '要求复测',
  ARCHIVE: '归档',
};

export default function ReportPage() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const [r, setR] = useState<Report | null>(null);

  const load = () => api<Report>(`/samples/${id}/report`).then(setR);
  useEffect(() => {
    load();
  }, [id]);

  if (!r) return <div className="card empty">加载中…</div>;
  const m = STATUS_META[r.status];

  return (
    <div>
      <div className="muted" style={{ marginBottom: 8 }}>
        <Link to="/">井位地图</Link> / <Link to="/samples">样品批次</Link> / 报告详情
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 className="page-title" style={{ marginBottom: 4 }}>
              {r.well.code} {r.well.name} · {r.batchNo}
            </h2>
            <div className="sec">
              {r.well.address} · 容器 <b>{r.containerCode}</b> · 取样人 {r.collectedBy.name}
            </div>
          </div>
          <span className="badge" style={{ color: m.color, background: m.bg, alignSelf: 'center' }}>
            {m.icon} {m.label}
          </span>
        </div>

        {(r.retestOf || r.retest) && (
          <div className="alert alert-warn" style={{ marginTop: 14, marginBottom: 0 }}>
            {r.retestOf && (
              <>
                本批次是对原批次 <Link to={`/samples/${r.retestOf.id}`}>{r.retestOf.containerCode}</Link> 的
                <b>复测（新容器）</b>；原样品与原结果保留，未被覆盖。
              </>
            )}
            {r.retest && (
              <>
                本批次异常后已安排复测，复测批次：
                <Link to={`/samples/${r.retest.id}`}> {r.retest.containerCode}</Link>（{STATUS_META[r.retest.status]?.label}）。
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>① 取样登记与封签</h3>
          <img className="seal-photo" src={r.sealPhotoPath} alt="封签照片" />
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>封签编号</dt>
            <dd>
              <b>{r.sealCode}</b>（取样时{r.sealIntactAtCollect ? '完好' : '已破损'}）
            </dd>
            <dt>取样时间</dt>
            <dd>{fmt(r.sampledAt)}</dd>
            <dt>现场环境</dt>
            <dd>{r.weather}</dd>
            <dt>水温</dt>
            <dd>{r.waterTempC} ℃</dd>
            <dt>感官</dt>
            <dd>
              {r.visualNote || '无'}
              {r.chlorineSmell && '；有氯味/异味'}
            </dd>
            <dt>温控要求</dt>
            <dd>{r.coldChainRequired ? '0–4℃ 冷藏运输' : '常温运输'}</dd>
            <dt>照片存档</dt>
            <dd className="muted">{r.sealPhotoPath}（本地存放）</dd>
          </dl>
        </div>

        <div className="card">
          <h3>② 各次交接（按实际顺序）</h3>
          <ol className="timeline">
            {r.handovers.map((h) => {
              const bad = h.type === 'LAB_REJECT' || h.sealIntact === false;
              const actor = h.approver?.name ?? h.fromUser?.name ?? '—';
              return (
                <li key={h.id} className={bad ? 'bad' : ''}>
                  <div style={{ fontWeight: 600 }}>
                    <span className="muted">#{h.seq}</span> {HANDOVER_LABEL[h.type] ?? h.type}
                  </div>
                  <div className="muted">
                    {fmt(h.occurredAt)} · 办理人 {actor}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    封签：
                    <b style={{ color: h.sealIntact ? 'var(--good)' : 'var(--critical)' }}>
                      {h.sealIntact ? '完好一致' : '破损/不一致'}
                    </b>
                    {h.coldChainOk != null && (
                      <>
                        {' '}· 冷藏：
                        <b style={{ color: h.coldChainOk ? 'var(--good)' : 'var(--critical)' }}>
                          {h.coldChainOk ? '达标' : '不达标'}
                        </b>
                      </>
                    )}
                  </div>
                  {h.note && <div className="sec" style={{ fontSize: 13 }}>备注：{h.note}</div>}
                </li>
              );
            })}
            {r.handovers.length === 0 && <li className="muted">尚无交接记录</li>}
          </ol>
        </div>
      </div>

      <div className="card">
        <h3>③ 检测结果（版本链 · 更正不覆盖原结果）</h3>
        <table>
          <thead>
            <tr>
              <th>版本</th>
              <th>pH</th>
              <th>浑浊度 NTU</th>
              <th>总大肠菌群 MPN</th>
              <th>余氯 mg/L</th>
              <th>结论</th>
              <th>检测时间 / 检测员</th>
              <th>更正说明</th>
            </tr>
          </thead>
          <tbody>
            {r.results.map((v) => (
              <tr key={v.id} style={v.isCurrent ? undefined : { color: 'var(--text-muted)', background: '#f7f6f2' }}>
                <td>
                  v{v.version}{' '}
                  {v.isCurrent ? (
                    <span className="badge" style={{ background: '#e2f5ee', color: '#0f8a5f' }}>
                      当前
                    </span>
                  ) : (
                    <span className="badge outline" style={{ color: 'var(--text-muted)' }}>
                      旧版保留
                    </span>
                  )}
                </td>
                <td>{v.indicators.ph}</td>
                <td>{v.indicators.turbidityNTU}</td>
                <td>{v.indicators.coliformMPN}</td>
                <td>{v.indicators.residualCl}</td>
                <td>
                  <b style={{ color: v.qualified ? 'var(--good)' : 'var(--critical)' }}>
                    {v.qualified ? '合格' : '异常'}
                  </b>
                  {v.abnormalItem && <div className="muted">{v.abnormalItem}</div>}
                </td>
                <td>
                  {fmt(v.testedAt)}
                  <div className="muted">{v.recordedBy.name}</div>
                </td>
                <td className="sec">{v.correctionNote ?? '—'}</td>
              </tr>
            ))}
            {r.results.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  实验室尚未回传结果
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {hasRole('LAB') && r.results.length > 0 && <CorrectForm sampleId={r.id} onDone={load} />}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>④ 负责人决定</h3>
          <ol className="timeline">
            {r.decisions.map((d) => (
              <li key={d.id}>
                <div style={{ fontWeight: 600 }}>
                  {DECISION_LABEL[d.type] ?? d.type}
                  {d.result && <span className="muted">（依据结果 v{d.result.version}）</span>}
                </div>
                <div className="muted">
                  {fmt(d.createdAt)} · {d.official.name}
                </div>
                {d.reason && <div style={{ fontSize: 13 }}>{d.reason}</div>}
              </li>
            ))}
            {r.decisions.length === 0 && <li className="muted">尚无决定</li>}
          </ol>
        </div>

        <div className="card">
          <h3>⑤ 居民公告</h3>
          {r.announcements.length === 0 && <div className="muted">该批次尚未发布公告</div>}
          {r.announcements.map((a) => (
            <div key={a.id} style={{ paddingBottom: 10 }}>
              <b>{a.title}</b>
              <div className="muted">
                {fmt(a.publishedAt)} · {a.publishedBy.name}
                {a.withdrawn && ' · 已撤回（记录保留）'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CorrectForm({ sampleId, onDone }: { sampleId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ ph: '7.1', turb: '1.0', coliform: '0', cl: '0.12', qualified: true, note: '' });

  async function submit() {
    setErr('');
    try {
      await api(`/samples/${sampleId}/lab/correct`, {
        method: 'POST',
        body: JSON.stringify({
          indicators: {
            ph: Number(f.ph),
            turbidityNTU: Number(f.turb),
            coliformMPN: Number(f.coliform),
            residualCl: Number(f.cl),
          },
          qualified: f.qualified,
          correctionNote: f.note,
        }),
      });
      setOpen(false);
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  if (!open)
    return (
      <div style={{ marginTop: 12 }}>
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          实验室：发起结果更正（旧版本保留）
        </button>
      </div>
    );

  return (
    <div
      style={{
        marginTop: 14,
        border: '1px dashed var(--line)',
        borderRadius: 8,
        padding: 14,
        background: '#faf9f6',
      }}
    >
      <h3 style={{ fontSize: 14 }}>结果更正（生成新版本，原版本保留）</h3>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="grid grid-3" style={{ gap: 10 }}>
        <label className="field">
          <span>pH</span>
          <input value={f.ph} onChange={(e) => setF({ ...f, ph: e.target.value })} />
        </label>
        <label className="field">
          <span>浑浊度 NTU</span>
          <input value={f.turb} onChange={(e) => setF({ ...f, turb: e.target.value })} />
        </label>
        <label className="field">
          <span>总大肠菌群 MPN</span>
          <input value={f.coliform} onChange={(e) => setF({ ...f, coliform: e.target.value })} />
        </label>
        <label className="field">
          <span>余氯 mg/L</span>
          <input value={f.cl} onChange={(e) => setF({ ...f, cl: e.target.value })} />
        </label>
        <label className="field">
          <span>更正后结论</span>
          <select
            value={f.qualified ? 'q' : 'a'}
            onChange={(e) => setF({ ...f, qualified: e.target.value === 'q' })}
          >
            <option value="q">合格</option>
            <option value="a">异常</option>
          </select>
        </label>
        <label className="field">
          <span>更正原因 *</span>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="如：复核为平行样污染误判" />
        </label>
      </div>
      <div className="row-inline">
        <button onClick={submit} disabled={!f.note}>
          提交更正（新版本）
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          取消
        </button>
      </div>
    </div>
  );
}
