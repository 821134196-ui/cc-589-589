export type Role = 'SAMPLER' | 'COURIER' | 'SUPERVISOR' | 'LAB';

export interface User {
  id: number;
  name: string;
  role: Role;
  canPublish: boolean;
}

export interface Well {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  latestSample?: {
    id: number;
    containerNo: string;
    status: string;
    sampledAt: string;
    latestConclusion: string | null;
  } | null;
}

export interface SampleBrief {
  id: number;
  containerNo: string;
  status: string;
  sampledAt: string;
  well?: { id: number; code: string; name: string };
  sampler?: User | null;
  latestConclusion: string | null;
}

export interface Handover {
  id: number;
  seq: number;
  type: string;
  sealIntact: boolean;
  coldChainOk?: boolean | null;
  temperature?: number | null;
  notes?: string | null;
  createdAt: string;
  fromUser: User | null;
  toUser: User | null;
}

export interface LabResult {
  id: number;
  version: number;
  parameters: Record<string, unknown>;
  conclusion: 'NORMAL' | 'ABNORMAL';
  correctedFromId?: number | null;
  correctionNote?: string | null;
  operator?: string | null;
  returnedAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  status: string;
  resultId: number;
  publishedAt: string;
  publishedBy: User | null;
  sampleId: number;
  sample?: SampleDetail;
}

export interface SampleDetail {
  id: number;
  containerNo: string;
  status: string;
  sampledAt: string;
  weather?: string | null;
  waterTemp?: number | null;
  turbidity?: number | null;
  notes?: string | null;
  sealPhotoPath?: string | null;
  rejectReason?: string | null;
  reviewNote?: string | null;
  replacesId?: number | null;
  replacedBy: { id: number; containerNo: string; status: string }[];
  createdAt: string;
  well: Well;
  sampler: User | null;
  handovers: Handover[];
  labResults: LabResult[];
  announcements: Announcement[];
}

export interface ApiError {
  status: number;
  message: string;
}
