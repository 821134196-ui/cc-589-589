import { STATUS_COLORS, STATUS_LABELS } from '../labels';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="badge" style={{ background: STATUS_COLORS[status] ?? '#64748b' }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ConclusionBadge({ conclusion }: { conclusion?: string | null }) {
  if (!conclusion) return <span className="muted">—</span>;
  return conclusion === 'NORMAL' ? (
    <span className="badge" style={{ background: '#16a34a' }}>合格</span>
  ) : (
    <span className="badge" style={{ background: '#dc2626' }}>异常</span>
  );
}
