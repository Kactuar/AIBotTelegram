import { afterEach, describe, expect, it } from "vitest";
import { defaultMontageSettings } from "@/src/domain/montage";
import { closeDatabase } from "@/src/server/database";
import { completeMockPayment, createPaymentIntent, paymentOperations, paymentState } from "@/src/server/payments";
import { claimReferralAttribution, getOrCreateReferralCode, referralState } from "@/src/server/referrals";
import { clearOpenRouterJob, createProject, failProject, finishProject, hasActiveProject, openRouterJob, reserveGeneration, saveOpenRouterJob, updateProject, completedProjectCount } from "@/src/server/projects";
import { getBotLanguage, getUser, profileIdentity, saveProfileIdentity, setBotLanguage } from "@/src/server/users";
import { createLegacyDatabase, createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("SQLite migrations and transactional workflows", () => {
  it("migrates the legacy user table and persists profile fields", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    createLegacyDatabase(fixture.filename);
    expect(getUser("42").balance).toBe(100);
    saveOpenRouterJob("legacy-project", { segmentIndex: 1, attempt: 1, jobId: "job-1", nextActionAt: new Date().toISOString() });
    expect(openRouterJob("legacy-project")).toMatchObject({ segmentIndex: 1, jobId: "job-1" });
    clearOpenRouterJob("legacy-project");
    expect(openRouterJob("legacy-project")).toBeUndefined();
    saveProfileIdentity("42", "Profile", "profile_user");
    expect(profileIdentity("42")).toEqual({ firstName: "Profile", username: "profile_user" });
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
