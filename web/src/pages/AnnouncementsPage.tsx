import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { errMsg } from '../ui';
import { fmt } from '../status';

interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  well: { code: string; name: string; address: string };
  sample: {
    id: string;
    containerCode: string;
    batchNo: string;
    sampledAt: string;
    sealCode: string;
    sealPhotoPath: string;
  };
  publishedBy: { name: string };
}

interface SampleLite {
  id: string;
  containerCode: string;
  status: string;
  well: { code: string; name: string };
}

export default function AnnouncementsPage() {
  const { user, hasRole } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [approvables, setApprovables] = useState<SampleLite[]>([]);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = () =>
    Promise.all([api<Announcement[]>('/announcements'), api<SampleLite[]>('/samples')]).then(
      ([as, ss]) => {
        setItems(as);
        setApprovables(ss.filter((s) => s.status === 'RELEASED' || s.status === 'ARCHIVED'));
      },
    );
  useEffect(() => {
    load();
  }, []);

  async function publish() {
    setErr('');
    setOk('');
    if (!target) {
      setErr('请选择要发布公告的批次');
      return;
    }
    try {
      await api(`/samples/${target}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      setOk('公告已发布，居民可查看并追溯到取样地点、时间与封签记录。');
      setTitle('');
      setBody('');
      setTarget('');
      load();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <div>
      <h2 className="page-title">居民公告</h2>
      <p className="page-sub">
        公告结论可一路追溯到取样地点、取样时间、容器/批次、完整封签照片与各次交接记录。
        公告只允许获得发布授权的人员发布。
      </p>

      {hasRole('ANNOUNCER') && (
        <div className="card">
          <h3>发布公告（当前：{user?.name} · 已获发布授权）</h3>
          {err && <div className="alert alert-error">发布被拒绝：{err}</div>}
          {ok && <div className="alert alert-ok">{ok}</div>}
          <label className="field">
            <span>选择批次（须已由负责人作出「同意发布」决定）</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">请选择已放行批次…</option>
              {approvables.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.well.code} {s.well.name} · 容器 {s.containerCode}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>公告标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>公告正文</span>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button onClick={publish}>发布公告</button>
        </div>
      )}

      {user && !hasRole('ANNOUNCER') && (
        <div className="alert alert-warn">
          当前登录人「{user.name}」没有公告发布授权，仅可查看公告。发布请切换为 陈发布。
        </div>
      )}

      <div className="grid">
        {items.map((a) => (
          <div className="card" key={a.id}>
            <h3 style={{ marginBottom: 4 }}>{a.title}</h3>
            <div className="muted" style={{ marginBottom: 8 }}>
              {a.well.code} {a.well.name}（{a.well.address}） · {fmt(a.publishedAt)} · 发布人 {a.publishedBy.name}
            </div>
            <p style={{ margin: '0 0 10px' }}>{a.body}</p>
            <Link to={`/samples/${a.sample.id}`}>
              查看检测报告与完整封签/交接记录 ›
            </Link>
          </div>
        ))}
        {items.length === 0 && <div className="card empty">暂无公告。</div>}
      </div>
    </div>
  );
}
