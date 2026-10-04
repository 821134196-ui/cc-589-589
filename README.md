# 社区水井水质采样与送检批次系统

采样员、送检员、负责人在此交接样品并办理批次流转；居民公告中的检测结论可追溯到**取样地点、取样时间及完整封签交接记录**。

- 后端：TypeScript + NestJS + Prisma（SQLite）
- 前端：React + Vite
- 封签照片：本地磁盘存储（`server/uploads/`）
- 实验室接口：本地模拟（`/api/lab/*`）

## 一条命令启动

```bash
npm start
```

首次运行会自动安装依赖、初始化 SQLite 数据库并写入种子数据，随后同时拉起：

| 入口 | 地址 |
| --- | --- |
| 前端页面 | http://localhost:5173 |
| 后端 API | http://localhost:3000/api |
| 规则演示页 | http://localhost:5173/demo |

其他命令：`npm run setup`（仅初始化）、`npm run demo`（命令行规则演示，需服务已启动）。

## 角色与账号（右上角切换身份）

| 用户 | 角色 | 职责 |
| --- | --- | --- |
| 张岚 | 采样员 | 登记井号、容器编号、取样时间、现场条件，上传封签照片 |
| 陈远 | 送检员 | 核对封签与冷藏要求（0~8℃），送达实验室 |
| 王谨 | 负责人（获授权） | 审核结果：发布公告 / 要求复测 / 归档 |
| 实验室接收员 | 实验室（模拟） | 接收确认、回传结果、退样、更正结果 |

身份通过请求头 `x-user-id` 标识（演示系统，无口令）。

## 业务流程

```
采样登记 → ①采样员→送检员 → ②送检员→实验室(核对冷藏) → ③实验室接收
        → 实验室回传结果 → 负责人审核 → 发布公告 / 要求复测 / 归档
```

- **点位图**：每口井按最近一次采样批次状态着色，结果异常标红。
- **批次详情**：封签照片、各次交接（监管链时间线）、检测结果版本、关联公告。
- **居民公告**：公开访问，详情含取样地点/时间、封签记录、交接链、结果版本（含更正历史）。

## 业务规则（均已实现并有演示）

| 规则 | 实现位置 | 触发结果 |
| --- | --- | --- |
| 容器编号必须唯一 | `samples.service.ts` + 数据库唯一约束 | 409 编号冲突 |
| 交接按实际顺序办理（①→②→③ 不可跳步） | `handovers.service.ts` 状态机 | 409 顺序错误 |
| 公告只允许获授权人员发布 | `announcements.service.ts`（先查权限） | 403 无权限 |
| 取样人不能签自己的放行 | `handovers.service.ts` | 400 |
| 异常结果未复测前不得归档 | `samples.service.ts#decide` | 400 |
| 封签破损 / 实验室退样：旧样品保留，须新容器重新采样，不得覆盖 | `handovers.service.ts` / `lab.service.ts` | 样品作废/退样 + `replacesId` 关联 |
| 检测结果更正：新增版本指向旧结果，旧结果与原公告保留 | `lab.service.ts#correct` | 新版本 + 旧公告标记“已被更正” |
| 送检核对冷藏（0~8℃） | `handovers.service.ts` | 400 冷藏不满足 |

## 演示三个必演场景

**方式一（页面）**：打开 http://localhost:5173/demo ，逐一点击“运行演示”，可看到真实请求与拦截响应。

**方式二（命令行）**：

```bash
npm start      # 另开终端
npm run demo
```

预期输出（实际运行结果）：

```
演示1：容器编号冲突
  ✔ 已拦截 HTTP 409 → 容器编号「C-DEMO-…」已存在（样品 #8，状态：已登记待交接），容器编号必须唯一
演示2：交接顺序错误
  ✔ 已拦截 HTTP 409 → 交接顺序错误：当前应办理「采样员→送检员交接」（第 1 步），不能办理「送检员→实验室交接」
演示3：无权限人员发布公告
  ✔ 已拦截 HTTP 403 → 无权限发布公告：「张岚」未获公告发布授权，只有获授权的负责人可以发布
附加4：自签放行 ✔ 400　附加5：异常未复测归档 ✔ 400
结果：6 项规则全部生效，0 项失效
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/users | 用户列表 |
| GET | /api/wells | 井位 + 最近采样状态（点位图） |
| POST | /api/samples | 采样登记（multipart，含封签照片） |
| GET | /api/samples / /api/samples/:id | 列表 / 批次详情（交接链+结果版本） |
| POST | /api/samples/:id/handovers | 办理下一环节交接 |
| POST | /api/samples/:id/decision | 负责人审核（RETEST / ARCHIVE） |
| POST | /api/lab/results | 实验室回传结果（模拟） |
| POST | /api/lab/reject | 实验室退样（模拟） |
| POST | /api/lab/results/:id/correct | 结果更正（旧版本保留） |
| POST | /api/announcements | 发布公告（仅获授权人员） |
| GET | /api/announcements / :id | 居民公告 / 追溯详情（公开） |
| GET | /uploads/* | 封签照片 |

## 目录结构

```
├── package.json          # 根命令：npm start / npm run demo
├── scripts/              # 一键启动、初始化、命令行演示
├── server/               # NestJS + Prisma
│   ├── prisma/schema.prisma  # 数据模型（SQLite）
│   ├── prisma/seed.js        # 种子数据（含各状态样品、更正留痕）
│   ├── uploads/              # 封签照片本地存储
│   └── src/
│       ├── common/           # 身份中间件、常量、序列化
│       ├── samples/          # 登记、审核决定（异常未复测不得归档）
│       ├── handovers/        # 交接状态机（顺序/自签/冷藏/封签破损）
│       ├── lab/              # 实验室模拟（回传/退样/更正）
│       └── announcements/    # 公告（授权校验、追溯链）
└── web/                  # React + Vite
    └── src/pages/            # 点位图/样品/登记/详情/实验室/公告/规则演示
```
