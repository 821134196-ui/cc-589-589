import { useEffect, useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

interface LogLine {
  kind: 'req' | 'ok' | 'err' | 'info';
  text: string;
}

interface Demo {
  key: string;
  title: string;
  desc: string;
  expect: string;
  run: (ctx: Ctx, log: (l: LogLine) => void) => Promise<void>;
}

interface Ctx {
  sampler: User;
  courier: User;
  supervisor: User;
  lab: User;
  wellIds: number[];
}

let seq = 1;
const freshContainer = () => `C-DEMO-${Date.now()}-${seq++}`;

const DEMOS: Demo[] = [
  {
    key: 'dup-container',
    title: '① 容器编号冲突',
    desc: '用同一容器编号登记两个样品，第二次必须被拒绝（容器编号全局唯一）。',
    expect: '预期：第二次登记返回 409 Conflict',
    run: async (ctx, log) => {
      const no = freshContainer();
      log({ kind: 'info', text: `以采样员「${ctx.sampler.name}」身份登记样品，容器编号 ${no}` });
      const body = { wellId: ctx.wellIds[0], containerNo: no, sampledAt: new Date().toISOString(), weather: '晴' };
      log({ kind: 'req', text: `POST /api/samples  ${JSON.stringify(body)}` });
      const first = await api('/samples', { method: 'POST', body, userId: ctx.sampler.id });
      log({ kind: 'ok', text: `第一次登记成功 → 样品 #${first.id}` });
      log({ kind: 'req', text: `POST /api/samples  （相同容器编号 ${no}）` });
      try {
        await api('/samples', { method: 'POST', body, userId: ctx.sampler.id });
        log({ kind: 'err', text: '❌ 未被拒绝，规则失效！' });
      } catch (e: any) {
        log({ kind: 'err', text: `HTTP ${e.status} → ${e.message}` });
      }
    },
  },
  {
    key: 'bad-order',
    title: '② 交接顺序错误',
    desc: '样品刚登记（应办理第1步 采样→送检），送检员却试图直接办理“送检→实验室”交接。',
    expect: '预期：返回 409 Conflict，提示应办理的环节',
    run: async (ctx, log) => {
      const no = freshContainer();
      const s = await api('/samples', {
        method: 'POST',
        body: { wellId: ctx.wellIds[1 % ctx.wellIds.length], containerNo: no, sampledAt: new Date().toISOString() },
        userId: ctx.sampler.id,
      });
      log({ kind: 'info', text: `新样品 #${s.id}（${no}）状态=已登记待交接，应由采样员先办理第1步` });
      const body = { type: 'COURIER_TO_LAB', toUserId: ctx.lab.id, sealIntact: true, coldChainOk: true, temperature: 4 };
      log({ kind: 'req', text: `POST /api/samples/${s.id}/handovers  (以送检员「${ctx.courier.name}」身份，直接办第2步)\n${JSON.stringify(body)}` });
      try {
        await api(`/samples/${s.id}/handovers`, { method: 'POST', body, userId: ctx.courier.id });
        log({ kind: 'err', text: '❌ 未被拒绝，规则失效！' });
      } catch (e: any) {
        log({ kind: 'err', text: `HTTP ${e.status} → ${e.message}` });
      }
    },
  },
  {
    key: 'no-permission',
    title: '③ 无权限人员发布公告',
    desc: '采样员（未获公告发布授权）试图直接发布居民公告。',
    expect: '预期：返回 403 Forbidden',
    run: async (ctx, log) => {
      log({ kind: 'req', text: `POST /api/announcements  (以采样员「${ctx.sampler.name}」身份)\n{"sampleId": 1, "title": "擅自发布的公告"}` });
      try {
        await api('/announcements', {
          method: 'POST',
          body: { sampleId: 1, title: '擅自发布的公告' },
          userId: ctx.sampler.id,
        });
        log({ kind: 'err', text: '❌ 未被拒绝，规则失效！' });
      } catch (e: any) {
        log({ kind: 'err', text: `HTTP ${e.status} → ${e.message}` });
      }
    },
  },
  {
    key: 'self-sign',
    title: '④ 取样人签自己的放行（附加）',
    desc: '采样员办理第1步交接时，把接收人填成自己（自签放行）。',
    expect: '预期：返回 400 Bad Request',
    run: async (ctx, log) => {
      const no = freshContainer();
      const s = await api('/samples', {
        method: 'POST',
        body: { wellId: ctx.wellIds[2 % ctx.wellIds.length], containerNo: no, sampledAt: new Date().toISOString() },
        userId: ctx.sampler.id,
      });
      const body = { toUserId: ctx.sampler.id, sealIntact: true };
      log({ kind: 'req', text: `POST /api/samples/${s.id}/handovers  (接收人=采样员本人)\n${JSON.stringify(body)}` });
      try {
        await api(`/samples/${s.id}/handovers`, { method: 'POST', body, userId: ctx.sampler.id });
        log({ kind: 'err', text: '❌ 未被拒绝，规则失效！' });
      } catch (e: any) {
        log({ kind: 'err', text: `HTTP ${e.status} → ${e.message}` });
      }
    },
  },
  {
    key: 'archive-abnormal',
    title: '⑤ 异常结果未复测直接归档（附加）',
    desc: '完整走一遍送检流程并让实验室回传“异常”，负责人随后直接归档。',
    expect: '预期：归档返回 400 Bad Request，须先复测',
    run: async (ctx, log) => {
      const no = freshContainer();
      const s = await api('/samples', {
        method: 'POST',
        body: { wellId: ctx.wellIds[3 % ctx.wellIds.length], containerNo: no, sampledAt: new Date().toISOString() },
        userId: ctx.sampler.id,
      });
      log({ kind: 'info', text: `样品 #${s.id} 已登记，依次办理三步交接…` });
      await api(`/samples/${s.id}/handovers`, { method: 'POST', body: { toUserId: ctx.courier.id, sealIntact: true }, userId: ctx.sampler.id });
      await api(`/samples/${s.id}/handovers`, { method: 'POST', body: { toUserId: ctx.lab.id, sealIntact: true, coldChainOk: true, temperature: 4 }, userId: ctx.courier.id });
      await api(`/samples/${s.id}/handovers`, { method: 'POST', body: { toUserId: ctx.lab.id, sealIntact: true }, userId: ctx.lab.id });
      await api('/lab/results', {
        method: 'POST',
        body: { sampleId: s.id, parameters: { '总大肠菌群': '检出' }, conclusion: 'ABNORMAL' },
        userId: ctx.lab.id,
      });
      log({ kind: 'info', text: '实验室已回传【异常】结果，负责人尝试直接归档…' });
      log({ kind: 'req', text: `POST /api/samples/${s.id}/decision  {"action":"ARCHIVE"}` });
      try {
        await api(`/samples/${s.id}/decision`, { method: 'POST', body: { action: 'ARCHIVE' }, userId: ctx.supervisor.id });
        log({ kind: 'err', text: '❌ 未被拒绝，规则失效！' });
      } catch (e: any) {
        log({ kind: 'err', text: `HTTP ${e.status} → ${e.message}` });
      }
    },
  },
];

export default function DemoPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [wellIds, setWellIds] = useState<number[]>([]);
  const [logs, setLogs] = useState<Record<string, LogLine[]>>({});
  const [running, setRunning] = useState('');

  useEffect(() => {
    api<User[]>('/users').then(setUsers).catch(() => {});
    api<{ id: number }[]>('/wells').then((ws) => setWellIds(ws.map((w) => w.id))).catch(() => {});
  }, []);

  const ctx: Ctx | null = (() => {
    const byRole = (r: string) => users.find((u) => u.role === r);
    if (!users.length || !wellIds.length) return null;
    return {
      sampler: byRole('SAMPLER')!,
      courier: byRole('COURIER')!,
      supervisor: byRole('SUPERVISOR')!,
      lab: byRole('LAB')!,
      wellIds,
    };
  })();

  const runDemo = async (demo: Demo) => {
    if (!ctx) return;
    setRunning(demo.key);
    setLogs((m) => ({ ...m, [demo.key]: [] }));
    const log = (l: LogLine) => setLogs((m) => ({ ...m, [demo.key]: [...(m[demo.key] ?? []), l] }));
    try {
      await demo.run(ctx, log);
    } catch (e: any) {
      log({ kind: 'err', text: `演示中断：${e.message ?? e}` });
    }
    setRunning('');
  };

  return (
    <div>
      <div className="card">
        <h2>业务规则演示</h2>
        <p className="muted">
          点击按钮即对后端发起真实请求，观察系统如何拦截违规操作。演示会创建真实的样品记录（容器编号带 C-DEMO- 前缀）。
          也可在命令行运行 <code>npm run demo</code> 查看同样的演示。
        </p>
      </div>
      <div className="demo-grid">
        {DEMOS.map((d) => (
          <div className="card" key={d.key}>
            <h3>{d.title}</h3>
            <p className="small muted">{d.desc}</p>
            <p className="small"><b>{d.expect}</b></p>
            <button disabled={!ctx || running === d.key} onClick={() => runDemo(d)}>
              {running === d.key ? '执行中…' : '运行演示'}
            </button>
            {logs[d.key]?.length > 0 && (
              <div className="demo-result">
                {logs[d.key].map((l, i) => (
                  <div key={i} className={l.kind === 'err' ? 'http-err' : l.kind === 'ok' ? 'http-ok' : ''}>
                    {l.kind === 'req' ? '→ ' : l.kind === 'err' ? '✗ ' : l.kind === 'ok' ? '✓ ' : '  '}
                    {l.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
