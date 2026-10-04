// 序列化：把数据库行转换为 API 输出（解析 JSON 字段、精简用户字段）

export function publicUser(u: any) {
  if (!u) return null;
  return { id: u.id, name: u.name, role: u.role, canPublish: u.canPublish };
}

export function serializeHandover(h: any) {
  return {
    id: h.id,
    seq: h.seq,
    type: h.type,
    sealIntact: h.sealIntact,
    coldChainOk: h.coldChainOk,
    temperature: h.temperature,
    notes: h.notes,
    createdAt: h.createdAt,
    fromUser: publicUser(h.fromUser),
    toUser: publicUser(h.toUser),
  };
}

export function serializeResult(r: any) {
  let parameters: Record<string, unknown> = {};
  try {
    parameters = JSON.parse(r.parameters);
  } catch {
    parameters = { 原始数据: r.parameters };
  }
  return {
    id: r.id,
    version: r.version,
    parameters,
    conclusion: r.conclusion,
    correctedFromId: r.correctedFromId,
    correctionNote: r.correctionNote,
    operator: r.operator,
    returnedAt: r.returnedAt,
  };
}

export function serializeSampleBrief(s: any) {
  return {
    id: s.id,
    containerNo: s.containerNo,
    status: s.status,
    sampledAt: s.sampledAt,
    well: s.well ? { id: s.well.id, code: s.well.code, name: s.well.name } : undefined,
    sampler: publicUser(s.sampler),
    latestConclusion: s.labResults?.[0]?.conclusion ?? null,
  };
}

export function serializeSampleDetail(s: any) {
  return {
    id: s.id,
    containerNo: s.containerNo,
    status: s.status,
    sampledAt: s.sampledAt,
    weather: s.weather,
    waterTemp: s.waterTemp,
    turbidity: s.turbidity,
    notes: s.notes,
    sealPhotoPath: s.sealPhotoPath,
    rejectReason: s.rejectReason,
    reviewNote: s.reviewNote,
    replacesId: s.replacesId,
    replacedBy: (s.replacedBy ?? []).map((x: any) => ({ id: x.id, containerNo: x.containerNo, status: x.status })),
    createdAt: s.createdAt,
    well: s.well,
    sampler: publicUser(s.sampler),
    handovers: (s.handovers ?? []).map(serializeHandover),
    labResults: (s.labResults ?? []).map(serializeResult),
    announcements: (s.announcements ?? []).map(serializeAnnouncement),
  };
}

export function serializeAnnouncement(a: any) {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    status: a.status,
    resultId: a.resultId,
    publishedAt: a.publishedAt,
    publishedBy: publicUser(a.publishedBy),
    sampleId: a.sampleId,
    sample: a.sample ? serializeSampleDetail(a.sample) : undefined,
  };
}
