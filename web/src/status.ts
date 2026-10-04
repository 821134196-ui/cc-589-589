// 样品/交接状态的展示元数据：颜色取自 dataviz 参考状态色板（good/warning/serious/critical），
// 每个状态同时带文字与图标，不仅靠颜色区分。

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  COLLECTED: { label: '已采样·待送检', color: '#2a78d6', bg: '#e8f1fc', icon: '💧' },
  IN_TRANSIT: { label: '送检在途', color: '#b97900', bg: '#fdf3da', icon: '🚚' },
  RECEIVED: { label: '实验室已签收', color: '#0f8a5f', bg: '#e2f5ee', icon: '🔬' },
  REJECTED: { label: '实验室退样', color: '#d03b3b', bg: '#fbe7e7', icon: '⛔' },
  TESTED: { label: '已出结果·待审核', color: '#c2602f', bg: '#fdeee7', icon: '⏳' },
  RELEASED: { label: '负责人已放行', color: '#4a3aa7', bg: '#ece9fb', icon: '✅' },
  RETESTING: { label: '复测中', color: '#ec835a', bg: '#fdeee7', icon: '🔁' },
  ARCHIVED: { label: '已归档', color: '#52514e', bg: '#efeeea', icon: '📁' },
  VOID: { label: '已作废', color: '#52514e', bg: '#efeeea', icon: '✖' },
};

export const ROLE_LABEL: Record<string, string> = {
  SAMPLER: '采样员',
  COURIER: '送检员',
  LAB: '实验室',
  OFFICIAL: '负责人',
  ANNOUNCER: '公告发布',
};

export const HANDOVER_LABEL: Record<string, string> = {
  SEND_TO_LAB: '启运送检',
  LAB_RECEIVE: '实验室签收',
  LAB_REJECT: '实验室退样',
  RELEASE: '负责人放行',
};

export const fmt = (d: string) =>
  new Date(d).toLocaleString('zh-CN', { hour12: false });

export const fmtDay = (d: string) =>
  new Date(d).toLocaleString('zh-CN', { hour12: false });
