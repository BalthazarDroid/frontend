<template>
  <Card class="overflow-hidden">
    <CardHeader>
      <CardTitle
        class="text-xs uppercase tracking-widest text-muted-foreground"
      >
        {{ $t("listening_genome.molecule.title") }}
      </CardTitle>
      <CardDescription>
        {{ $t("listening_genome.molecule.subtitle") }}
      </CardDescription>
    </CardHeader>
    <CardContent class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div class="flex flex-col items-center gap-2">
        <div class="genome-stage">
          <img
            :src="plateSrc"
            alt=""
            aria-hidden="true"
            class="genome-stage__img"
          />
          <svg
            class="genome-stage__svg"
            :viewBox="`0 0 ${GEOM.w} ${GEOM.h}`"
            role="group"
            :aria-label="$t('listening_genome.molecule.svg_aria')"
          >
            <defs>
              <linearGradient
                id="genome-backbone-gradient"
                gradientUnits="userSpaceOnUse"
                :x1="0"
                :y1="GEOM.h"
                :x2="0"
                :y2="0"
              >
                <stop
                  v-for="stop in backboneStops"
                  :key="stop.offsetPercent"
                  :offset="`${stop.offsetPercent}%`"
                  :stop-color="stop.color"
                />
              </linearGradient>
              <linearGradient
                v-for="rung in tintedRungs"
                :id="`genome-rung-gradient-${rung.i}`"
                :key="`grad-${rung.i}`"
                gradientUnits="userSpaceOnUse"
                :x1="Math.min(rung.x1, rung.x2)"
                :y1="(rung.y1 + rung.y2) / 2"
                :x2="Math.max(rung.x1, rung.x2)"
                :y2="(rung.y1 + rung.y2) / 2"
              >
                <stop
                  v-for="stop in rung.stops"
                  :key="stop.offsetPercent"
                  :offset="`${stop.offsetPercent}%`"
                  :stop-color="stop.color"
                />
              </linearGradient>
            </defs>

            <!-- backbone strands: a blend of every base, the library as a whole -->
            <polyline
              v-for="leg in legPaths"
              :key="`leg-visual-${leg.key}`"
              class="genome-tint"
              :points="leg.points"
              fill="none"
              :stroke="
                hasBases ? 'url(#genome-backbone-gradient)' : neutralColor
              "
              stroke-width="15"
              stroke-linecap="round"
              :opacity="leg.key === active?.legKey ? 0.8 : 0.34"
              :style="{
                strokeWidth: leg.key === active?.legKey ? '18px' : '15px',
              }"
            />

            <!-- secondary genre rungs -->
            <line
              v-for="rung in allRungs"
              :key="`rung-visual-${rung.i}`"
              class="genome-tint"
              :x1="rung.x1"
              :y1="rung.y1"
              :x2="rung.x2"
              :y2="rung.y2"
              :stroke="rung.strokeColor"
              stroke-width="9"
              stroke-linecap="round"
              :opacity="rung.opacity"
              :style="{
                strokeWidth: active?.rungIndex === rung.i ? '12px' : '9px',
              }"
            />

            <!-- reticle + leader line, shown while something is active -->
            <g v-if="reticle" class="genome-reticle">
              <circle
                :cx="reticle.x"
                :cy="reticle.y"
                r="13"
                fill="none"
                stroke="#fff"
                stroke-width="1.1"
                opacity=".85"
              />
              <circle
                :cx="reticle.x"
                :cy="reticle.y"
                r="6"
                fill="none"
                stroke="#fff"
                stroke-width="1.1"
                opacity=".95"
              />
              <circle :cx="reticle.x" :cy="reticle.y" r="1.8" fill="#fff" />
              <line
                :x1="reticle.x + 13"
                :y1="reticle.y"
                :x2="hudAnchor.x"
                :y2="hudAnchor.y + 30"
                stroke="#fff"
                stroke-width="1"
                opacity=".55"
              />
            </g>

            <!-- hit targets: one focusable, hoverable element per interactive
                 rung/leg. Rungs with no paired genre (more rungs than
                 genres) intentionally get no hit target: untinted and
                 non-interactive, per the pairing rule. -->
            <line
              v-for="leg in legPaths"
              :key="`leg-hit-${leg.key}`"
              class="genome-hit"
              :x1="leg.hitX1"
              :y1="leg.hitY1"
              :x2="leg.hitX2"
              :y2="leg.hitY2"
              stroke="transparent"
              stroke-width="26"
              stroke-linecap="round"
              tabindex="0"
              role="button"
              :aria-label="legAriaLabel"
              @mouseenter="setHover({ legKey: leg.key })"
              @mouseleave="clearHover"
              @focus="setHover({ legKey: leg.key })"
              @blur="clearHover"
              @click="togglePin({ legKey: leg.key })"
              @keydown.enter.prevent="togglePin({ legKey: leg.key })"
              @keydown.space.prevent="togglePin({ legKey: leg.key })"
            />
            <line
              v-for="rung in interactiveRungs"
              :key="`rung-hit-${rung.i}`"
              class="genome-hit"
              :x1="rung.x1"
              :y1="rung.y1"
              :x2="rung.x2"
              :y2="rung.y2"
              stroke="transparent"
              stroke-width="20"
              stroke-linecap="round"
              tabindex="0"
              role="button"
              :aria-label="rungAriaLabel(rung.genre)"
              @mouseenter="setHover({ rungIndex: rung.i })"
              @mouseleave="clearHover"
              @focus="setHover({ rungIndex: rung.i })"
              @blur="clearHover"
              @click="togglePin({ rungIndex: rung.i })"
              @keydown.enter.prevent="togglePin({ rungIndex: rung.i })"
              @keydown.space.prevent="togglePin({ rungIndex: rung.i })"
            />
          </svg>

          <div
            v-if="hudInfo"
            class="genome-hud on"
            :style="{ left: `${hudLeftPercent}%`, top: `${hudTopPercent}%` }"
            aria-hidden="true"
          >
            <div class="genome-hud__code">{{ hudInfo.code }}</div>
            <div class="genome-hud__panel">
              <div class="genome-hud__title">{{ hudInfo.title }}</div>
              <div class="genome-hud__desc">{{ hudInfo.desc }}</div>
              <div class="genome-hud__bar">
                <div
                  v-if="hudInfo.mixKnown"
                  class="genome-hud__bar-fill"
                  :style="{ background: hudBarGradient }"
                ></div>
                <div
                  v-else
                  class="genome-hud__bar-fill genome-hud__bar-fill--neutral"
                ></div>
              </div>
              <div v-if="hudInfo.mixKnown" class="genome-hud__mix">
                <template v-for="(pct, i) in hudInfo.mix" :key="i">
                  <span>
                    <span
                      class="genome-hud__dot"
                      :style="{ background: baseColor(i) }"
                    ></span>
                    {{ hudInfo.mixLabels[i] }}
                  </span>
                  <b>{{ Math.round(pct * 100) }}%</b>
                </template>
              </div>
              <div v-else class="genome-hud__mix-unknown">
                {{ $t("listening_genome.molecule.mix_unknown") }}
              </div>
              <div v-if="hudInfo.status" class="genome-hud__foot">
                <span
                  class="genome-hud__status"
                  :style="{
                    color: statusStyle(hudInfo.status).c,
                    background: statusStyle(hudInfo.status).bg,
                    borderColor: statusStyle(hudInfo.status).bd,
                  }"
                >
                  {{ statusLabel(hudInfo.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ $t("listening_genome.molecule.hint") }}
        </p>
      </div>

      <div>
        <h3 class="text-xs uppercase tracking-widest text-muted-foreground">
          {{ $t("listening_genome.molecule.bases_heading") }}
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ $t("listening_genome.molecule.bases_subtitle") }}
        </p>

        <p v-if="bases.length === 0" class="mt-4 text-sm text-muted-foreground">
          {{ $t("listening_genome.molecule.no_bases") }}
        </p>
        <div v-else class="mt-2">
          <div
            v-for="(base, i) in bases"
            :key="base.key"
            class="genome-baserow"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="genome-baserow__dot"
                :style="{ background: baseColor(i) }"
              ></span>
              <div>
                <div class="text-sm">{{ base.label }}</div>
                <div class="genome-baserow__code">{{ baseCode(base.key) }}</div>
              </div>
            </div>
            <div class="text-sm font-semibold tabular-nums">
              {{ formatPercent(base.share) }}
            </div>
          </div>
        </div>

        <p class="mt-3.5 text-xs text-muted-foreground">
          {{ $t("listening_genome.molecule.backbone_explainer") }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GenreShare } from "@/composables/genome/types";
