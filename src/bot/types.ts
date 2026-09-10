export type VideoStatus = "draft" | "processing" | "completed" | "failed";
export interface VideoProject { id: number; status: VideoStatus; style: string; color: string; price: number; date: string; fullDate: string; downloadUrl?: string; }
export interface MockBalance { tokens: number; completedVideos: number; }
export interface Tariff { tokens: number; priceRubles: number; estimatedVideos: number; }
