// 一条命令启动：必要时先初始化，然后同时拉起后端(3000)与前端(5173)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const needSetup =
  !existsSync(join(root, 'server', 'node_modules')) ||
  !existsSync(join(root, 'web', 'node_modules')) ||
  !existsSync(join(root, 'server', 'prisma', 'dev.db'));

if (needSetup) {
  const r = spawnSync('node', ['scripts/setup.mjs'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('\n==============================================');
console.log('  后端 API:  http://localhost:3000/api');
console.log('  前端页面:  http://localhost:5173');
console.log('  规则演示:  http://localhost:5173/demo');
console.log('  命令行演示: npm run demo');
console.log('==============================================\n');

const procs = [
  spawn('npm', ['run', 'start:dev'], { cwd: join(root, 'server'), stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev'], { cwd: join(root, 'web'), stdio: 'inherit', shell: true }),
];

const shutdown = () => {
  procs.forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
procs.forEach((p) => p.on('exit', (code) => {
  if (code && code !== 0) shutdown();
}));
