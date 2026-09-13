import { describe, expect, it } from "vitest";
import {
  formatPercent,
  formatPlays,
  formatRatio,
  formatYear,
  maxRhythmShare,
  rhythmCellOpacity,
  rhythmGridLookup,
} from "./genome_format";
import type { RhythmCell } from "@/composables/genome/types";

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
