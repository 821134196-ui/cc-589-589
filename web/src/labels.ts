export const ROLE_LABELS: Record<string, string> = {
  SAMPLER: '采样员',
  COURIER: '送检员',
  SUPERVISOR: '负责人',
  LAB: '实验室',
};

export const STATUS_LABELS: Record<string, string> = {
  REGISTERED: '已登记待交接',
  PICKED_UP: '送检途中',
  DELIVERED: '已送达待接收',
  LAB_RECEIVED: '实验室已接收',
  REJECTED: '实验室退样',
  RESULT_RETURNED: '结果已回传',
  RETEST_REQUESTED: '待复测',
  PUBLISHED: '已公告',
  ARCHIVED: '已归档',
  INVALIDATED: '已作废(封签破损)',
};

export const STATUS_COLORS: Record<string, string> = {
  REGISTERED: '#3b82f6',
  PICKED_UP: '#f59e0b',
  DELIVERED: '#f97316',
  LAB_RECEIVED: '#8b5cf6',
  REJECTED: '#ef4444',
  RESULT_RETURNED: '#06b6d4',
  RETEST_REQUESTED: '#eab308',
  PUBLISHED: '#22c55e',
  ARCHIVED: '#6b7280',
  INVALIDATED: '#1f2937',
};

export const HANDOVER_LABELS: Record<string, string> = {
  SAMPLER_TO_COURIER: '采样员→送检员',
  COURIER_TO_LAB: '送检员→实验室',
  LAB_RECEIVE: '实验室接收确认',
};

export const CONCLUSION_LABELS: Record<string, string> = {
  NORMAL: '合格',
  ABNORMAL: '异常',
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<string, string> = {
  PUBLISHED: '已发布',
  SUPERSEDED: '已被更正',
};

export function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}
