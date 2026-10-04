import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useUsers } from '../user';
import type { ApiError, SampleBrief, SampleDetail } from '../types';
import { fmtTime } from '../labels';
import { StatusBadge, ConclusionBadge } from '../components/badges';

const PARAM_KEYS = ['pH', '浊度(NTU)', '余氯(mg/L)', '总大肠菌群', '菌落总数(CFU/mL)'];

export default function LabPage() {
  const { current } = useUsers();
  const [received, setReceived] = useState<SampleBrief[]>([]);
  const [returned, setReturned] = useState<SampleBrief[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api<SampleBrief[]>('/samples?status=LAB_RECEIVED').then(setReceived).catch((e) => setError(e.message));
    api<SampleBrief[]>('/samples?status=RESULT_RETURNED').then(setReturned).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<any>) => {
    setError('');
    setNotice('');
    try {
      const r = await fn();
      if (r?.message) setNotice(r.message);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  if (current?.role !== 'LAB') {
    return (
      <div className="card">
        <h2>实验室工作台（本地模拟）</h2>
        <div className="alert warn">请在右上角切换身份为「实验室接收员」后操作。</div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      <div className="card">
        <h2>待回传结果（已接收样品）</h2>
        {received.length === 0 && <p className="muted">暂无待检样品</p>}
        {received.map((s) => (
          <ResultForm key={s.id} sample={s} onSubmit={(parameters, conclusion) =>
            run(() => api('/lab/results', { method: 'POST', body: { sampleId: s.id, parameters, conclusion } }))
          } onReject={(reason) =>
            run(() => api('/lab/reject', { method: 'POST', body: { sampleId: s.id, reason } }))
          } />
        ))}
      </div>

      <div className="card">
        <h2>已回传（可更正结果）</h2>
        {returned.length === 0 && <p className="muted">暂无</p>}
        {returned.map((s) => (
          <CorrectForm key={s.id} sampleId={s.id} containerNo={s.containerNo} onSubmit={(resultId, parameters, conclusion, note) =>
            run(() => api(`/lab/results/${resultId}/correct`, { method: 'POST', body: { parameters, conclusion, note } }))
          } />
        ))}
      </div>
    </div>
  );
}

function ResultForm(props: {
  sample: SampleBrief;
  onSubmit: (parameters: Record<string, string>, conclusion: 'NORMAL' | 'ABNORMAL') => void;
  onReject: (reason: string) => void;
}) {
  const { sample } = props;
  const [values, setValues] = useState<Record<string, string>>({});
  const [conclusion, setConclusion] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <form
      className="result-card"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        props.onSubmit(values, conclusion);
      }}
    >
      <div className="row">
        <b><code>{sample.containerNo}</code></b>
        <span className="muted">{sample.well?.name}</span>
        <StatusBadge status={sample.status} />
        <span className="spacer" />
        <Link to={`/samples/${sample.id}`} className="small">详情</Link>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {PARAM_KEYS.map((k) => (
          <label key={k} className="row" style={{ gap: 4, fontSize: 13 }}>
            {k}
            <input
              style={{ width: 110 }}
              value={values[k] ?? ''}
              onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              required
            />
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label><input type="radio" checked={conclusion === 'NORMAL'} onChange={() => setConclusion('NORMAL')} /> 合格</label>
        <label><input type="radio" checked={conclusion === 'ABNORMAL'} onChange={() => setConclusion('ABNORMAL')} /> 异常</label>
        <span className="spacer" />
        <button type="submit">回传结果</button>
        <button type="button" className="danger" onClick={() => setRejecting(!rejecting)}>退样</button>
      </div>
      {rejecting && (
        <div className="row" style={{ marginTop: 8 }}>
          <input style={{ flex: 1 }} placeholder="退样原因（如：容器泄漏 / 超保存期）" value={reason} onChange={(e) => setReason(e.target.value)} required />
          <button type="button" className="danger" onClick={() => reason && props.onReject(reason)}>确认退样</button>
        </div>
      )}
    </form>
  );
}

function CorrectForm(props: {
  sampleId: number;
  containerNo: string;
  onSubmit: (resultId: number, parameters: Record<string, string>, conclusion: 'NORMAL' | 'ABNORMAL', note: string) => void;
}) {
  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [conclusion, setConclusion] = useState<'NORMAL' | 'ABNORMAL'>('NORMAL');
  const [note, setNote] = useState('');

  useEffect(() => {
    api<SampleDetail>(`/samples/${props.sampleId}`).then((d) => {
      setDetail(d);
      const latest = d.labResults[d.labResults.length - 1];
      if (latest) {
        const v: Record<string, string> = {};
        Object.entries(latest.parameters).forEach(([k, val]) => (v[k] = String(val)));
        setValues(v);
        setConclusion(latest.conclusion);
      }
    }).catch(() => {});
  }, [props.sampleId]);

  const latest = detail?.labResults[detail.labResults.length - 1];
  if (!latest) return null;

  return (
    <div className="result-card">
      <div className="row">
        <b><code>{props.containerNo}</code></b>
        <ConclusionBadge conclusion={latest.conclusion} />
        <span className="muted small">v{latest.version} · {fmtTime(latest.returnedAt)}</span>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={() => setOpen(!open)}>
          {open ? '收起' : '更正结果'}
        </button>
      </div>
      {open && (
        <form
          style={{ marginTop: 8 }}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            props.onSubmit(latest.id, values, conclusion, note);
            setOpen(false);
          }}
        >
          <div className="row">
            {Object.keys(values).map((k) => (
              <label key={k} className="row" style={{ gap: 4, fontSize: 13 }}>
                {k}
                <input style={{ width: 100 }} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} required />
              </label>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label><input type="radio" checked={conclusion === 'NORMAL'} onChange={() => setConclusion('NORMAL')} /> 合格</label>
            <label><input type="radio" checked={conclusion === 'ABNORMAL'} onChange={() => setConclusion('ABNORMAL')} /> 异常</label>
            <input style={{ flex: 1 }} placeholder="更正说明（必填）" value={note} onChange={(e) => setNote(e.target.value)} required />
            <button type="submit">提交更正（生成新版本，旧版本保留）</button>
          </div>
        </form>
      )}
    </div>
  );
}
