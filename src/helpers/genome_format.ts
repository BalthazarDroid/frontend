import type { GenreShare, RhythmCell } from "@/composables/genome/types";

/**
 * Pure formatting helpers for the Listening Genome page (docs/ARCHITECTURE.md
 * §3.10). Kept dependency-free and framework-free so they're trivially unit
 * tested; components import these rather than re-deriving the same math.
 */

/** "71%" from a 0..1 divergence score, or the server's own rounded `percent`. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** "9.2x" style ratio label, clamped display at one decimal place. */
export function formatRatio(ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10;
  // Whole numbers read cleaner without a trailing ".0".
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
}

/** Localized-agnostic thousands separator for raw play counts. */
export function formatPlays(plays: number): string {
  return plays.toLocaleString("en-US");
}

/**
 * Cumulative SVG stroke-dashoffset arcs for the headline ring.
 *
 * Given genre shares (already sorted desc by the server) and a circle
 * circumference, returns one arc per genre: dash length is `share *
 * circumference`, offset is the cumulative sum of previous shares (so arcs
 * are drawn back-to-back starting at the 12 o'clock position when the SVG
 * itself is rotated -90deg).
 */
export interface RingArc {
  key: string;
  label: string;
  share: number;
  dashArray: string;
  dashOffset: number;
  colorIndex: number; // 0-based, cycle through --chart-1..5
}

export function computeRingArcs(
  genres: GenreShare[],
  circumference: number,
  maxArcs = 8,
): RingArc[] {
  const arcs: RingArc[] = [];
  let cumulative = 0;
  const shown = genres.slice(0, maxArcs);
  shown.forEach((genre, index) => {
    const length = genre.share * circumference;
    arcs.push({
      key: genre.key,
      label: genre.label,
      share: genre.share,
      dashArray: `${length} ${circumference}`,
      dashOffset: -cumulative,
      colorIndex: index % 5,
    });
    cumulative += length;
  });
  return arcs;
}

/** Top N genres plus a synthetic "+N others" remainder bucket for the genre bar. */
export interface GenreBarSegment {
  key: string;
  label: string;
  share: number;
  colorIndex: number;
  isOthers: boolean;
}

export function genreBarSegments(
  genres: GenreShare[],
  topN = 3,
): GenreBarSegment[] {
  const top = genres.slice(0, topN).map((g, i) => ({
    key: g.key,
    label: g.label,
    share: g.share,
    colorIndex: i % 5,
    isOthers: false,
  }));
  const rest = genres.slice(topN);
  const othersShare = rest.reduce((sum, g) => sum + g.share, 0);
  if (othersShare > 1e-6) {
    top.push({
      key: "__others__",
      label: "",
      share: othersShare,
      colorIndex: topN % 5,
      isOthers: true,
    });
  }
  return top;
}

/** Number of non-others genres folded into "+N others". */
export function othersCount(genres: GenreShare[], topN = 3): number {
  return Math.max(0, genres.length - topN);
}

/**
 * A 7x24 grid of RhythmCell keyed by `weekday-hour`, guaranteed to contain all
 * 168 slots even if the server ever sends a sparse list (defends the UI
 * against a future contract relaxation; §3.4 promises a full grid today).
 */
export function rhythmGridLookup(cells: RhythmCell[]): Map<string, RhythmCell> {
  const map = new Map<string, RhythmCell>();
  for (const cell of cells) {
    map.set(`${cell.weekday}-${cell.hour}`, cell);
  }
  return map;
}

/** Highest `share` across all rhythm cells, or 0 for an empty grid. */
export function maxRhythmShare(cells: RhythmCell[]): number {
  return cells.reduce((max, cell) => Math.max(max, cell.share), 0);
}

/**
 * Opacity for one rhythm cell, floored so empty cells stay faintly visible
 * (§3.10: "floor 0.06 so empty cells stay visible").
 */
export function rhythmCellOpacity(share: number, maxShare: number): number {
  if (maxShare <= 0) return 0.06;
  return Math.max(0.06, share / maxShare);
}

/** "1974.3" -> "1974" for the era center-of-mass tile (whole year display). */
export function formatYear(year: number): string {
  return Math.round(year).toString();
}
