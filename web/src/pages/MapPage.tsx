import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Well } from '../types';
import { STATUS_COLORS, STATUS_LABELS, fmtTime } from '../labels';
import { StatusBadge, ConclusionBadge } from '../components/badges';

const W = 860;
const H = 520;
const PAD = 60;

/** 最近结果异常时点位标红，优先于状态色 */
function dotColor(w: Well): string {
  const s = w.latestSample;
  if (!s) return '#94a3b8';
  if (s.latestConclusion === 'ABNORMAL' && !['ARCHIVED', 'INVALIDATED', 'REJECTED'].includes(s.status)) {
    return '#dc2626';
  }
  return STATUS_COLORS[s.status] ?? '#94a3b8';
}

export default function MapPage() {
  const [wells, setWells] = useState<Well[]>([]);
  const [selected, setSelected] = useState<Well | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Well[]>('/wells').then(setWells).catch((e) => setError(e.message));
  }, []);

  // 经纬度 → SVG 坐标
  const points = useMemo(() => {
    if (!wells.length) return [];
    const lats = wells.map((w) => w.latitude);
    const lngs = wells.map((w) => w.longitude);
    const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
    const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;
    return wells.map((w) => ({
      well: w,
      x: PAD + ((w.longitude - minLng) / lngSpan) * (W - 2 * PAD),
      y: H - PAD - ((w.latitude - minLat) / latSpan) * (H - 2 * PAD),
    }));
  }, [wells]);

  return (
    <div>
      <div className="card">
        <h2>社区水井点位图</h2>
        <p className="muted small">每口井按最近一次采样批次的状态着色；点击点位查看详情。红色表示最近检测结果异常。</p>
        {error && <div className="alert error">{error}</div>}
        <div className="grid2">
          <div className="map-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%">
              {/* 背景网格与道路示意 */}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`v${i}`} x1={(i + 1) * (W / 10)} y1={0} x2={(i + 1) * (W / 10)} y2={H} stroke="#dbe4ec" />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={(i + 1) * (H / 6)} x2={W} y2={(i + 1) * (H / 6)} stroke="#dbe4ec" />
              ))}
              <path d={`M 0 ${H * 0.55} Q ${W * 0.4} ${H * 0.45} ${W} ${H * 0.6}`} stroke="#c7d6e2" strokeWidth={14} fill="none" strokeLinecap="round" />
              <path d={`M ${W * 0.3} 0 Q ${W * 0.35} ${H * 0.5} ${W * 0.25} ${H}`} stroke="#c7d6e2" strokeWidth={10} fill="none" strokeLinecap="round" />
              {points.map(({ well, x, y }) => (
                <g
                  key={well.id}
                  className={`well-dot ${selected?.id === well.id ? 'selected' : ''}`}
                  onClick={() => setSelected(well)}
                >
                  <circle className="halo" cx={x} cy={y} r={22} />
                  <circle cx={x} cy={y} r={13} fill={dotColor(well)} stroke="#fff" strokeWidth={2.5} />
                  <text className="well-label" x={x} y={y + 34}>{well.name}</text>
                </g>
              ))}
            </svg>
          </div>
          <div>
            {selected ? (
              <div className="card" style={{ marginBottom: 0 }}>
                <h3>{selected.name} <span className="muted small">{selected.code}</span></h3>
                <dl className="kv">
                  <dt>位置</dt><dd>{selected.address ?? '—'}</dd>
                  <dt>坐标</dt><dd>{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</dd>
                  <dt>最近采样</dt>
                  <dd>{selected.latestSample ? fmtTime(selected.latestSample.sampledAt) : '暂无采样记录'}</dd>
                  {selected.latestSample && (
                    <>
                      <dt>批次状态</dt>
                      <dd><StatusBadge status={selected.latestSample.status} /></dd>
                      <dt>检测结论</dt>
                      <dd><ConclusionBadge conclusion={selected.latestSample.latestConclusion} /></dd>
                      <dt>容器编号</dt>
                      <dd><code>{selected.latestSample.containerNo}</code></dd>
                    </>
                  )}
                </dl>
                <div className="row" style={{ marginTop: 12 }}>
                  {selected.latestSample && (
                    <Link className="btn" to={`/samples/${selected.latestSample.id}`}>查看批次详情</Link>
                  )}
                  <Link className="btn secondary" to={`/samples/new?wellId=${selected.id}`}>在此井登记采样</Link>
                </div>
              </div>
            ) : (
              <div className="card muted" style={{ marginBottom: 0 }}>点击左侧点位查看井位与最近采样状态</div>
            )}
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#94a3b8' }} />无采样</span>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <span key={k}><i style={{ background: STATUS_COLORS[k] }} />{v}</span>
          ))}
          <span><i style={{ background: '#dc2626' }} />结果异常</span>
        </div>
      </div>
    </div>
  );
}
