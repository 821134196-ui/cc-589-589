#!/usr/bin/env node
// 首次启动时若数据库为空（无人员），自动执行种子；之后启动不重复播种，保留真实业务数据。
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

(async () => {
  const prisma = new PrismaClient();
  try {
    const n = await prisma.user.count();
    if (n === 0) {
      console.log('数据库为空，执行初始播种…');
      execSync('npx ts-node --transpile-only prisma/seed.ts', { stdio: 'inherit' });
    } else {
      console.log(`数据库已有 ${n} 名人员，跳过播种（如需恢复演示数据：npm run setup）`);
    }
  } finally {
    await prisma.$disconnect();
  }
})();
