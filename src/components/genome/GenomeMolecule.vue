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
    <CardContent>
      <!-- container-type makes the layout respond to the CARD's width, not the
           viewport's - the page has a sidebar, so those are not the same number. -->
      <div class="genome-shell">
        <div class="genome-stage">
          <div class="genome-plate">
            <img
              :src="plateSrc"
              alt=""
              aria-hidden="true"
              class="genome-plate__img"
            />
            <svg
              class="genome-plate__svg"
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
                  class="genome-leader"
                  :x1="reticle.x + 13"
                  :y1="reticle.y"
                  :x2="hudAnchor.x"
                  :y2="hudAnchor.y + 24"
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
          </div>

          <!-- The callout lives in the stage, not the plate: on a wide card it sits in
             its own lane beside the molecule (the leader line runs out of the SVG,
             which is why that element keeps overflow: visible), and only overlays the
             molecule when the card is too narrow to give it a lane of its own. -->
          <div
            v-if="hudInfo"
            class="genome-hud on"
            :style="hudStyle"
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

          <div class="genome-panel">
            <h3 class="genome-panel__heading">
              {{ $t("listening_genome.molecule.bases_heading") }}
            </h3>
            <p class="genome-panel__sub">
              {{ $t("listening_genome.molecule.bases_subtitle") }}
            </p>

            <p v-if="bases.length === 0" class="genome-panel__empty">
              {{ $t("listening_genome.molecule.no_bases") }}
            </p>
            <div v-else class="genome-panel__rows">
              <div
                v-for="(base, i) in bases"
                :key="base.key"
                class="genome-baserow"
              >
                <div class="genome-baserow__id">
                  <span
                    class="genome-baserow__dot"
                    :style="{ background: baseColor(i) }"
                  ></span>
                  <div>
                    <div class="genome-baserow__label">{{ base.label }}</div>
                    <div class="genome-baserow__code">
                      {{ baseCode(base.key) }}
                    </div>
                  </div>
                </div>
                <div class="genome-baserow__share">
                  {{ formatPercent(base.share) }}
                </div>
              </div>
            </div>

            <p class="genome-panel__foot">
              {{ $t("listening_genome.molecule.backbone_explainer") }}
            </p>
          </div>
        </div>

        <p class="genome-hint">
          {{ $t("listening_genome.molecule.hint") }}
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

// Defaulted rather than required: a genome served from a cache written by an older
// result shape can arrive without `bases`, and a component that throws on a missing
// field takes its whole card down with it (silently - nothing reaches the server log).
// Degrading to the no-bases state is the honest failure here.
const props = withDefaults(
  defineProps<{
    genres?: GenreShare[];
    bases?: GenreShare[];
    totalListens?: number;
  }>(),
  { genres: () => [], bases: () => [], totalListens: 0 },
);

// Fixed hues for up to 4 bases - a purely presentational palette, not tied to
// genre identity, so it's stable regardless of which genres occupy the slots.
const HUES = [188, 288, 146, 30];
function baseColor(index: number, lightness = 60, saturation = 80): string {
  return `hsl(${HUES[index % HUES.length]} ${saturation}% ${lightness}%)`;
}
const neutralColor = "hsl(220 6% 52%)";

// `base_mix` is [] when cross-genre affinity isn't computable, and absent entirely on a
// payload from an older result schema. Both mean the same thing to the visual.
function baseMix(genre: GenreShare): number[] {
  return genre.base_mix ?? [];
}

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
    if (!genre || baseMix(genre).length === 0) continue;
    out.push({
      ...rung,
      genre,
      stops: mixGradientStops(baseMix(genre), (i) => baseColor(i, 60)),
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
  const mix = baseMix(genre);
  const mixKnown = mix.length > 0;
  return {
    code: secondaryCode(rank),
    title: genre.label,
    desc: $t("listening_genome.molecule.share_of_listening", {
      percent: formatPercent(genre.share),
      plays: formatPlays(estimatePlays(genre.share, props.totalListens)),
    }),
    mix,
    mixLabels: bases.value.map((b) => b.label),
    mixKnown,
    status: statusForRatio(genre.ratio),
    anchor: { x: (rung.x1 + rung.x2) / 2, y: (rung.y1 + rung.y2) / 2 },
  };
});

const reticle = computed(() => (hudInfo.value ? hudInfo.value.anchor : null));

// Two placements, chosen in CSS rather than by measuring anything in JS.
//
// Wide: the callout gets its own lane to the right of the plate. The plate's width is
// derivable from the stage height alone (its aspect ratio is fixed), so the lane's left
// edge is a pure calc() - no ResizeObserver, no layout read.
//
// Narrow (the `--narrow` rules below): there is no room for a lane, so the callout
// overlays the plate exactly as it used to, flipping to the reticle's left when it would
// otherwise run off the right edge.
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

