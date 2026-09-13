/**
 * Contract tests for the molecule's degraded states.
 *
 * These exist because of a live failure: `bases` and `base_mix` were added to the
 * server's GenomeResult, but a cached result written before that change was still
 * served, so the component received `bases: undefined`, threw inside its render, and
 * took the whole card's content down. Nothing appeared in the server log — the only
 * trace was a browser console warning. Rendering *something* on a partial payload is
 * the property under test, not the styling.
 */
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GenomeMolecule from "./GenomeMolecule.vue";
import { i18n } from "@/plugins/i18n";
import type { GenreShare } from "@/composables/genome/types";

function genre(key: string, share: number, mix?: number[]): GenreShare {
  return {
    key,
    label: key,
    share,
    baseline_share: 0.01,
    ratio: share / 0.01,
    contribution: 0.1,
    ...(mix === undefined ? {} : { base_mix: mix }),
  } as GenreShare;
}

function render(props: Record<string, unknown>) {
  return mount(GenomeMolecule, {
    props,
    global: { plugins: [i18n] },
  });
}

describe("GenomeMolecule", () => {
  const genres = [
    genre("rock", 0.3, []),
    genre("punk", 0.2, []),
    genre("dance", 0.15, []),
    genre("ambient", 0.1, []),
    genre("dub", 0.05, [0.4, 0.3, 0.2, 0.1]),
  ];
  const bases = genres.slice(0, 4);

  it("renders the stage with a full payload", () => {
    const w = render({ genres, bases, totalListens: 100 });
    expect(w.find(".genome-stage").exists()).toBe(true);
    expect(w.findAll(".genome-baserow")).toHaveLength(4);
  });

  it("still renders the stage when `bases` is missing entirely", () => {
    // The exact shape served from a cache written before `bases` existed.
    const w = render({ genres, totalListens: 100 });
    expect(w.find(".genome-stage").exists()).toBe(true);
    expect(w.findAll(".genome-baserow")).toHaveLength(0);
  });

  it("still renders the stage when `base_mix` is missing from every genre", () => {
    const bare = genres.map((g) => genre(g.key, g.share));
    const w = render({
      genres: bare,
      bases: bare.slice(0, 4),
      totalListens: 100,
    });
    expect(w.find(".genome-stage").exists()).toBe(true);
    // No rung can be tinted by a mix nobody supplied, so none of them get a gradient.
    expect(
      w.findAll("linearGradient[id^='genome-rung-gradient-']"),
    ).toHaveLength(0);
  });

  it("renders with no genres at all", () => {
    const w = render({});
    expect(w.find(".genome-stage").exists()).toBe(true);
  });
});
