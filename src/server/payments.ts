import { paymentPackage, type PaymentMethod, type PaymentOperation, type PaymentStatus } from "@/src/domain/payments";
import { appConfig } from "@/src/server/config";
import { db, now } from "@/src/server/database";
import { getUser } from "@/src/server/users";

function toPayment(row: Record<string, unknown>): PaymentOperation {
  return { id: String(row.id), packageId: String(row.package_id), method: row.method as PaymentMethod, currency: String(row.currency), amount: Number(row.amount), tokens: Number(row.tokens), status: row.status as PaymentStatus, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
export function paymentState(userId: string) {
  const user = getUser(userId);
  const paid = Boolean(db().prepare("SELECT 1 FROM payment_operations WHERE user_id = ? AND status = 'paid' LIMIT 1").get(userId));
  const trial = db().prepare("SELECT id, status, trial_unlocked_at FROM projects WHERE user_id = ? AND is_trial = 1 AND status != 'failed' ORDER BY created_at DESC LIMIT 1").get(userId) as { id: string; status: string; trial_unlocked_at: string | null } | undefined;
  return { balance: user.balance, trialAvailable: !paid && !trial, trialProjectId: trial?.id, trialUnlocked: Boolean(trial?.trial_unlocked_at), paymentEnabled: appConfig().paymentMode === "mock" };
}
export function paymentOperations(userId: string) {
  return db().prepare("SELECT * FROM payment_operations WHERE user_id = ? ORDER BY created_at DESC").all(userId).map((row) => toPayment(row as Record<string, unknown>));
}
export function createPaymentIntent(userId: string, id: string, packageId: string, method: PaymentMethod, idempotencyKey: string) {
  const item = paymentPackage(packageId);
  if (!item || appConfig().paymentMode !== "mock") return undefined;
  getUser(userId);
  const price = method === "foreign_card_2" ? { amount: item.dollars, currency: "USD" } : method === "telegram_stars" ? { amount: item.stars, currency: "XTR" } : { amount: item.rubles, currency: "RUB" };
  const time = now();
  const insert = db().prepare("INSERT OR IGNORE INTO payment_operations (id, user_id, package_id, method, currency, amount, tokens, status, idempotency_key, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)").run(id, userId, item.id, method, price.currency, price.amount, item.tokens, idempotencyKey, time, time, time);
  const row = insert.changes ? db().prepare("SELECT * FROM payment_operations WHERE id = ?").get(id) : db().prepare("SELECT * FROM payment_operations WHERE user_id = ? AND idempotency_key = ?").get(userId, idempotencyKey);
  return row ? toPayment(row as Record<string, unknown>) : undefined;
}
export function completeMockPayment(userId: string, id: string, status: Extract<PaymentStatus, "paid" | "cancelled" | "failed">) {
  return db().transaction(() => {
    const row = db().prepare("SELECT * FROM payment_operations WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const operation = toPayment(row);
    if (operation.status === "pending") {
      const time = now();
      db().prepare("UPDATE payment_operations SET status = ?, updated_at = ? WHERE id = ?").run(status, time, id);
      if (status === "paid") {
        db().prepare("UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?").run(operation.tokens, time, userId);
        db().prepare("UPDATE projects SET trial_unlocked_at = ?, updated_at = ? WHERE user_id = ? AND is_trial = 1 AND status != 'failed' AND trial_unlocked_at IS NULL").run(time, time, userId);
        const attribution = db().prepare("SELECT inviter_user_id FROM referral_attributions WHERE invited_user_id = ?").get(userId) as { inviter_user_id: string } | undefined;
        const reward = Math.floor(operation.tokens / 10);
        if (attribution && reward > 0) {
          const rewarded = db().prepare("INSERT OR IGNORE INTO referral_rewards (payment_id, inviter_user_id, invited_user_id, tokens, created_at) VALUES (?, ?, ?, ?, ?)").run(operation.id, attribution.inviter_user_id, userId, reward, time);
          if (rewarded.changes) db().prepare("UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?").run(reward, time, attribution.inviter_user_id);
        }
      }
    }
    return { operation: toPayment(db().prepare("SELECT * FROM payment_operations WHERE id = ?").get(id) as Record<string, unknown>), ...paymentState(userId) };
  })();
}
