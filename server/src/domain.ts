// 领域常量：角色、样品状态、交接类型、结论、决定
// （SQLite 不支持 enum，统一以字符串落库）

export const ROLE = {
  SAMPLER: 'SAMPLER',
  COURIER: 'COURIER',
  LAB: 'LAB',
  OFFICIAL: 'OFFICIAL',
  ANNOUNCER: 'ANNOUNCER',
} as const;

export const SAMPLE_STATUS = {
  COLLECTED: 'COLLECTED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED',
  TESTED: 'TESTED',
  RELEASED: 'RELEASED',
  RETESTING: 'RETESTING',
  ARCHIVED: 'ARCHIVED',
  VOID: 'VOID',
} as const;

export const HANDOVER = {
  SEND_TO_LAB: 'SEND_TO_LAB',
  LAB_RECEIVE: 'LAB_RECEIVE',
  LAB_REJECT: 'LAB_REJECT',
  RELEASE: 'RELEASE',
} as const;

export const CONCLUSION = {
  QUALIFIED: 'QUALIFIED',
  ABNORMAL: 'ABNORMAL',
} as const;

export const DECISION = {
  PUBLISH: 'PUBLISH',
  RETEST: 'RETEST',
  ARCHIVE: 'ARCHIVE',
} as const;

export const STATUS_LABEL: Record<string, string> = {
  COLLECTED: '已采样·待送检',
  IN_TRANSIT: '送检在途',
  RECEIVED: '实验室已签收',
  REJECTED: '实验室退样',
  TESTED: '已出结果·待审核',
  RELEASED: '负责人已放行',
  RETESTING: '复测中',
  ARCHIVED: '已归档',
  VOID: '已作废',
};

export const HANDOVER_LABEL: Record<string, string> = {
  SEND_TO_LAB: '启运送检（采样员→送检员）',
  LAB_RECEIVE: '实验室签收',
  LAB_REJECT: '实验室退样',
  RELEASE: '负责人放行',
};

// 允许的交接类型 → 样品必须处于的状态；办理后进入的状态
export const HANDOVER_FLOW: Record<
  string,
  { require: string; next?: string; actorRoles: string[]; label: string }
> = {
  SEND_TO_LAB: { require: SAMPLE_STATUS.COLLECTED, next: SAMPLE_STATUS.IN_TRANSIT, actorRoles: [ROLE.SAMPLER], label: '启运送检' },
  LAB_RECEIVE: { require: SAMPLE_STATUS.IN_TRANSIT, next: SAMPLE_STATUS.RECEIVED, actorRoles: [ROLE.COURIER, ROLE.LAB], label: '实验室签收' },
  LAB_REJECT: { require: SAMPLE_STATUS.IN_TRANSIT, next: SAMPLE_STATUS.REJECTED, actorRoles: [ROLE.LAB], label: '实验室退样' },
  RELEASE: { require: SAMPLE_STATUS.TESTED, next: SAMPLE_STATUS.RELEASED, actorRoles: [ROLE.OFFICIAL], label: '负责人放行' },
};

export function parseRoles(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
