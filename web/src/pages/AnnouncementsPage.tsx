import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Announcement } from '../types';
import { ANNOUNCEMENT_STATUS_LABELS, HANDOVER_LABELS, fmtTime } from '../labels';
import { ConclusionBadge } from '../components/badges';

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [detail, setDetail] = useState<Announcement | null>(null);
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    api<Announcement[]>('/announcements').then((items) => {
      setList(items);
      const want = Number(params.get('id'));
      if (want) {
        api<Announcement>(`/announcements/${want}`).then(setDetail).catch(() => {});
      } else if (items.length) {
        api<Announcement>(`/announcements/${items[0].id}`).then(setDetail).catch(() => {});
      }
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (a: Announcement) => {
    setParams({ id: String(a.id) });
    api<Announcement>(`/announcements/${a.id}`).then(setDetail).catch((e) => setError(e.message));
  };

  return (
    <div className="grid2">
      <div className="card">
        <h2>居民公告</h2>
        <p className="muted small">检测结论均可追溯到取样地点、时间及完整封签交接记录。（公开信息，无需身份）</p>
        {error && <div className="alert error">{error}</div>}
        {list.length === 0 && <p className="muted">暂无公告</p>}
        {list.map((a) => (
          <div
            key={a.id}
            className="result-card"
            style={{ cursor: 'pointer', borderColor: detail?.id === a.id ? 'var(--primary)' : undefined }}
            onClick={() => open(a)}
          >
            <div className="row">
              <b>{a.title}</b>
              {a.status === 'SUPERSEDED' && (
                <span className="badge" style={{ background: '#d97706' }}>{ANNOUNCEMENT_STATUS_LABELS[a.status]}</span>
              )}
              <span className="spacer" />
              <span className="muted small">{fmtTime(a.publishedAt)}</span>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {a.sample?.well?.name} · 发布人：{a.publishedBy?.name}
            </div>
          </div>
        ))}
      </div>

      <div>
        {detail?.sample && (
          <div className="card">
            <h3>{detail.title}</h3>
            {detail.status === 'SUPERSEDED' && (
              <div className="alert warn">本公告依据的检测结果已被实验室更正，请以最新公告为准。（原公告保留备查）</div>
            )}
            <p>{detail.content}</p>
            <dl className="kv">
              <dt>发布人</dt><dd>{detail.publishedBy?.name}（获授权负责人）</dd>
              <dt>发布时间</dt><dd>{fmtTime(detail.publishedAt)}</dd>
            </dl>

            <div className="trace-section">
              <h4>一、取样信息</h4>
              <dl className="kv">
                <dt>取样地点</dt>
                <dd>{detail.sample.well.code} {detail.sample.well.name}（{detail.sample.well.address}，{detail.sample.well.latitude.toFixed(4)}, {detail.sample.well.longitude.toFixed(4)}）</dd>
                <dt>取样时间</dt><dd>{fmtTime(detail.sample.sampledAt)}</dd>
                <dt>采样员</dt><dd>{detail.sample.sampler?.name}</dd>
                <dt>容器编号</dt><dd><code>{detail.sample.containerNo}</code></dd>
                <dt>现场条件</dt>
                <dd>天气 {detail.sample.weather ?? '—'}；水温 {detail.sample.waterTemp ?? '—'}℃；浊度 {detail.sample.turbidity ?? '—'} NTU</dd>
              </dl>
              {detail.sample.sealPhotoPath && (
                <img className="seal-photo" style={{ marginTop: 8 }} src={detail.sample.sealPhotoPath} alt="封签照片" />
              )}
            </div>

            <div className="trace-section">
              <h4>二、封签与交接记录（{detail.sample.handovers.length} 次）</h4>
              <table className="list">
                <thead>
                  <tr><th>次序</th><th>环节</th><th>交接人</th><th>封签</th><th>冷藏</th><th>时间</th></tr>
                </thead>
                <tbody>
                  {detail.sample.handovers.map((h) => (
                    <tr key={h.id}>
                      <td>{h.seq}</td>
                      <td>{HANDOVER_LABELS[h.type] ?? h.type}</td>
                      <td>{h.fromUser?.name} → {h.toUser?.name}</td>
                      <td>{h.sealIntact ? '完好' : '破损'}</td>
                      <td>
                        {h.coldChainOk === null || h.coldChainOk === undefined
                          ? '—'
                          : `${h.coldChainOk ? '合格' : '不合格'} ${h.temperature ?? ''}℃`}
                      </td>
                      <td>{fmtTime(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="trace-section">
              <h4>三、检测结果（含更正历史）</h4>
              {detail.sample.labResults.map((r) => (
                <div key={r.id} className={`result-card ${r.id !== detail.resultId && detail.sample!.labResults.some((x) => x.correctedFromId === r.id) ? 'corrected' : ''}`}>
                  <div className="row">
                    <b>v{r.version}</b>
                    <ConclusionBadge conclusion={r.conclusion} />
                    {r.id === detail.resultId && <span className="badge outline">本公告依据版本</span>}
                    {r.correctedFromId && <span className="badge outline">更正自 v{r.version - 1}</span>}
                    <span className="spacer" />
                    <span className="muted small">{fmtTime(r.returnedAt)}</span>
                  </div>
                  <div className="params">
                    {Object.entries(r.parameters).map(([k, v]) => (
                      <span key={k}>{k}：{String(v)}</span>
                    ))}
                  </div>
                  {r.correctionNote && <div className="small muted" style={{ marginTop: 4 }}>更正说明：{r.correctionNote}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
