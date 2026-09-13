import type { MontageSettings, ProjectRecord } from "@/src/domain/montage";
import type { PaymentOperation } from "@/src/domain/payments";

export type ApiError = { error: string };
export type AuthorizationResponse = { user: { allowed: boolean; balance: number; language: "ru" | "en"; trialAvailable: boolean }; settings: MontageSettings };
export type PaymentStateResponse = { balance: number; trialAvailable: boolean; paymentEnabled: boolean; operations: PaymentOperation[] };
export type ProjectResponse = { project?: ProjectRecord } & Partial<ApiError>;
export type AvailableProject = Pick<ProjectRecord, "id" | "settings" | "isTrial" | "trialUnlockedAt" | "createdAt" | "resultExpiresAt"> & { downloadUrl: string };
export type ProjectsResponse = { projects: AvailableProject[] } & Partial<ApiError>;
