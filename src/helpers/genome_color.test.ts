import { describe, expect, it } from "vitest";
import {
  BASE_C,
  BASE_HUES,
  BASE_L,
  baseColor,
  inSrgbGamut,
  mixColor,
  mixHue,
  oklch,
  rhythmColor,
  RHYTHM_STEPS,
  rhythmStep,
  rhythmThresholds,
} from "./genome_color";

/** Parse the `rgb(r g b)` / `rgba(r, g, b, a)` this module emits. */
function parse(css: string): [number, number, number] {
  const nums = css.match(/[\d.]+/g);
  if (!nums) throw new Error(`unparseable colour: ${css}`);
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
}

/** WCAG relative luminance: how bright the eye actually finds a colour. */
function relativeLuminance(css: string): number {
  const [r, g, b] = parse(css).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("the base palette", () => {
  /**
   * The regression this whole module exists for.
   *
   * The previous palette was HSL, spaced evenly by hue angle, and looked correct by every
   * measure anyone thought to check. It still rendered every molecule cyan-to-green, because
   * at an identical HSL lightness green carries 3.02x the luminance of purple and the canvas
   * composites additively. Hue spacing was never the problem, so evening the hue spacing -
   * which was the first fix attempted - changed nothing.
   *
   * The bound here is what makes the palette's central claim testable rather than asserted.
   */
  it("reads as equally bright across all four hues", () => {
    const lums = BASE_HUES.map((_, i) => relativeLuminance(baseColor(i)));
    const ratio = Math.max(...lums) / Math.min(...lums);
    expect(ratio).toBeLessThan(1.25);
  });

  it("sits inside sRGB at its working lightness and chroma", () => {
    for (const hue of BASE_HUES) {
      expect(inSrgbGamut(BASE_L, BASE_C, hue)).toBe(true);
    }
  });

  it("gives each base a visibly distinct colour", () => {
    const seen = new Set(BASE_HUES.map((_, i) => baseColor(i)));
    expect(seen.size).toBe(BASE_HUES.length);
  });

  it("wraps the index rather than falling off the end", () => {
    expect(baseColor(BASE_HUES.length)).toBe(baseColor(0));
  });
});

describe("oklch", () => {
  it("clips out-of-gamut components into a usable colour", () => {
    const [r, g, b] = parse(oklch(0.5, 0.4, 150));
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });

  it("emits rgba only when an alpha is asked for", () => {
    expect(oklch(0.7, 0.1, 200)).toMatch(/^rgb\(/);
    expect(oklch(0.7, 0.1, 200, 0.5)).toMatch(/^rgba\(/);
  });

  it("clamps alpha into range", () => {
    expect(oklch(0.7, 0.1, 200, 5)).toContain("1)");
    expect(oklch(0.7, 0.1, 200, -1)).toContain("0)");
  });
});

describe("mixColor", () => {
  it("returns a base's own colour when the mix is entirely that base", () => {
    // Not identical to baseColor: a pure mix reaches full purity, which sets chroma from
    // the purity curve rather than from BASE_C. The HUE is the claim being made here.
    const pure = mixColor([1, 0, 0, 0]);
    const [r, g, b] = parse(pure);
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
  });

  it("lands a two-base split between its two bases, not on either", () => {
    const blend = mixColor([0.5, 0.5, 0, 0]);
    expect(blend).not.toBe(mixColor([1, 0, 0, 0]));
    expect(blend).not.toBe(mixColor([0, 1, 0, 0]));
  });

  /**
   * The honest-answer property. A genre with no allegiance to any base must not be handed a
   * confident colour, because the colour would be saying something the data does not.
   */
  it("cancels an even spread to near-grey", () => {
    const [r, g, b] = parse(mixColor([0.25, 0.25, 0.25, 0.25]));
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    expect(spread).toBeLessThan(18);
  });

  it("keeps hue but drops chroma when muted", () => {
    const mix = [0.7, 0.2, 0.05, 0.05];
    const lit = parse(mixColor(mix, false));
    const muted = parse(mixColor(mix, true));
    const chroma = (c: number[]): number => Math.max(...c) - Math.min(...c);
    expect(chroma(muted)).toBeLessThan(chroma(lit));
  });

  /**
   * A muted rung must read as less COLOURED, not as less lit. In HSL the two were the same
   * control, so draining a rung's saturation also dimmed it and the six divergent rungs
   * looked like the only ones switched on.
   */
  it("mutes without substantially dimming", () => {
    const mix = [0.7, 0.2, 0.05, 0.05];
    const ratio =
      relativeLuminance(mixColor(mix, false)) /
      relativeLuminance(mixColor(mix, true));
    expect(ratio).toBeLessThan(1.6);
  });

  it("falls back to dust for an empty or zero mix", () => {
    expect(mixColor([])).toBe(mixColor([0, 0, 0, 0]));
  });

  it("treats negative weights as zero rather than reversing the vector", () => {
    expect(mixColor([1, -5, 0, 0])).toBe(mixColor([1, 0, 0, 0]));
  });
});

describe("mixHue", () => {
  it("takes the short way round rather than through the whole wheel", () => {
    expect(mixHue(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it("returns the endpoints unchanged", () => {
    expect(mixHue(200, 40, 0)).toBeCloseTo(200, 5);
    expect(mixHue(200, 40, 1)).toBeCloseTo(40, 5);
  });
});

describe("rhythmColor", () => {
  it("rises monotonically in brightness with intensity", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((t) =>
      relativeLuminance(rhythmColor(t)),
    );
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });

  it("clamps out-of-range intensities instead of producing nonsense", () => {
    expect(rhythmColor(-1)).toBe(rhythmColor(0));
    expect(rhythmColor(9)).toBe(rhythmColor(1));
  });

  /**
   * The quiet end must stay visible. Cells were previously drawn as one tint at varying
   * opacity, so a near-zero hour disappeared into the page behind the card and read as a
   * hole in the grid rather than as a low value.
   */
  it("keeps the quietest cell distinguishable from nothing", () => {
    expect(relativeLuminance(rhythmColor(0))).toBeGreaterThan(0.01);
  });

  /**
   * A magnitude scale must survive being read without colour. Hue carries none of the
   * encoding here - lightness does - so the ramp still reads as an order in greyscale, and
   * for a colourblind reader.
   */
  it("separates its ends strongly enough to read without hue", () => {
    const ratio =
      relativeLuminance(rhythmColor(1)) / relativeLuminance(rhythmColor(0));
    expect(ratio).toBeGreaterThan(4);
  });

  /** Blue to green, never doubling back into the warm half - that would be a rainbow. */
  it("does not wander into warm hues", () => {
    for (let i = 0; i <= 10; i++) {
      const [r, , b] = parse(rhythmColor(i / 10));
      expect(b).toBeGreaterThan(r);
    }
  });
});

describe("the rhythm ranking", () => {
  /**
   * The reason the scale is ranked at all.
   *
   * A linear ramp against the busiest hour put one peak at the top and crushed everything
   * else into the bottom of the range, so a week of real variation rendered as two shades of
   * navy. Ranking has to spread that same data across the steps.
   */
  it("spreads a lopsided distribution across the whole range", () => {
    const shares = [500, ...Array.from({ length: 30 }, (_, i) => i + 1)];
    const cuts = rhythmThresholds(shares);
    const used = new Set(shares.map((s) => rhythmStep(s, cuts)));
    expect(used.size).toBeGreaterThanOrEqual(RHYTHM_STEPS - 1);
  });

  it("keeps empty hours at step zero, below every real value", () => {
    const cuts = rhythmThresholds([1, 2, 3, 4, 5, 6]);
    expect(rhythmStep(0, cuts)).toBe(0);
    expect(rhythmStep(1, cuts)).toBeGreaterThan(0);
  });

  it("never exceeds the last step", () => {
    const cuts = rhythmThresholds([1, 2, 3]);
    expect(rhythmStep(999, cuts)).toBeLessThanOrEqual(RHYTHM_STEPS - 1);
  });

  it("orders any two cells the way their shares order them", () => {
    const shares = [3, 9, 1, 27, 81, 5, 14];
    const cuts = rhythmThresholds(shares);
    for (const a of shares) {
      for (const b of shares) {
        if (a > b)
          expect(rhythmStep(a, cuts)).toBeGreaterThanOrEqual(
            rhythmStep(b, cuts),
          );
      }
    }
  });

  it("survives a grid with nothing in it", () => {
    expect(rhythmThresholds([])).toEqual([]);
    expect(rhythmThresholds([0, 0, 0])).toEqual([]);
    expect(rhythmStep(0, [])).toBe(0);
  });

  /** Excluding empties matters: in a real week most of the 168 cells are zero. */
  it("ignores empty cells when choosing its cut points", () => {
    const withEmpties = rhythmThresholds([
      ...Array(100).fill(0),
      1,
      2,
      3,
      4,
      5,
      6,
    ]);
    expect(withEmpties).toEqual(rhythmThresholds([1, 2, 3, 4, 5, 6]));
  });
});