// The callout's vertical position as a fraction of the plate's height, nudged up so the
// panel's title sits level with the reticle rather than below it.
const hudTopFraction = computed(() =>
  reticle.value ? Math.max(0.01, reticle.value.y / GEOM.h - 0.06) : 0,
);

const hudStyle = computed(() => ({
  "--hud-left-pct": `${hudLeftPercent.value}%`,
  "--hud-top-pct": `${hudTopPercent.value}%`,
  "--hud-top-fr": `${hudTopFraction.value}`,
}));

// Leader-line endpoint. In the wide layout the callout is outside the plate entirely, so
// the line simply runs to the plate's edge and the panel picks it up from there; the SVG
// keeps overflow: visible so the last few pixels are not clipped.
const hudAnchor = computed(() => ({
  x: GEOM.w + 12,
  y: hudTopFraction.value * GEOM.h,
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
.genome-shell {
  container-type: inline-size;
}
.genome-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: var(--muted-foreground);
}

/* One dark panel spanning the card. The plate, the callout and the base-pair list all
   live inside it, so the space to the right of the molecule is used rather than left
   as an empty margin with content stranded outside the box. */
.genome-stage {
  /* cqi, not vw: the plate should scale with the CARD, which is what the container
     query above establishes - the page has a sidebar, so vw would undersize it. */
  --stage-h: clamp(380px, 62cqi, 660px);
  /* The plate's aspect ratio is fixed (540x700), so its rendered width follows from the
     stage height - which is what lets the callout's lane be a plain calc(). */
  --plate-w: calc(var(--stage-h) * 540 / 700);
  --stage-pad: 18px;
  --panel-w: clamp(170px, 22cqi, 240px);
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 20px;
  height: var(--stage-h);
  padding: var(--stage-pad);
  border-radius: 12px;
  /* The plate is white particles on nothing, so the panel carries its own dark ground
     rather than inheriting the theme's. */
  background: #07080a;
}
.genome-plate {
  position: relative;
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: 540 / 700;
}
.genome-plate__img,
.genome-plate__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.genome-plate__svg {
  overflow: visible;
}

.genome-panel {
  flex: 0 0 var(--panel-w);
  margin-left: auto;
  align-self: flex-start;
  padding: 14px 15px 13px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
.genome-panel__heading {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8f939d;
}
.genome-panel__sub {
  margin-top: 2px;
  font-size: 11px;
  color: #71757e;
}
.genome-panel__rows {
  margin-top: 8px;
}
.genome-panel__empty,
.genome-panel__foot {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.45;
  color: #71757e;
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
  /* Wide layout: its own lane between the plate and the base-pair panel, tracking the
     reticle vertically. Bounding it on BOTH sides is what keeps it from sliding under
     the panel as the card narrows - a fixed width could not know where the lane ends. */
  left: calc(var(--stage-pad) + var(--plate-w) + 20px);
  right: calc(var(--stage-pad) + var(--panel-w) + 20px);
  width: auto;
  max-width: 320px;
  top: min(
    calc(var(--stage-pad) + var(--hud-top-fr) * var(--stage-h)),
    calc(100% - 230px)
  );
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
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.genome-baserow:last-of-type {
  border-bottom: 0;
}
.genome-baserow__id {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.genome-baserow__label {
  font-size: 12.5px;
  color: #e7e9ee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.genome-baserow__share {
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.genome-baserow__dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.genome-baserow__code {
  font:
    600 9px/1 ui-monospace,
    Menlo,
    monospace;
  letter-spacing: 0.14em;
  color: #71757e;
  text-transform: uppercase;
  margin-top: 2px;
}

/* Narrow: no room for a callout lane, so the stage stacks and the callout goes back to
   overlaying the plate, flipping sides when it would run off the right edge. */
/* Narrow: no room for a callout lane. The stage stacks, and the callout stops floating
   entirely - it becomes a block under the molecule. Overlaying it on a small plate hid
   the thing it was describing, and chasing the reticle horizontally inside a centred,
   max-width plate is arithmetic with no payoff. The reticle still marks the spot. */
@container (max-width: 760px) {
  .genome-stage {
    --stage-h: auto;
    flex-direction: column;
    align-items: center;
    height: auto;
  }
  .genome-plate {
    order: 1;
    width: 100%;
    max-width: 420px;
    height: auto;
  }
  .genome-hud {
    order: 2;
    position: static;
    width: 100%;
    max-width: 420px;
    right: auto;
  }
  .genome-panel {
    order: 3;
    flex: 0 0 auto;
    width: 100%;
    max-width: 420px;
    margin-left: 0;
  }
  .genome-leader {
    display: none;
  }
}
</style>
