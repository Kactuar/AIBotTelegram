import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { defaultMontageSettings } from "@/src/domain/montage";
import { closeDatabase, migrateDatabase } from "@/src/server/database";
import { completeMockPayment, createPaymentIntent, paymentOperations, paymentState } from "@/src/server/payments";
import { claimReferralAttribution, getOrCreateReferralCode, referralState } from "@/src/server/referrals";
import { clearOpenRouterJob, createProject, failProject, finishProject, hasActiveProject, openRouterJob, projectById, reserveGeneration, saveOpenRouterJob, updateProject, completedProjectCount } from "@/src/server/projects";
import { getBotLanguage, getUser, profileIdentity, saveProfileIdentity, setBotLanguage } from "@/src/server/users";
import { createLegacyDatabase, createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("SQLite migrations and transactional workflows", () => {
  it("copies a version-4 legacy schema by column name and keeps its user and project data", () => {
    const fixture = createTestDatabase({ migrate: false }); remove = fixture.remove;
    const legacy = new Database(fixture.filename);
    legacy.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1, 'old'), (2, 'old'), (3, 'old'), (4, 'old');
      CREATE TABLE users (telegram_id TEXT PRIMARY KEY, balance INTEGER NOT NULL, settings_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, first_name TEXT, username TEXT);
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, settings_json TEXT NOT NULL, prompt TEXT, input_path TEXT, result_path TEXT,
        runway_task_id TEXT, status TEXT NOT NULL, error_code TEXT, reserved_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result_expires_at TEXT, watermarked_result_path TEXT,
        is_trial INTEGER NOT NULL DEFAULT 0, trial_unlocked_at TEXT, first_name TEXT, username TEXT
      );
      CREATE TABLE openrouter_jobs (project_id TEXT PRIMARY KEY, segment_index INTEGER NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, job_id TEXT, next_action_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE payment_operations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL, method TEXT NOT NULL, currency TEXT NOT NULL, amount INTEGER NOT NULL, tokens INTEGER NOT NULL, status TEXT NOT NULL, idempotency_key TEXT NOT NULL, accepted_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE referral_codes (user_id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
      CREATE TABLE referral_attributions (invited_user_id TEXT PRIMARY KEY, inviter_user_id TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE referral_rewards (payment_id TEXT PRIMARY KEY, inviter_user_id TEXT NOT NULL, invited_user_id TEXT NOT NULL, tokens INTEGER NOT NULL, created_at TEXT NOT NULL);
    `);
    legacy.prepare("INSERT INTO users (telegram_id, balance, settings_json, created_at, updated_at, first_name, username) VALUES (?, ?, ?, ?, ?, ?, ?)").run("42", 123, "{}", "old", "old", "Legacy", "legacy_user");
    legacy.prepare("INSERT INTO projects (id, user_id, settings_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run("legacy-project", "42", JSON.stringify(defaultMontageSettings), "completed", "old", "old");
    legacy.close();

    migrateDatabase();
    expect(getUser("42").balance).toBe(123);
    expect(profileIdentity("42")).toEqual({ firstName: "Legacy", username: "legacy_user" });
    expect(projectById("legacy-project")?.status).toBe("completed");
    const connection = new Database(fixture.filename, { readonly: true });
    expect(connection.prepare("PRAGMA foreign_key_list(projects)").all()).not.toHaveLength(0);
    expect(connection.prepare("PRAGMA table_info(projects)").all()).toHaveLength(16);
    connection.close();
  });

  it("migrates the legacy user table and persists profile fields", () => {
    const fixture = createTestDatabase({ migrate: false }); remove = fixture.remove;
    createLegacyDatabase(fixture.filename);
    expect(getUser("42").balance).toBe(100);
    createProject("legacy-project", "42", defaultMontageSettings);
    saveOpenRouterJob("legacy-project", { segmentIndex: 1, attempt: 1, jobId: "job-1", nextActionAt: new Date().toISOString() });
    expect(openRouterJob("legacy-project")).toMatchObject({ segmentIndex: 1, jobId: "job-1" });
    clearOpenRouterJob("legacy-project");
    expect(openRouterJob("legacy-project")).toBeUndefined();
    saveProfileIdentity("42", "Profile", "profile_user");
    expect(profileIdentity("42")).toEqual({ firstName: "Profile", username: "profile_user" });
    expect(() => saveOpenRouterJob("missing-project", { segmentIndex: 1, attempt: 1, jobId: "job-1", nextActionAt: new Date().toISOString() })).toThrow(/FOREIGN KEY/);
  });

  it("keeps trial, paid-token refund and referral rewards idempotent", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const referralCode = getOrCreateReferralCode("500");
    expect(claimReferralAttribution("501", referralCode)).toBe(true);
    expect(claimReferralAttribution("501", referralCode)).toBe(false);
    expect(claimReferralAttribution("500", referralCode)).toBe(false);

    const trial = createProject("trial", "43", defaultMontageSettings);
    updateProject(trial.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
    expect(reserveGeneration(trial.id, "43", "prompt")).toEqual({ ok: true, trial: true, cost: 0 });
    finishProject(trial.id, "/tmp/result.mp4", "/tmp/watermarked.mp4");
    expect(completedProjectCount("43")).toBe(1);

    const paidIntent = createPaymentIntent("45", "paid", "start", "ru_card", "paid-key");
    expect(paidIntent).toBeDefined();
    completeMockPayment("45", paidIntent!.id, "paid");
    const paidProject = createProject("paid-project", "45", defaultMontageSettings);
    updateProject(paidProject.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
    expect(reserveGeneration(paidProject.id, "45", "prompt")).toEqual({ ok: true, trial: false, cost: 23 });
    failProject(paidProject.id, "provider_failed");
    expect(getUser("45").balance).toBe(340);
    expect(hasActiveProject("45")).toBe(false);

    const referralPayment = createPaymentIntent("501", "referral-payment", "active", "ru_card", "referral-key");
    expect(completeMockPayment("501", referralPayment!.id, "paid")?.operation.status).toBe("paid");
    expect(getUser("500").balance).toBe(159);
    completeMockPayment("501", referralPayment!.id, "paid");
    expect(getUser("500").balance).toBe(159);
    expect(referralState("500").earnedTokens).toBe(59);
    expect(paymentOperations("501")).toHaveLength(1);
  });

  it("persists isolated language and payment state after reopening", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    setBotLanguage("43", "en");
    expect(getBotLanguage("43")).toBe("en");
    expect(getBotLanguage("44")).toBe("ru");
    closeDatabase();
    expect(getBotLanguage("43")).toBe("en");
    expect(paymentState("43").trialAvailable).toBe(true);
  });
});
