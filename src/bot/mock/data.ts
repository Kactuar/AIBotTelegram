import type { MockBalance, Tariff, VideoProject } from "@/src/bot/types";
export const mockUser = { firstName: "Друг" };
export const mockVideos: VideoProject[] = [{ id: 16294, status: "completed", style: "Glass", color: "Янтарь", price: 0, date: "10.09", fullDate: "10.09.2026 10:05", downloadUrl: "https://example.com/video.mp4" }];
export const mockBalance: MockBalance = { tokens: 0, completedVideos: 1 };
export const tariffs: Tariff[] = [{ priceRubles: 1490, tokens: 240, estimatedVideos: 10 }, { priceRubles: 3490, tokens: 590, estimatedVideos: 25 }, { priceRubles: 6490, tokens: 1170, estimatedVideos: 50 }];
