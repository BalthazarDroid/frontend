/**
 * Tests for the Listening Genome import page (`/settings/genome-import`).
 *
 * Covers the reported incident and its fix: a user with only a Last.fm username
 * configured (no API key - the key lived on a separate settings page) clicked
 * "Import Last.fm history", got a popup, and nothing appeared in the server log.
 * The fix puts the API key on this same page (F2), shows the pair's readiness
 * before the click (F3), and surfaces the server's actual error/result inline
 * instead of only a transient toast (F4).
 */
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenomeSettings } from "@/composables/genome/types";
import GenomeSettingsView from "@/views/settings/GenomeSettings.vue";

const { sendCommandMock, toastMock } = vi.hoisted(() => ({
  sendCommandMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  api: { sendCommand: sendCommandMock },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

function baseSettings(overrides: Partial<GenomeSettings> = {}): GenomeSettings {
  return {
    half_life_days: 548,
    lastfm_username: "",
    lastfm_configured: false,
    lastfm_poll_enabled: false,
    enrich_enabled: true,
    obscurity_percentile: 25,
    min_seconds_played: 30,
    apple_import_dir: "",
    baseline_version: "v1",
    last_rebuild_at: null,
    ...overrides,
  };
}

async function mountView() {
  const wrapper = mount(GenomeSettingsView);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  sendCommandMock.mockImplementation(async (command: string) => {
    if (command === "genome/settings") return baseSettings();
    throw new Error(`unexpected command in default mock: ${command}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readiness (F3)", () => {
  it("disables Import and explains why when both username and API key are missing", async () => {
    const wrapper = await mountView();
    const importButton = wrapper.findAll("button")[0];
    expect(wrapper.text()).toContain(
      "listening_genome.settings.lastfm_missing_both",
    );
    expect(importButton.attributes("disabled")).toBeDefined();
  });

  it("still blocks the import when only the username is configured (the reported bug)", async () => {
    sendCommandMock.mockImplementation(async (command: string) => {
      if (command === "genome/settings") {
        return baseSettings({ lastfm_username: "Bob_Baird" });
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const wrapper = await mountView();
    expect(wrapper.text()).toContain(
      "listening_genome.settings.lastfm_missing_api_key",
    );
    const importButton = wrapper.findAll("button")[0];
    expect(importButton.attributes("disabled")).toBeDefined();
  });

  it("enables Import once a username is loaded and an API key is typed in", async () => {
    sendCommandMock.mockImplementation(async (command: string) => {
      if (command === "genome/settings") {
        return baseSettings({ lastfm_username: "Bob_Baird" });
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const wrapper = await mountView();
    await wrapper.get("#genome-lastfm-api-key").setValue("a-fresh-api-key");
    expect(wrapper.text()).toContain("listening_genome.settings.lastfm_ready");
    const importButton = wrapper.findAll("button")[0];
    expect(importButton.attributes("disabled")).toBeUndefined();
  });

  it("treats an already-configured key as satisfying readiness without displaying it", async () => {
    sendCommandMock.mockImplementation(async (command: string) => {
      if (command === "genome/settings") {
        return baseSettings({
          lastfm_username: "Bob_Baird",
          lastfm_configured: true,
        });
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const wrapper = await mountView();
    expect(wrapper.text()).toContain("listening_genome.settings.lastfm_ready");
    const apiKeyInput = wrapper.get<HTMLInputElement>("#genome-lastfm-api-key");
    expect(apiKeyInput.element.value).toBe("");
    const importButton = wrapper.findAll("button")[0];
    expect(importButton.attributes("disabled")).toBeUndefined();
  });

  it("links to where Last.fm API keys come from", async () => {
    const wrapper = await mountView();
    const link = wrapper.find(
      'a[href="https://www.last.fm/api/account/create"]',
    );
    expect(link.exists()).toBe(true);
  });
});

describe("saving and importing (F2)", () => {
  it("writes the typed API key through genome/settings/set before importing", async () => {
    const calls: Array<[string, unknown]> = [];
    sendCommandMock.mockImplementation(
      async (command: string, args: unknown) => {
        calls.push([command, args]);
        if (command === "genome/settings") {
          return baseSettings({ lastfm_username: "Bob_Baird" });
        }
        if (command === "genome/settings/set") {
          return baseSettings({
            lastfm_username: "Bob_Baird",
            lastfm_configured: true,
          });
        }
        if (command === "genome/import_lastfm") {
          return {
            source: "lastfm",
            rows_read: 5,
            rows_imported: 5,
            rows_skipped: 0,
            rows_duplicate: 0,
            first_played_at: null,
            last_played_at: null,
            warnings: [],
          };
        }
        throw new Error(`unexpected command: ${command}`);
      },
    );
    const wrapper = await mountView();
    await wrapper.get("#genome-lastfm-api-key").setValue("brand-new-key");
    await wrapper.get("button").trigger("click");
    await flushPromises();

    const setCall = calls.find(
      ([command]) => command === "genome/settings/set",
    );
    expect(setCall?.[1]).toMatchObject({
      settings: {
        lastfm_username: "Bob_Baird",
        lastfm_api_key: "brand-new-key",
      },
    });
    const importCall = calls.find(
      ([command]) => command === "genome/import_lastfm",
    );
    expect(importCall).toBeDefined();
  });

  it("does not resend the API key once it is already configured and left blank", async () => {
    const calls: Array<[string, unknown]> = [];
    sendCommandMock.mockImplementation(
      async (command: string, args: unknown) => {
        calls.push([command, args]);
        if (command === "genome/settings") {
          return baseSettings({
            lastfm_username: "Bob_Baird",
            lastfm_configured: true,
          });
        }
        if (command === "genome/settings/set") {
          return baseSettings({
            lastfm_username: "Bob_Baird",
            lastfm_configured: true,
          });
        }
        if (command === "genome/import_lastfm") {
          return {
            source: "lastfm",
            rows_read: 0,
            rows_imported: 0,
            rows_skipped: 0,
            rows_duplicate: 0,
            first_played_at: null,
            last_played_at: null,
            warnings: [],
          };
        }
        throw new Error(`unexpected command: ${command}`);
      },
    );
    const wrapper = await mountView();
    await wrapper.get("button").trigger("click");
    await flushPromises();

    const setCall = calls.find(
      ([command]) => command === "genome/settings/set",
    );
    expect(setCall).toBeDefined();
    expect(setCall![1]).toMatchObject({
      settings: { lastfm_username: "Bob_Baird" },
    });
    expect(
      (setCall![1] as { settings: Record<string, unknown> }).settings,
    ).not.toHaveProperty("lastfm_api_key");
  });
});

describe("errors and results surface inline (F4)", () => {
  it("shows the server's exact error message on the page, not just a popup", async () => {
    sendCommandMock.mockImplementation(async (command: string) => {
      if (command === "genome/settings") {
        return baseSettings({
          lastfm_username: "Bob_Baird",
          lastfm_configured: true,
        });
      }
      if (command === "genome/settings/set") {
        return baseSettings({
          lastfm_username: "Bob_Baird",
          lastfm_configured: true,
        });
      }
      if (command === "genome/import_lastfm") {
        throw new Error(
          "Last.fm rejected the request (403 Forbidden) — check the configured API key.",
        );
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const wrapper = await mountView();
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("check the configured API key");
    expect(toastMock.error).toHaveBeenCalled();
  });

  it("shows what happened on a successful import (rows added/skipped/duplicate)", async () => {
    sendCommandMock.mockImplementation(async (command: string) => {
      if (command === "genome/settings") {
        return baseSettings({
          lastfm_username: "Bob_Baird",
          lastfm_configured: true,
        });
      }
      if (command === "genome/settings/set") {
        return baseSettings({
          lastfm_username: "Bob_Baird",
          lastfm_configured: true,
        });
      }
      if (command === "genome/import_lastfm") {
        return {
          source: "lastfm",
          rows_read: 12,
          rows_imported: 9,
          rows_skipped: 1,
          rows_duplicate: 2,
          first_played_at: null,
          last_played_at: null,
          warnings: [],
        };
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const wrapper = await mountView();
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain(
      'listening_genome.settings.import_result_detail:{"imported":9,"skipped":1,"duplicate":2}',
    );
  });
});
