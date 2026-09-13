import crypto from "node:crypto";
import { db, now } from "@/src/server/database";
import { getUser } from "@/src/server/users";

export interface ReferralDay { date: string; invited: number; payments: number; }
export interface ReferralState { balance: number; invitedCount: number; earnedTokens: number; last7Days: ReferralDay[]; }

export function getOrCreateReferralCode(userId: string) {
  getUser(userId);
  const existing = db().prepare("SELECT code FROM referral_codes WHERE user_id = ?").get(userId) as { code: string } | undefined;
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(6).toString("base64url");
    const inserted = db().prepare("INSERT OR IGNORE INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)").run(userId, code, now());
    if (inserted.changes) return code;
    const concurrent = db().prepare("SELECT code FROM referral_codes WHERE user_id = ?").get(userId) as { code: string } | undefined;
    if (concurrent) return concurrent.code;
  }
  throw new Error("referral_code_generation_failed");
}
export function claimReferralAttribution(invitedUserId: string, code: string | undefined) {
  if (!code || !/^[A-Za-z0-9_-]{8}$/.test(code)) return false;
  const referral = db().prepare("SELECT user_id FROM referral_codes WHERE code = ?").get(code) as { user_id: string } | undefined;
  if (!referral || referral.user_id === invitedUserId) return false;
  return Boolean(db().prepare("INSERT OR IGNORE INTO referral_attributions (invited_user_id, inviter_user_id, created_at) VALUES (?, ?, ?)").run(invitedUserId, referral.user_id, now()).changes);
}
export function referralState(userId: string): ReferralState {
  const user = getUser(userId);
  const database = db();
  const invitedCount = Number((database.prepare("SELECT COUNT(*) AS count FROM referral_attributions WHERE inviter_user_id = ?").get(userId) as { count: number }).count);
  const earnedTokens = Number((database.prepare("SELECT COALESCE(SUM(tokens), 0) AS tokens FROM referral_rewards WHERE inviter_user_id = ?").get(userId) as { tokens: number }).tokens);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return date.toISOString().slice(0, 10); });
  const since = `${dates[0]}T00:00:00.000Z`;
  const invitedByDate = new Map((database.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM referral_attributions WHERE inviter_user_id = ? AND created_at >= ? GROUP BY date").all(userId, since) as { date: string; count: number }[]).map((row) => [row.date, Number(row.count)]));
  const paymentsByDate = new Map((database.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM referral_rewards WHERE inviter_user_id = ? AND created_at >= ? GROUP BY date").all(userId, since) as { date: string; count: number }[]).map((row) => [row.date, Number(row.count)]));
  return { balance: user.balance, invitedCount, earnedTokens, last7Days: dates.map((date) => ({ date, invited: invitedByDate.get(date) ?? 0, payments: paymentsByDate.get(date) ?? 0 })) };
}
