import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_META, fmt } from '../status';

interface Row {
  id: string;
  containerCode: string;
  batchNo: string;
  sampledAt: string;
  status: string;
  well: { code: string; name: string };
  collectedBy: { name: string };
  sealCode: string;
  coldChainRequired: boolean;
  results: { qualified: boolean }[];
}

export default function SamplesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kw, setKw] = useState('');

  const load = () => api<Row[]>('/samples').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter(
    (r) =>
      !kw ||
      r.containerCode.includes(kw) ||
      r.batchNo.includes(kw) ||
      r.well.code.includes(kw) ||
      r.well.name.includes(kw) ||
      r.sealCode.includes(kw),
  );

  return (
    <div>
      <h2 className="page-title">样品批次</h2>
      <p className="page-sub">
        全部采样批次按取样时间倒序；容器编号唯一、永不覆盖，退样/作废与更正均保留原批次。
      </p>
      <div className="card">
        <div className="row-inline" style={{ marginBottom: 12 }}>
          <input
            style={{ maxWidth: 320 }}
            placeholder="搜索 容器编号 / 批次号 / 井号 / 封签号"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <span className="muted">共 {filtered.length} 批</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>批次 / 容器</th>
              <th>井位</th>
              <th>取样时间</th>
              <th>取样人</th>
              <th>封签 / 冷藏</th>
              <th>当前状态</th>
              <th>结论</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const m = STATUS_META[r.status];
              const q = r.results[0]?.qualified;
              return (
                <tr key={r.id}>
                  <td>
                    <b>{r.containerCode}</b>
                    <div className="muted">{r.batchNo}</div>
                  </td>
                  <td>
                    {r.well.code} {r.well.name}
                  </td>
                  <td>{fmt(r.sampledAt)}</td>
                  <td>{r.collectedBy.name}</td>
                  <td>
                    {r.sealCode}
                    <div className="muted">{r.coldChainRequired ? '需冷藏 0–4℃' : '常温'}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ color: m.color, background: m.bg }}>
                      {m.icon} {m.label}
                    </span>
                  </td>
                  <td>
                    {q == null ? (
                      <span className="muted">—</span>
                    ) : q ? (
                      <span style={{ color: 'var(--good)', fontWeight: 600 }}>合格</span>
                    ) : (
                      <span style={{ color: 'var(--critical)', fontWeight: 600 }}>异常</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn btn-ghost btn-sm" to={`/samples/${r.id}`}>
                      报告详情
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