import geometry from "@/assets/genome/helix_geometry.json";
import {
  backboneGradientStops,
  baseCode,
  estimatePlays,
  mixGradientStops,
  pairRungsWithGenres,
  secondaryCode,
  secondaryGenres,
  statusForRatio,
  type ExpressionStatus,
} from "@/helpers/genome_molecule";
import { formatPercent, formatPlays } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";

// The pre-rendered particle-cloud plate (540x700). Generated at design time
// by helix_render.py, which is NOT run at build or runtime - it's kept in
// the repo purely for provenance of how the PNG/JSON pair was produced.
const plateSrc = new URL("@/assets/genome/helix.png", import.meta.url).href;

interface Rung {
  i: number;
  t: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  len: number;
  face: number;
}
interface Geometry {
  w: number;
  h: number;
  rungs: Rung[];
  legs: { A: [number, number][]; B: [number, number][] };
  tube_r: number;
  rung_r: number;
}
const GEOM = geometry as Geometry;

const props = defineProps<{
  genres: GenreShare[];
  bases: GenreShare[];
  totalListens: number;
}>();

// Fixed hues for up to 4 bases - a purely presentational palette, not tied to
// genre identity, so it's stable regardless of which genres occupy the slots.
const HUES = [188, 288, 146, 30];
function baseColor(index: number, lightness = 60, saturation = 80): string {
  return `hsl(${HUES[index % HUES.length]} ${saturation}% ${lightness}%)`;
}
const neutralColor = "hsl(220 6% 52%)";

