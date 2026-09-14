import { afterEach, describe, expect, it } from "vitest";
import { defaultMontageSettings } from "@/src/domain/montage";
import { db } from "@/src/server/database";
import { completeMockPayment, createPaymentIntent } from "@/src/server/payments";
import { cancelProject, completeProjectUpload, createProjectIfNoActive, reserveGeneration, staleProjects, startProjectUpload, updateProject } from "@/src/server/projects";
import { getUser } from "@/src/server/users";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("project lifecycle", () => {
  it("permits one active project and only valid upload transitions", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const first = createProjectIfNoActive("first", "42", defaultMontageSettings);
    expect(first?.status).toBe("draft");
    expect(createProjectIfNoActive("second", "42", defaultMontageSettings)).toBeUndefined();
    expect(startProjectUpload(first!.id, "42")?.status).toBe("uploading");
    expect(startProjectUpload(first!.id, "42")).toBeUndefined();
    expect(completeProjectUpload(first!.id, "42", "/tmp/input.mp4")?.status).toBe("uploaded");
    expect(completeProjectUpload(first!.id, "42", "/tmp/other.mp4")).toBeUndefined();
  });

  it("cancels a queued paid project and refunds reserved tokens once", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const payment = createPaymentIntent("42", "payment", "start", "ru_card", "payment-key")!;
    completeMockPayment("42", payment.id, "paid");
    const project = createProjectIfNoActive("queued", "42", defaultMontageSettings)!;
    updateProject(project.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
    expect(reserveGeneration(project.id, "42", "prompt")).toMatchObject({ ok: true, cost: 23 });
    const balanceAfterReserve = getUser("42").balance;
    expect(cancelProject(project.id, "42")).toBe("cancelled");
    expect(getUser("42").balance).toBe(balanceAfterReserve + 23);
    expect(cancelProject(project.id, "42")).toBe("not_cancellable");
    expect(getUser("42").balance).toBe(balanceAfterReserve + 23);
  });

  it("finds abandoned non-processing projects by their status-specific deadline", () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const project = createProjectIfNoActive("stale", "42", defaultMontageSettings)!;
    db().prepare("UPDATE projects SET status = 'uploading', updated_at = ? WHERE id = ?").run(new Date(Date.now() - 31 * 60 * 1000).toISOString(), project.id);
    expect(staleProjects()).toEqual([expect.objectContaining({ id: project.id, status: "uploading" })]);
  });
});
