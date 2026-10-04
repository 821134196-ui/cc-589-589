// 业务常量与中文标签（前后端消息共用语义）

export const ROLES = ['SAMPLER', 'COURIER', 'SUPERVISOR', 'LAB'] as const;

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

export const HANDOVER_LABELS: Record<string, string> = {
  SAMPLER_TO_COURIER: '采样员→送检员交接',
  COURIER_TO_LAB: '送检员→实验室交接',
  LAB_RECEIVE: '实验室接收确认',
};

// 每个样品状态下应办理的下一交接环节（交接必须按此顺序办理）
export const NEXT_HANDOVER: Record<string, { type: string; seq: number }> = {
  REGISTERED: { type: 'SAMPLER_TO_COURIER', seq: 1 },
  PICKED_UP: { type: 'COURIER_TO_LAB', seq: 2 },
  DELIVERED: { type: 'LAB_RECEIVE', seq: 3 },
};

export const HANDOVER_NEXT_STATUS: Record<string, string> = {
  SAMPLER_TO_COURIER: 'PICKED_UP',
  COURIER_TO_LAB: 'DELIVERED',
  LAB_RECEIVE: 'LAB_RECEIVED',
};

// 冷藏要求：0~8℃
export const COLD_CHAIN_MIN = 0;
export const COLD_CHAIN_MAX = 8;