const bases = computed(() => props.bases);
const hasBases = computed(() => bases.value.length > 0);

const secondary = computed(() => secondaryGenres(props.genres, props.bases));
const secondaryRank = computed(() => {
  const map = new Map<string, number>();
  secondary.value.forEach((g, i) => map.set(g.key, i));
  return map;
});
const pairs = computed(() => pairRungsWithGenres(GEOM.rungs, secondary.value));

const backboneStops = computed(() =>
  backboneGradientStops(bases.value.length, (i) => baseColor(i, 58)),
);

interface TintedRung extends Rung {
  genre: GenreShare;
  stops: { offsetPercent: number; color: string }[];
}
const tintedRungs = computed<TintedRung[]>(() => {
  const out: TintedRung[] = [];
  for (const rung of GEOM.rungs) {
    const genre = pairs.value.get(rung.i);
    if (!genre || genre.base_mix.length === 0) continue;
    out.push({
      ...rung,
      genre,
      stops: mixGradientStops(genre.base_mix, (i) => baseColor(i, 60)),
    });
  }
  return out;
});
const mixKnownRungIds = computed(
  () => new Set(tintedRungs.value.map((r) => r.i)),
);

interface RungView extends Rung {
  genre: GenreShare | null;
  strokeColor: string;
  opacity: number;
}
const allRungs = computed<RungView[]>(() =>
  GEOM.rungs.map((rung) => {
    const genre = pairs.value.get(rung.i) ?? null;
    const baseOpacity = 0.26 + 0.2 * rung.face;
    if (!genre) {
      // surplus rung: no genre left to pair with it - untinted, inert.
      return {
        ...rung,
        genre: null,
        strokeColor: neutralColor,
        opacity: baseOpacity * 0.4,
      };
    }
    const mixKnown = mixKnownRungIds.value.has(rung.i);
    return {
      ...rung,
      genre,
      strokeColor: mixKnown
        ? `url(#genome-rung-gradient-${rung.i})`
        : neutralColor,
      opacity: baseOpacity,
    };
  }),
);
const interactiveRungs = computed(() => allRungs.value.filter((r) => r.genre));

const legPaths = computed(() =>
  (["A", "B"] as const).map((key, legIndex) => {
    const points = GEOM.legs[key];
    const mid = points[Math.floor(points.length / 2)];
    const start = points[0];
    return {
      key: legIndex,
      points: points.map((p) => `${p[0]},${p[1]}`).join(" "),
      // A single generous hit target down the middle third of the strand -
      // one Tab stop per leg rather than the mockup's per-point mouse-hover
      // granularity, which has no sane keyboard equivalent.
      hitX1: start[0],
      hitY1: start[1],
      hitX2: points[points.length - 1][0],
      hitY2: points[points.length - 1][1],
      anchor: mid,
    };
  }),
);

// ---- interaction state ------------------------------------------------

interface ActiveTarget {
  rungIndex?: number;
  legKey?: number;
}
const hovered = ref<ActiveTarget | null>(null);
const pinned = ref<ActiveTarget | null>(null);

