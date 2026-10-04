import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { SampleBrief } from '../types';
import { STATUS_LABELS, fmtTime } from '../labels';
import { StatusBadge, ConclusionBadge } from '../components/badges';

export default function SamplesPage() {
  const [samples, setSamples] = useState<SampleBrief[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<SampleBrief[]>(`/samples${status ? `?status=${status}` : ''}`)
      .then(setSamples)
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>样品批次</h2>
        <span className="spacer" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Link className="btn" to="/samples/new">+ 采样登记</Link>
      </div>
      {error && <div className="alert error">{error}</div>}
      <table className="list" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>容器编号</th><th>井位</th><th>采样员</th><th>取样时间</th>
            <th>状态</th><th>最新结论</th><th></th>
          </tr>
        </thead>
        <tbody>
          {samples.map((s) => (
            <tr key={s.id}>
              <td><code>{s.containerNo}</code></td>
              <td>{s.well?.name}</td>
              <td>{s.sampler?.name}</td>
              <td>{fmtTime(s.sampledAt)}</td>
              <td><StatusBadge status={s.status} /></td>
              <td><ConclusionBadge conclusion={s.latestConclusion} /></td>
              <td><Link to={`/samples/${s.id}`}>详情</Link></td>
            </tr>
          ))}
          {!samples.length && (
            <tr><td colSpan={7} className="muted">暂无样品</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
