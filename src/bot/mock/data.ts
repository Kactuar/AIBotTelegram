import type { MockBalance, Tariff, VideoProject } from "@/src/bot/types";
import { paymentPackages } from "@/src/domain/payments";
export const mockUser = { firstName: "Друг" };
export const mockVideos: VideoProject[] = [{ id: 16294, status: "completed", style: "Glass", color: "Янтарь", price: 0, date: "10.09", fullDate: "10.09.2026 10:05", downloadUrl: "https://example.com/video.mp4" }];
export const mockBalance: MockBalance = { tokens: 0, completedVideos: 1 };
export const tariffs: Tariff[] = paymentPackages.map(({ rubles, tokens, videos }) => ({ priceRubles: rubles, tokens, estimatedVideos: videos }));