function targetsEqual(a: ActiveTarget | null, b: ActiveTarget | null): boolean {
  if (!a || !b) return a === b;
  return a.rungIndex === b.rungIndex && a.legKey === b.legKey;
}
function setHover(t: ActiveTarget): void {
  hovered.value = t;
}
function clearHover(): void {
  hovered.value = null;
}
function togglePin(t: ActiveTarget): void {
  pinned.value = targetsEqual(pinned.value, t) ? null : t;
}

// Nothing hovered/pinned/focused: default to the longest rung, matching the
// mockup's initial state so the callout is never blank on load.
const defaultTarget = computed<ActiveTarget | null>(() => {
  const longest = interactiveRungs.value.reduce<RungView | null>(
    (best, r) => (!best || r.len > best.len ? r : best),
    null,
  );
  return longest ? { rungIndex: longest.i } : null;
});

const active = computed<ActiveTarget | null>(
  () => hovered.value ?? pinned.value ?? defaultTarget.value,
);

// ---- HUD content --------------------------------------------------------

interface HudInfo {
  code: string;
  title: string;
  desc: string;
  mix: number[];
  mixLabels: string[];
  mixKnown: boolean;
  status: ExpressionStatus | null;
  anchor: { x: number; y: number };
}

const hudInfo = computed<HudInfo | null>(() => {
  const target = active.value;
  if (!target) return null;

  if (target.legKey !== undefined) {
    const leg = legPaths.value[target.legKey];
    const totalShare = bases.value.reduce((s, b) => s + b.share, 0);
    const mix =
      totalShare > 0 ? bases.value.map((b) => b.share / totalShare) : [];
    return {
      code: "BKB",
      title: $t("listening_genome.molecule.backbone_label"),
      desc: hasBases.value
        ? $t("listening_genome.molecule.backbone_desc", {
            plays: formatPlays(props.totalListens),
          })
        : $t("listening_genome.molecule.backbone_desc_empty"),
      mix,
      mixLabels: bases.value.map((b) => b.label),
      mixKnown: mix.length > 0,
      status: null,
      anchor: { x: leg.anchor[0], y: leg.anchor[1] },
    };
  }

  const rung = allRungs.value.find((r) => r.i === target.rungIndex);
  if (!rung || !rung.genre) return null;
  const genre = rung.genre;
  const rank = secondaryRank.value.get(genre.key) ?? 0;
  const mixKnown = genre.base_mix.length > 0;
  return {
    code: secondaryCode(rank),
    title: genre.label,
    desc: $t("listening_genome.molecule.share_of_listening", {
      percent: formatPercent(genre.share),
      plays: formatPlays(estimatePlays(genre.share, props.totalListens)),
    }),
    mix: genre.base_mix,
    mixLabels: bases.value.map((b) => b.label),
    mixKnown,
    status: statusForRatio(genre.ratio),
    anchor: { x: (rung.x1 + rung.x2) / 2, y: (rung.y1 + rung.y2) / 2 },
  };
});

const reticle = computed(() => (hudInfo.value ? hudInfo.value.anchor : null));

// The panel's own footprint as a percentage of the stage, matching its CSS
// width (see .genome-hud) - kept in percentage terms throughout, rather than
// the mockup's fixed-pixel clamp, because the stage itself scales with the
// viewport (viewBox, not a fixed 540px canvas). When there isn't room to the
// right of the reticle, the panel flips to its left instead of overflowing.
const PANEL_WIDTH_PCT = 46;
const GAP_PCT = 5;

const hudLeftPercent = computed(() => {
  if (!reticle.value) return 0;
  const rx = (reticle.value.x / GEOM.w) * 100;
  const right = rx + GAP_PCT;
  if (right + PANEL_WIDTH_PCT <= 100) return right;
  return Math.max(0, rx - GAP_PCT - PANEL_WIDTH_PCT);
});
const hudTopPercent = computed(() => {
  if (!reticle.value) return 0;
  const ry = (reticle.value.y / GEOM.h) * 100;
  return Math.max(1, ry - 5);
});
// Leader-line endpoint, converted back to SVG-space so it lines up with the
// (percentage-positioned) panel regardless of how large the stage renders.
const hudAnchor = computed(() => ({
  x: (hudLeftPercent.value / 100) * GEOM.w,
  y: (hudTopPercent.value / 100) * GEOM.h,
}));

