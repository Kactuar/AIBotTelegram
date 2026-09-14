import type { MontageSettings, ProjectRecord, ProjectStatus } from "@/src/domain/montage";
import type { PaymentOperation } from "@/src/domain/payments";

export type ApiError = { error: string };
export type AuthorizationResponse = { user: { allowed: boolean; balance: number; language: "ru" | "en"; trialAvailable: boolean }; settings: MontageSettings };
export type PaymentStateResponse = { balance: number; trialAvailable: boolean; paymentEnabled: boolean; operations: PaymentOperation[] };
export type PublicProject = {
  id: string;
  status: ProjectStatus;
  errorCode: string | null;
  isTrial: boolean;
  trialUnlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  resultExpiresAt: string | null;
};
export type ProjectResponse = { project?: PublicProject } & Partial<ApiError>;
export type AvailableProject = Pick<ProjectRecord, "id" | "settings" | "isTrial" | "trialUnlockedAt" | "createdAt" | "resultExpiresAt"> & { downloadUrl: string };
export type ProjectsResponse = { projects: AvailableProject[]; activeProject?: PublicProject } & Partial<ApiError>;
