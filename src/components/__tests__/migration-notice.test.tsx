// Task 13 — UI behaviour: migration notice rendering and dismissal.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { MigrationAuditEntry } from "@/lib/data/migrations";
import { USER_MIGRATION_MESSAGES } from "@/lib/data/migrations";

const state: { entry: MigrationAuditEntry | null } = { entry: null };

vi.mock("@/lib/data/db", () => ({
  getLastMigration: () => state.entry,
  subscribeMigration: () => () => {},
  migrationMessage: () => (state.entry ? USER_MIGRATION_MESSAGES[state.entry.outcome] : ""),
}));

const { MigrationNotice } = await import("@/components/migration-notice");

function entry(outcome: MigrationAuditEntry["outcome"]): MigrationAuditEntry {
  return {
    at: new Date().toISOString(), fromVersion: 9, toVersion: 10, outcome,
    message: "test", integrity: { ok: outcome === "migrated", checks: [] },
    backupKey: "snapshot.backup.v9",
  };
}

beforeEach(() => { state.entry = null; });
afterEach(cleanup);

describe("MigrationNotice", () => {
  it("renders nothing when no migration occurred", () => {
    const { container } = render(<MigrationNotice />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for silent outcomes (fresh install / already current)", () => {
    state.entry = entry("fresh");
    const { container } = render(<MigrationNotice />);
    expect(container.firstChild).toBeNull();
  });

  it("announces a successful migration with the version range", () => {
    state.entry = entry("migrated");
    render(<MigrationNotice />);
    const el = screen.getByTestId("migration-notice");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.dataset.outcome).toBe("migrated");
    expect(el.textContent).toContain("v9 → v10");
    expect(el.textContent).toContain("upgraded");
  });

  it("uses the caution tone for a reseed", () => {
    state.entry = entry("reseeded");
    render(<MigrationNotice />);
    const el = screen.getByTestId("migration-notice");
    expect(el.className).toContain("gold");
    expect(el.textContent).toMatch(/refreshed from the canonical catalog/i);
  });

  it("dismisses on the labelled close control", () => {
    state.entry = entry("migrated");
    render(<MigrationNotice />);
    fireEvent.click(screen.getByLabelText("Dismiss data update notice"));
    expect(screen.queryByTestId("migration-notice")).toBeNull();
  });
});