const hudBarGradient = computed(() => {
  if (!hudInfo.value || !hudInfo.value.mixKnown) return "";
  const stops = mixGradientStops(hudInfo.value.mix, (i) => baseColor(i, 58));
  const seg = stops.map((s) => `${s.color} ${s.offsetPercent.toFixed(1)}%`);
  return `linear-gradient(90deg, ${seg.join(",")})`;
});

const STATUS_COLORS: Record<
  ExpressionStatus,
  { c: string; bg: string; bd: string }
> = {
  overexpressed: {
    c: "#e0a23c",
    bg: "rgba(224,162,60,.10)",
    bd: "rgba(224,162,60,.42)",
  },
  stable: {
    c: "#4ad48a",
    bg: "rgba(74,212,138,.10)",
    bd: "rgba(74,212,138,.42)",
  },
  underexpressed: {
    c: "#5fa8e8",
    bg: "rgba(95,168,232,.10)",
    bd: "rgba(95,168,232,.42)",
  },
};
function statusStyle(status: ExpressionStatus) {
  return STATUS_COLORS[status];
}
function statusLabel(status: ExpressionStatus): string {
  return $t(`listening_genome.molecule.status_${status}`);
}

function rungAriaLabel(genre: GenreShare | null): string {
  if (!genre) return "";
  return $t("listening_genome.molecule.rung_aria", {
    label: genre.label,
    percent: formatPercent(genre.share),
    status: statusLabel(statusForRatio(genre.ratio)),
  });
}
const legAriaLabel = computed(() =>
  hasBases.value
    ? $t("listening_genome.molecule.leg_aria", { count: bases.value.length })
    : $t("listening_genome.molecule.leg_aria_empty"),
);
</script>

<style scoped>
.genome-stage {
  position: relative;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 540 / 700;
  border-radius: 12px;
  overflow: hidden;
  background: #07080a;
}
.genome-stage__img,
.genome-stage__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.genome-stage__svg {
  overflow: visible;
}
.genome-tint {
  transition:
    opacity 0.16s ease,
    stroke-width 0.16s ease;
  mix-blend-mode: screen;
}
.genome-hit {
  cursor: pointer;
}
.genome-hit:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.genome-reticle {
  transition: opacity 0.12s ease;
}

.genome-hud {
  position: absolute;
  pointer-events: none;
  z-index: 8;
  /* Must match PANEL_WIDTH_PCT in the script, which uses this figure to
     decide whether the panel flips to the reticle's left instead of
     overflowing the stage on its right. */
  width: 46%;
  min-width: 150px;
}
.genome-hud__code {
  display: inline-block;
  margin-bottom: -1px;
  padding: 4px 9px;
  background: rgba(12, 14, 18, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  font:
    600 10px/1 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0.16em;
  color: #c9cdd6;
}
.genome-hud__panel {
  padding: 12px 13px 11px;
  background: rgba(10, 12, 15, 0.94);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0 4px 4px 4px;
}
.genome-hud__title {
  font:
    700 12px/1.25 ui-sans-serif,
    system-ui;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
}
.genome-hud__desc {
  font-size: 11px;
  color: #8f939d;
  margin-top: 3px;
  line-height: 1.35;
}
.genome-hud__bar {
  display: flex;
  height: 5px;
  border-radius: 3px;
  overflow: hidden;
  margin: 9px 0 2px;
}
.genome-hud__bar-fill {
  flex: 1;
}
.genome-hud__bar-fill--neutral {
  background: hsl(220 6% 40%);
}
.genome-hud__mix {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 10px;
  font-size: 10.5px;
  color: #b9bcc6;
}
.genome-hud__mix b {
  color: #fff;
  font-weight: 600;
}
.genome-hud__mix-unknown {
  margin-top: 10px;
  font-size: 10.5px;
  color: #b9bcc6;
  font-style: italic;
}
.genome-hud__dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}
.genome-hud__foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 11px;
}
.genome-hud__status {
  padding: 5px 11px;
  border-radius: 4px;
  font:
    600 10px/1 ui-monospace,
    Menlo,
    monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.genome-baserow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.genome-baserow:last-of-type {
  border-bottom: 0;
}
.genome-baserow__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.genome-baserow__code {
  font:
    600 9px/1 ui-monospace,
    Menlo,
    monospace;
  letter-spacing: 0.14em;
  color: var(--muted-foreground);
  text-transform: uppercase;
  margin-top: 2px;
}
</style>
