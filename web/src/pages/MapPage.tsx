import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { STATUS_META } from '../status';

interface MapWell {
  id: string;
  code: string;
  name: string;
  address: string;
  posX: number;
  posY: number;
  latestSample: null | {
    id: string;
    containerCode: string;
    batchNo: string;
    status: string;
    sampledAt: string;
    sealCode: string;
    qualified: boolean | null;
    announced: boolean;
  };
}

export default function MapPage() {
  const [wells, setWells] = useState<MapWell[]>([]);
  const [hover, setHover] = useState<MapWell | null>(null);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();

  const load = () => api<MapWell[]>('/wells/map').then(setWells);
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const withSample = wells.filter((w) => w.latestSample);
    const abnormal = withSample.filter(
      (w) => w.latestSample!.qualified === false && !w.latestSample!.announced,
    ).length;
    const rejected = withSample.filter((w) => w.latestSample!.status === 'REJECTED').length;
    const retesting = withSample.filter((w) => w.latestSample!.status === 'RETESTING').length;
    const announced = withSample.filter((w) => w.latestSample!.announced).length;
    return { total: wells.length, abnormal, rejected, retesting, announced };
  }, [wells]);

  const colorOf = (w: MapWell) =>
    w.latestSample ? STATUS_META[w.latestSample.status]?.color ?? '#8a887f' : '#b6b4ac';

  return (
    <div>
      <h2 className="page-title">井位采样状态图</h2>
      <p className="page-sub">
        每口井展示最近一次采样批次状态；点击井位可查看该批次完整封签与交接记录。
      </p>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <StatTile label="监测水井" value={stats.total} unit="口" tone="#2a78d6" icon="🗺️" />
        <StatTile
          label="异常待处置 / 退样"
          value={`${stats.abnormal + stats.rejected}`}
          unit={`批（异常 ${stats.abnormal} · 退样 ${stats.rejected}）`}
          tone="#d03b3b"
          icon="⚠️"
        />
        <StatTile
          label="复测中 / 已公告"
          value={`${stats.retesting} / ${stats.announced}`}
          unit="批"
          tone="#c2602f"
          icon="🔁"
        />
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="legend" style={{ marginBottom: 10 }}>
          {[
            ['COLLECTED', '待送检'],
            ['IN_TRANSIT', '在途'],
            ['RECEIVED', '已签收'],
            ['TESTED', '待审核'],
            ['RETESTING', '复测中'],
            ['REJECTED', '退样'],
            ['ARCHIVED', '已归档/公告'],
          ].map(([k, t]) => (
            <span key={k}>
              <i className="dot" style={{ background: STATUS_META[k].color }} />
              {STATUS_META[k].icon} {t}
            </span>
          ))}
          <span>
            <i className="dot" style={{ background: '#b6b4ac' }} />
            暂无采样
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 100 62" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 社区底图：道路、街区、河流，仅示意 */}
            <defs>
              <pattern id="blocks" width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="10" height="10" fill="#eef0ea" />
                <path d="M0 10 L10 0" stroke="#e1e4da" strokeWidth="0.25" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="62" fill="url(#blocks)" rx="1.5" />
            {/* 河流 */}
            <path
              d="M0 56 Q 25 50 45 55 T 100 52 L100 62 L0 62 Z"
              fill="#cfe3f2"
              opacity="0.9"
            />
            <path d="M0 56 Q 25 50 45 55 T 100 52" fill="none" stroke="#9fc6e4" strokeWidth="0.5" />
            {/* 主路 */}
            <line x1="0" y1="44" x2="100" y2="40" stroke="#ffffff" strokeWidth="2.4" />
            <line x1="0" y1="44" x2="100" y2="40" stroke="#d8d6cd" strokeWidth="0.3" strokeDasharray="1 1" />
            <line x1="52" y1="0" x2="55" y2="62" stroke="#ffffff" strokeWidth="2" />
            <line x1="52" y1="0" x2="55" y2="62" stroke="#d8d6cd" strokeWidth="0.3" strokeDasharray="1 1" />
            <text x="97" y="49" fontSize="2.6" fill="#6f93b2" textAnchor="end">
              西河
            </text>

            {wells.map((w) => {
              const c = colorOf(w);
              const s = w.latestSample?.status;
              const alertRing = s === 'REJECTED' || (w.latestSample?.qualified === false && s !== 'ARCHIVED');
              return (
                <g
                  key={w.id}
                  transform={`translate(${w.posX} ${w.posY})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(w)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => w.latestSample && navigate(`/samples/${w.latestSample.id}`)}
                >
                  {alertRing && (
                    <circle r="3.4" fill="none" stroke={c} strokeWidth="0.5" opacity="0.55">
                      <animate attributeName="r" values="2.6;4.2;2.6" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.05;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle r="2.6" fill={c} stroke="#fff" strokeWidth="0.7" />
                  <text
                    y="0.95"
                    textAnchor="middle"
                    fontSize="3"
                    fill="#fff"
                    style={{ pointerEvents: 'none' }}
                  >
                    {w.latestSample?.status === 'REJECTED'
                      ? '!'
                      : w.latestSample?.qualified === false
                        ? '?'
                        : ''}
                  </text>
                  <text
                    y="5.4"
                    textAnchor="middle"
                    fontSize="2.5"
                    fill="#3a3935"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {w.code} {w.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {hover && (
            <div
              className="card"
              style={{
                position: 'absolute',
                left: `${hover.posX}%`,
                top: `${(hover.posY / 62) * 100}%`,
                transform: 'translate(12px, -50%)',
                minWidth: 230,
                padding: '10px 14px',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {hover.code} {hover.name}
              </div>
              <div className="muted" style={{ marginBottom: 6 }}>
                {hover.address}
              </div>
              {hover.latestSample ? (
                <>
                  <span
                    className="badge"
                    style={{
                      color: STATUS_META[hover.latestSample.status]?.color,
                      background: STATUS_META[hover.latestSample.status]?.bg,
                    }}
                  >
                    {STATUS_META[hover.latestSample.status]?.icon}{' '}
                    {STATUS_META[hover.latestSample.status]?.label}
                  </span>
                  <div className="muted" style={{ marginTop: 6 }}>
                    容器 {hover.latestSample.containerCode} · 封签 {hover.latestSample.sealCode}
                    <br />
                    取样 {new Date(hover.latestSample.sampledAt).toLocaleString('zh-CN', { hour12: false })}
                  </div>
                </>
              ) : (
                <div className="muted">该井暂无采样批次</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>各井最近批次</h3>
        <table>
          <thead>
            <tr>
              <th>井号 / 地点</th>
              <th>最近取样时间</th>
              <th>容器 / 封签</th>
              <th>状态</th>
              <th>检测结论</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {wells.map((w) => {
              const m = STATUS_META[w.latestSample?.status ?? ''];
              return (
                <tr key={w.id}>
                  <td>
                    <b>{w.code}</b> {w.name}
                    <div className="muted">{w.address}</div>
                  </td>
                  <td>
                    {w.latestSample
                      ? new Date(w.latestSample.sampledAt).toLocaleString('zh-CN', { hour12: false })
                      : '—'}
                  </td>
                  <td>
                    {w.latestSample ? (
                      <>
                        {w.latestSample.containerCode}
                        <div className="muted">封签 {w.latestSample.sealCode}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {w.latestSample ? (
                      <span className="badge" style={{ color: m.color, background: m.bg }}>
                        {m.icon} {m.label}
                      </span>
                    ) : (
                      <span className="muted">暂无</span>
                    )}
                  </td>
                  <td>
                    {w.latestSample?.qualified == null ? (
                      <span className="muted">—</span>
                    ) : w.latestSample.qualified ? (
                      <span style={{ color: 'var(--good)', fontWeight: 600 }}>合格</span>
                    ) : (
                      <span style={{ color: 'var(--critical)', fontWeight: 600 }}>异常</span>
                    )}
                    {w.latestSample?.announced && (
                      <span className="muted"> · 已公告</span>
                    )}
                  </td>
                  <td>
                    {w.latestSample && <Link to={`/samples/${w.latestSample.id}`}>查看报告 ›</Link>}
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

function StatTile({
  label,
  value,
  unit,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  unit: string;
  tone: string;
  icon: string;
}) {
  return (
    <div className="card" style={{ padding: '16px 18px', borderLeft: `4px solid ${tone}` }}>
      <div className="muted" style={{ fontSize: 12.5 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: tone, lineHeight: 1.2 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{unit}</div>
    </div>
  );
}
