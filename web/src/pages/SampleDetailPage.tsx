import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useUsers } from '../user';
import type { ApiError, SampleDetail } from '../types';
import { HANDOVER_LABELS, fmtTime } from '../labels';
import { StatusBadge, ConclusionBadge } from '../components/badges';

export default function SampleDetailPage() {
  const { id } = useParams();
  const { users, current } = useUsers();
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api<SampleDetail>(`/samples/${id}`).then(setSample).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<any>) => {
    setError('');
    setNotice('');
    try {
      const r = await fn();
      if (r?.warning) setNotice(r.warning);
      else if (r?.message) setNotice(r.message);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  if (!sample) return <div className="card">{error || '加载中…'}</div>;

  const couriers = users.filter((u) => u.role === 'COURIER');
  const labUsers = users.filter((u) => u.role === 'LAB');
  const latestResult = sample.labResults[sample.labResults.length - 1];

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>批次 <code>{sample.containerNo}</code></h2>
          <StatusBadge status={sample.status} />
          {latestResult && <ConclusionBadge conclusion={latestResult.conclusion} />}
          <span className="spacer" />
          <Link to="/samples" className="btn secondary">返回列表</Link>
        </div>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert warn">{notice}</div>}

        {sample.status === 'INVALIDATED' && (
          <div className="alert error">该样品因封签破损已作废，全部记录保留备查；请用新的容器编号重新采样。</div>
        )}
        {sample.status === 'REJECTED' && (
          <div className="alert error">实验室退样：{sample.rejectReason}。记录保留，请重新采样送检。</div>
        )}
        {sample.status === 'RETEST_REQUESTED' && (
          <div className="alert warn">
            负责人已要求复测{sample.reviewNote ? `：${sample.reviewNote}` : ''}。
            <Link to={`/samples/new?wellId=${sample.well.id}`}> 去重新采样 →</Link>
          </div>
        )}
        {sample.replacedBy.length > 0 && (
          <div className="alert info">
            该批次已被重新采样替代：
            {sample.replacedBy.map((r) => (
              <Link key={r.id} to={`/samples/${r.id}`}> {r.containerNo} </Link>
            ))}
            （原记录保留，未被覆盖）
          </div>
        )}
        {sample.replacesId && (
          <div className="alert info">
            本批次替代旧样品 <Link to={`/samples/${sample.replacesId}`}>#{sample.replacesId}</Link>，旧样品与原结果保留可查。
          </div>
        )}

        <div className="grid2">
          <dl className="kv">
            <dt>井位</dt><dd>{sample.well.code} {sample.well.name}（{sample.well.address}）</dd>
            <dt>坐标</dt><dd>{sample.well.latitude.toFixed(4)}, {sample.well.longitude.toFixed(4)}</dd>
            <dt>采样员</dt><dd>{sample.sampler?.name}</dd>
            <dt>取样时间</dt><dd>{fmtTime(sample.sampledAt)}</dd>
            <dt>现场条件</dt>
            <dd>
              天气 {sample.weather ?? '—'}；水温 {sample.waterTemp ?? '—'}℃；现场浊度 {sample.turbidity ?? '—'} NTU
            </dd>
            <dt>备注</dt><dd>{sample.notes ?? '—'}</dd>
          </dl>
          <div>
            {sample.sealPhotoPath ? (
              <>
                <div className="muted small" style={{ marginBottom: 6 }}>封签照片</div>
                <img className="seal-photo" src={sample.sealPhotoPath} alt="封签照片" />
              </>
            ) : (
              <div className="muted">未上传封签照片</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>交接监管链</h3>
          {sample.handovers.length === 0 && <p className="muted">尚未办理交接</p>}
          <ul className="timeline">
            {sample.handovers.map((h) => (
              <li key={h.id} className={h.sealIntact ? '' : 'broken'}>
                <div className="t-title">
                  第{h.seq}步 · {HANDOVER_LABELS[h.type] ?? h.type}
                  {!h.sealIntact && <span className="badge" style={{ background: '#dc2626', marginLeft: 8 }}>封签破损</span>}
                </div>
                <div className="t-meta">
                  {h.fromUser?.name} → {h.toUser?.name} · {fmtTime(h.createdAt)}
                </div>
                <div className="t-meta">
                  封签{h.sealIntact ? '完好' : '破损'}
                  {h.coldChainOk !== null && h.coldChainOk !== undefined && `；冷藏${h.coldChainOk ? '合格' : '不合格'}`}
                  {h.temperature !== null && h.temperature !== undefined && `；${h.temperature}℃`}
                  {h.notes && `；${h.notes}`}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>检测结果（版本留痕）</h3>
          {sample.labResults.length === 0 && <p className="muted">实验室尚未回传结果</p>}
          {[...sample.labResults].reverse().map((r) => {
            const superseded = sample.labResults.some((x) => x.correctedFromId === r.id);
            return (
              <div key={r.id} className={`result-card ${superseded ? 'corrected' : ''}`}>
                <div className="row">
                  <b>v{r.version}</b>
                  <ConclusionBadge conclusion={r.conclusion} />
                  {r.correctedFromId && <span className="badge outline">更正自 v{r.version - 1}</span>}
                  {superseded && <span className="badge outline">已被更正（保留）</span>}
                  <span className="spacer" />
                  <span className="muted small">{fmtTime(r.returnedAt)}</span>
                </div>
                <div className="params">
                  {Object.entries(r.parameters).map(([k, v]) => (
                    <span key={k}>{k}：{String(v)}</span>
                  ))}
                </div>
                {r.correctionNote && <div className="small muted" style={{ marginTop: 6 }}>更正说明：{r.correctionNote}</div>}
              </div>
            );
          })}
          {sample.announcements.length > 0 && (
            <>
              <h4>关联公告</h4>
              {sample.announcements.map((a) => (
                <div key={a.id} className="small">
                  <Link to={`/announcements?id=${a.id}`}>{a.title}</Link>
                  {a.status === 'SUPERSEDED' && <span className="badge outline" style={{ marginLeft: 6 }}>已被更正</span>}
                  <span className="muted"> · {a.publishedBy?.name} · {fmtTime(a.publishedAt)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <ActionPanel
        sample={sample}
        currentRole={current?.role}
        currentId={current?.id}
        couriers={couriers.map((c) => ({ id: c.id, name: c.name }))}
        labUsers={labUsers.map((l) => ({ id: l.id, name: l.name }))}
        run={run}
      />
    </div>
  );
}

function ActionPanel(props: {
  sample: SampleDetail;
  currentRole?: string;
  currentId?: number;
  couriers: { id: number; name: string }[];
  labUsers: { id: number; name: string }[];
  run: (fn: () => Promise<any>) => Promise<void>;
}) {
  const { sample, currentRole, currentId, couriers, labUsers, run } = props;
  const [toUserId, setToUserId] = useState('');
  const [sealIntact, setSealIntact] = useState(true);
  const [coldChainOk, setColdChainOk] = useState(true);
  const [temperature, setTemperature] = useState('4.0');
  const [notes, setNotes] = useState('');
  const [pubTitle, setPubTitle] = useState('');
  const [pubContent, setPubContent] = useState('');
  const [showPublish, setShowPublish] = useState(false);

  const s = sample.status;
  const isSampler = currentRole === 'SAMPLER' && currentId === sample.sampler?.id;
  const lastTo = sample.handovers[sample.handovers.length - 1]?.toUser?.id;
  const isCourier = currentRole === 'COURIER' && currentId === lastTo;
  const isLabReceiver = currentRole === 'LAB' && currentId === lastTo;
  const isSupervisor = currentRole === 'SUPERVISOR';

  const handover = (extra: Record<string, unknown>) =>
    run(() =>
      api(`/samples/${sample.id}/handovers`, {
        method: 'POST',
        body: { toUserId: Number(toUserId), sealIntact, notes: notes || undefined, ...extra },
      }),
    );

  const blocks: JSX.Element[] = [];

  if (s === 'REGISTERED' && isSampler) {
    blocks.push(
      <form
        key="h1"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          handover({});
        }}
      >
        <h3>办理交接：采样员 → 送检员（第 1 步）</h3>
        <div className="row">
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} required>
            <option value="">选择送检员</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label><input type="checkbox" checked={sealIntact} onChange={(e) => setSealIntact(e.target.checked)} /> 封签完好</label>
          <input placeholder="备注（可选）" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button>确认交接</button>
        </div>
        {!sealIntact && <div className="alert warn">提交后样品将按“封签破损”作废并保留记录。</div>}
      </form>,
    );
  }

  if (s === 'PICKED_UP' && isCourier) {
    blocks.push(
      <form
        key="h2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          handover({ coldChainOk, temperature: Number(temperature) });
        }}
      >
        <h3>办理交接：送检员 → 实验室（第 2 步，核对冷藏）</h3>
        <div className="row">
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} required>
            <option value="">选择实验室接收员</option>
            {labUsers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <label><input type="checkbox" checked={sealIntact} onChange={(e) => setSealIntact(e.target.checked)} /> 封签完好</label>
          <label><input type="checkbox" checked={coldChainOk} onChange={(e) => setColdChainOk(e.target.checked)} /> 冷藏合格</label>
          <label className="row" style={{ gap: 4 }}>
            温度℃
            <input style={{ width: 80 }} type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </label>
          <button>确认送达</button>
        </div>
        <div className="muted small">冷藏要求 0~8℃，温度超限或未核对冷藏将被拒绝。</div>
      </form>,
    );
  }

  if (s === 'DELIVERED' && isLabReceiver) {
    blocks.push(
      <div key="h3">
        <h3>实验室接收确认（第 3 步）</h3>
        <div className="row">
          <label><input type="checkbox" checked={sealIntact} onChange={(e) => setSealIntact(e.target.checked)} /> 封签完好</label>
          <button onClick={() => { setToUserId(String(currentId)); run(() => api(`/samples/${sample.id}/handovers`, { method: 'POST', body: { toUserId: currentId, sealIntact } })); }}>
            确认接收
          </button>
        </div>
      </div>,
    );
  }

  if (isSupervisor && (s === 'RESULT_RETURNED' || s === 'PUBLISHED')) {
    const latest = sample.labResults[sample.labResults.length - 1];
    blocks.push(
      <div key="review">
        <h3>负责人审核</h3>
        <div className="row">
          {s === 'RESULT_RETURNED' && (
            <>
              <button onClick={() => setShowPublish(!showPublish)}>发布公告</button>
              <button className="warn" onClick={() => run(() => api(`/samples/${sample.id}/decision`, { method: 'POST', body: { action: 'RETEST' } }))}>
                要求复测
              </button>
            </>
          )}
          <button
            className="secondary"
            onClick={() => run(() => api(`/samples/${sample.id}/decision`, { method: 'POST', body: { action: 'ARCHIVE' } }))}
          >
            归档
          </button>
          {latest?.conclusion === 'ABNORMAL' && s === 'RESULT_RETURNED' && (
            <span className="muted small">结果异常：归档将被系统拒绝，须先复测。</span>
          )}
        </div>
        {showPublish && s === 'RESULT_RETURNED' && (
          <form
            style={{ marginTop: 10 }}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() =>
                api('/announcements', {
                  method: 'POST',
                  body: { sampleId: sample.id, title: pubTitle || undefined, content: pubContent || undefined },
                }),
              );
            }}
          >
            <div className="row">
              <input style={{ flex: 1 }} placeholder="公告标题（留空自动生成）" value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} />
              <button>发布</button>
            </div>
            <textarea
              rows={3}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="公告内容（留空自动生成，含结论与追溯说明）"
              value={pubContent}
              onChange={(e) => setPubContent(e.target.value)}
            />
          </form>
        )}
      </div>,
    );
  }

  if (blocks.length === 0) return null;
  return <div className="card">{blocks}</div>;
}
