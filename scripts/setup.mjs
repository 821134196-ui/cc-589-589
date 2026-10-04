// 安装依赖并初始化数据库（幂等，可重复执行）
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const run = (cmd, args, cwd) => {
  console.log(`\n>>> ${cmd} ${args.join(' ')}  (${cwd})`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`命令执行失败: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
};

// Prisma 需要 DATABASE_URL（SQLite 本地文件，无敏感信息）
const envPath = join(root, 'server', '.env');
if (!existsSync(envPath)) {
  writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\n');
  console.log('已生成 server/.env');
}

if (!existsSync(join(root, 'server', 'node_modules'))) {
  run('npm', ['install'], join(root, 'server'));
}
if (!existsSync(join(root, 'web', 'node_modules'))) {
  run('npm', ['install'], join(root, 'web'));
}

// 生成 Prisma Client、推送 schema、写入种子数据
run('npm', ['run', 'db:setup'], join(root, 'server'));

console.log('\n✅ 初始化完成');
