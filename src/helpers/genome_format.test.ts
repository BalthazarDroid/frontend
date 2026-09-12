import { describe, expect, it } from "vitest";
import {
  computeRingArcs,
  formatPercent,
  formatPlays,
  formatRatio,
  formatYear,
  genreBarSegments,
  maxRhythmShare,
  othersCount,
  rhythmCellOpacity,
  rhythmGridLookup,
} from "./genome_format";
import type { GenreShare, RhythmCell } from "@/composables/genome/types";

function genre(overrides: Partial<GenreShare> = {}): GenreShare {
  return {
    key: "prog_rock",
    label: "Progressive Rock",
    share: 0.2,
    baseline_share: 0.02,
    ratio: 10,
    contribution: 0.4,
    ...overrides,
  };
}

describe("formatPercent", () => {
  it("rounds a 0..1 score to a whole percent", () => {
    expect(formatPercent(0.618)).toBe("62%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("formatRatio", () => {
  it("drops a trailing .0 for whole numbers", () => {
    expect(formatRatio(9)).toBe("9x");
    expect(formatRatio(9.0)).toBe("9x");
  });

  it("keeps one decimal place otherwise", () => {
    expect(formatRatio(8.53)).toBe("8.5x");
    expect(formatRatio(0.08)).toBe("0.1x");
  });
});

describe("formatPlays", () => {
  it("adds thousands separators", () => {
    expect(formatPlays(812)).toBe("812");
    expect(formatPlays(4218)).toBe("4,218");
  });
});

describe("formatYear", () => {
  it("rounds a fractional era center-of-mass to a whole year", () => {
    expect(formatYear(1974.3)).toBe("1974");
    expect(formatYear(1974.6)).toBe("1975");
  });
});

describe("computeRingArcs", () => {
  it("returns one arc per genre with cumulative dash offsets", () => {
    const genres = [
      genre({ key: "a", share: 0.5 }),
      genre({ key: "b", share: 0.3 }),
      genre({ key: "c", share: 0.2 }),
    ];
    const arcs = computeRingArcs(genres, 100);
    expect(arcs).toHaveLength(3);
    expect(arcs[0]).toMatchObject({ key: "a", dashOffset: -0, colorIndex: 0 });
    expect(arcs[0].dashArray).toBe("50 100");
    expect(arcs[1].dashOffset).toBe(-50);
    expect(arcs[1].dashArray).toBe("30 100");
    expect(arcs[2].dashOffset).toBe(-80);
    expect(arcs[2].colorIndex).toBe(2);
  });

  it("cycles color index through 5 slots and caps arc count", () => {
    const genres = Array.from({ length: 12 }, (_, i) =>
      genre({ key: `g${i}`, share: 1 / 12 }),
    );
    const arcs = computeRingArcs(genres, 100, 8);
    expect(arcs).toHaveLength(8);
    expect(arcs[5].colorIndex).toBe(0);
    expect(arcs[6].colorIndex).toBe(1);
  });

  it("returns an empty array for no genres", () => {
    expect(computeRingArcs([], 100)).toEqual([]);
  });
});

describe("genreBarSegments", () => {
  it("keeps the top N genres and folds the rest into an others bucket", () => {
    const genres = [
      genre({ key: "a", share: 0.4 }),
      genre({ key: "b", share: 0.3 }),
      genre({ key: "c", share: 0.15 }),
      genre({ key: "d", share: 0.1 }),
      genre({ key: "e", share: 0.05 }),
    ];
    const segments = genreBarSegments(genres, 3);
    expect(segments).toHaveLength(4);
    expect(segments[3]).toMatchObject({
      key: "__others__",
      isOthers: true,
    });
    expect(segments[3].share).toBeCloseTo(0.15, 10);
  });

  it("omits the others bucket when there is nothing left over", () => {
    const genres = [
      genre({ key: "a", share: 0.6 }),
      genre({ key: "b", share: 0.4 }),
    ];
    const segments = genreBarSegments(genres, 3);
    expect(segments).toHaveLength(2);
    expect(segments.some((s) => s.isOthers)).toBe(false);
  });
});

describe("othersCount", () => {
  it("counts genres beyond the top N", () => {
    const genres = Array.from({ length: 12 }, (_, i) =>
      genre({ key: `g${i}` }),
    );
    expect(othersCount(genres, 3)).toBe(9);
  });

  it("never goes negative", () => {
    expect(othersCount([genre()], 3)).toBe(0);
  });
});

function cell(overrides: Partial<RhythmCell> = {}): RhythmCell {
  return { weekday: 0, hour: 0, weight: 1, share: 0.01, ...overrides };
}

describe("rhythmGridLookup", () => {
  it("keys cells by weekday-hour", () => {
    const cells = [cell({ weekday: 2, hour: 18, share: 0.05 })];
    const map = rhythmGridLookup(cells);
    expect(map.get("2-18")).toEqual(cells[0]);
    expect(map.get("0-0")).toBeUndefined();
  });
});

describe("maxRhythmShare", () => {
  it("finds the largest share across cells", () => {
    const cells = [
      cell({ share: 0.01 }),
      cell({ share: 0.09 }),
      cell({ share: 0.03 }),
    ];
    expect(maxRhythmShare(cells)).toBe(0.09);
  });

  it("returns 0 for an empty grid", () => {
    expect(maxRhythmShare([])).toBe(0);
  });
});

describe("rhythmCellOpacity", () => {
  it("scales relative to the max share", () => {
    expect(rhythmCellOpacity(0.05, 0.1)).toBe(0.5);
    expect(rhythmCellOpacity(0.1, 0.1)).toBe(1);
  });

  it("floors empty cells at 0.06 so they stay visible", () => {
    expect(rhythmCellOpacity(0, 0.1)).toBe(0.06);
    expect(rhythmCellOpacity(0.001, 0.1)).toBe(0.06);
  });

  it("floors everything at 0.06 when the whole grid is empty", () => {
    expect(rhythmCellOpacity(0, 0)).toBe(0.06);
  });
});
