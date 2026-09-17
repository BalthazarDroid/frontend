<template>
  <Card class="genome-panel-frame overflow-hidden">
    <CardHeader>
      <CardTitle>
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
          <div
            ref="plateEl"
            class="genome-plate"
            @pointermove="onPointerMove"
            @pointerleave="clearHover"
            @click="onClick"
          >
            <canvas ref="canvasEl" class="genome-plate__canvas"></canvas>

            <svg
              class="genome-plate__svg"
              :viewBox="`0 0 ${HELIX_W} ${HELIX_H}`"
              role="group"
              :aria-label="$t('listening_genome.molecule.svg_aria')"
            >
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
                  :x1="reticle.x - 13"
                  :y1="reticle.y"
                  :x2="-12"
                  :y2="hudTopFraction * HELIX_H + 24"
                  stroke="#fff"
                  stroke-width="1"
                  opacity=".55"
                />
              </g>

              <!-- Keyboard hit targets. The molecule turns, so there is nothing static
                   to attach a hit area to: pointer hover is resolved against the canvas
                   instead (onPointerMove), and these exist so the same information is
                   reachable by Tab. Their geometry follows the molecule, refreshed at a
                   low rate while it spins and immediately once it stops. -->
              <line
                v-for="target in hitTargets"
                :key="`hit-${target.key}`"
                class="genome-hit"
                :x1="target.x1"
                :y1="target.y1"
                :x2="target.x2"
                :y2="target.y2"
                stroke="transparent"
                :stroke-width="target.kind === 'leg' ? 26 : 20"
                stroke-linecap="round"
                tabindex="0"
                role="button"
                :aria-label="target.label"
                @focus="setHover(target.active)"
                @blur="clearHover"
                @keydown.enter.prevent="togglePin(target.active)"
                @keydown.space.prevent="togglePin(target.active)"
              />
            </svg>
          </div>

          <!-- The callout lives in the stage, not the plate: on a wide card it sits in
               its own lane beside the molecule, and only overlays the molecule when the
               card is too narrow to give it a lane of its own. -->
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
                  :style="{ background: hudBarGradient, ...barMaskStyle }"
                ></div>
                <div
                  v-else
                  class="genome-hud__bar-fill genome-hud__bar-fill--neutral"
                  :style="barMaskStyle"
                ></div>
              </div>
              <div v-if="hudInfo.mixKnown" class="genome-hud__mix">
                <template v-for="(pct, i) in hudInfo.mix" :key="i">
                  <span>
                    <span
                      class="genome-hud__dot"
                      :style="{ background: bubble(i) }"
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
                    :style="{ background: bubble(i) }"
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

            <Popover>
              <PopoverTrigger as-child>
                <button type="button" class="genome-legend-trigger">
                  {{ $t("listening_genome.molecule.legend_heading") }}
                </button>
              </PopoverTrigger>
              <PopoverContent class="genome-page w-72" side="top">
                <div class="genome-legend">
                  <p
                    v-for="key in [
                      'overexpressed',
                      'stable',
                      'underexpressed',
                    ] as ExpressionStatus[]"
                    :key="key"
                    class="genome-legend__row"
                  >
                    <span
                      class="genome-legend__swatch"
                      :style="{ background: statusStyle(key).c }"
                    ></span>
                    <span>{{
                      $t(
                        `listening_genome.molecule.legend_${key === "overexpressed" ? "over" : key === "stable" ? "stable" : "under"}`,
                      )
                    }}</span>
                  </p>
                  <p class="genome-legend__note">
                    {{ $t("listening_genome.molecule.legend_note") }}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GenreShare } from "@/composables/genome/types";
import {
  backboneBands,
  bandAt,
  buildField,
  distanceToSegment,
  GENOME_RADIANS_PER_SECOND,
  HELIX_H,
  HELIX_W,
  LIT_RUNGS,
  mostDivergent,
  pairRungsWithGenres,
  project,
  secondaryGenres,
  type Band,
  type ParticleField,
} from "@/helpers/genome_helix";
import {
  baseCode,
  estimatePlays,
  mixGradientStops,
  secondaryCode,
  statusForRatio,
  type ExpressionStatus,
} from "@/helpers/genome_molecule";
import { formatPercent, formatPlays } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";

// A strip of speck texture, used to mask the callout's mix bar so the bar is made of the
// same material as the rung it describes rather than being a flat gradient.
const barMaskSrc = new URL("@/assets/genome/helix_bar.png", import.meta.url)
  .href;

// Defaulted rather than required: a genome served from a cache written by an older
// result shape can arrive without `bases`, and a component that throws on a missing
// field takes its whole card down with it (silently - nothing reaches the server log).
const props = withDefaults(
  defineProps<{
    genres?: GenreShare[];
    bases?: GenreShare[];
    totalListens?: number;
  }>(),
  { genres: () => [], bases: () => [], totalListens: 0 },
);

// ---- palette ------------------------------------------------------------------

// Fixed hues for up to 4 bases - a purely presentational palette, not tied to genre
// identity, so it's stable regardless of which genres occupy the slots.
// Evenly spaced, 90 degrees apart, and that spacing is the whole point. The first
// palette used 188/288/146/30, where cyan and green sit only 42 degrees apart: any mix
// touching both reinforced along that arc, and 53% of blends came back somewhere in the
// green-to-cyan band regardless of the genre's actual character. With equal spacing no
// pair reinforces more than any other, and a genre with no real allegiance cancels toward
// grey instead of drifting teal.
const HUES = [190, 280, 10, 100];
function baseColor(index: number, lightness = 62, saturation = 82): string {
  return `hsl(${HUES[index % HUES.length]} ${saturation}% ${lightness}%)`;
}
/** Uncoloured particles: the structure everything else is suspended in. */
const DUST = "hsl(210 12% 88%)";

// The legend markers are the same object as a particle in the molecule: a soft-edged,
// translucent blob, not a flat disc. A radial gradient reproduces the renderer's falloff,
// and a highlight off-centre is what makes it read as a bubble rather than a smudge.
function bubble(index: number): string {
  const core = baseColor(index, 68, 85);
  const edge = baseColor(index, 52, 80);
  return (
    `radial-gradient(circle at 38% 34%, rgba(255,255,255,.55) 0%, ` +
    `rgba(255,255,255,0) 34%), ` +
    `radial-gradient(circle at 50% 50%, ${core} 0%, ${core} 38%, ${edge} 62%, ` +
    `transparent 76%)`
  );
}

/** Shortest-path hue interpolation, so cyan never blends through red to reach orange. */
function mixHue(a: number, b: number, f: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * f + 360) % 360;
}

/**
 * A rung's colour: all four base colours mixed, weighted by the genre's affinity to each.
 *
 * Averaging the hues numerically would be wrong (the average of cyan and orange is green,
 * which is a base colour and means something else), and averaging RGB turns any even
 * blend to mud. Instead each base is a VECTOR on the colour wheel - its own hue for
 * direction, its share of the mix for length - and they are summed. Two useful properties
 * fall out of that for free:
 *
 *   - the resultant angle is a true blend, so a genre split between cyan and magenta
 *     lands on the violet between them, distinct from either;
 *   - the resultant LENGTH is how lopsided the mix is. A genre that belongs equally to
 *     all four cancels out to near zero and comes back almost colourless, which is the
 *     honest answer: it has no particular allegiance.
 */
function rungColor(mix: number[], muted = false): string {
  if (mix.length === 0) return DUST;
  const total = mix.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return DUST;
  let vx = 0;
  let vy = 0;
  mix.forEach((weight, i) => {
    const angle = (HUES[i % HUES.length] * Math.PI) / 180;
    const w = Math.max(0, weight) / total;
    vx += w * Math.cos(angle);
    vy += w * Math.sin(angle);
  });
  const hue = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
  const purity = Math.min(1, Math.hypot(vx, vy));
  // A rung that is not among the divergent six still shows its true hue, but drained of
  // most of its saturation. That keeps the hierarchy doing the work: the six read as "in
  // colour" and the rest as tinted structure, rather than twenty-six equal claims on the
  // eye. Hue is preserved either way, so a muted rung is still recognisably itself.
  const sat = (38 + 50 * purity) * (muted ? 0.42 : 1);
  const light = (54 + 14 * purity) * (muted ? 0.88 : 1);
  return `hsl(${hue.toFixed(1)} ${Math.round(sat)}% ${Math.round(light)}%)`;
}

// ---- data shaping ---------------------------------------------------------------

const bases = computed(() => props.bases);
const hasBases = computed(() => bases.value.length > 0);

// `base_mix` is [] when cross-genre affinity isn't computable, and absent entirely on a
// payload from an older result schema. Both mean the same thing to the visual.
function baseMix(genre: GenreShare): number[] {
  return genre.base_mix ?? [];
}

const field: ParticleField = buildField();
const secondary = computed(() => secondaryGenres(props.genres, props.bases));
/** The lit rungs: the genres that account for most of the household's divergence. */
const lit = computed(() => mostDivergent(secondary.value, LIT_RUNGS));
// Every secondary genre's position, lit or not. The callout code used `litRank`, which
// only knows the six lit genres, so every other rung fell through to its `?? 0` default
// and announced itself as GEN-01.
const orderedRank = computed(() => {
  const map = new Map<string, number>();
  ordered.value.forEach((g, i) => map.set(g.key, i));
  return map;
});

// Every rung carries a genre, not just the lit six. The taxonomy has 59 genres, so a
// real library fills all 26 comfortably - and a rung with nothing behind it is a rung
// that cannot be hovered, which would leave two thirds of the molecule inert scenery.
// The divergent six are simply the ones lit; the rest are there to be found.
const ordered = computed(() => {
  const litKeys = new Set(lit.value.map((g) => g.key));
  const rest = secondary.value
    .filter((g) => !litKeys.has(g.key))
    .sort((a, b) => b.share - a.share);
  return [...lit.value, ...rest];
});
// Paired once, at phase zero, longest rung first. Pairing by a rung's CURRENT length
// would reshuffle the genres every frame as the molecule turned, which is nonsense: a
// genre has a rung.
const pairs = computed(() => pairRungsWithGenres(field.rungs, ordered.value));
const litKeys = computed(() => new Set(lit.value.map((g) => g.key)));
const bands = computed<Band[]>(() => backboneBands(props.bases));

// ---- interaction state -----------------------------------------------------------

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

const active = computed<ActiveTarget | null>(
  () => hovered.value ?? pinned.value,
);

// ---- the clock -------------------------------------------------------------------

const RADIANS_PER_SECOND = GENOME_RADIANS_PER_SECOND;

const phase = ref(0);
const prefersReducedMotion =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const reduceMotion = ref(prefersReducedMotion?.matches ?? false);
const pageHidden = ref(false);

// Three reasons to hold still, all of them about not fighting the reader: the tab is
// hidden (pure waste), something is hovered or pinned (a callout chasing a moving target
// is unusable), or the reader has asked the system for less motion.
const spinning = computed(
  () => !pageHidden.value && !reduceMotion.value && active.value === null,
);

let rafId: number | null = null;
let lastFrame = 0;
let lastTargetsAt = 0;

// ---- canvas ----------------------------------------------------------------------

const plateEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;

const SPRITE = 34;
const spriteCache = new Map<string, HTMLCanvasElement>();
function spriteFor(color: string): HTMLCanvasElement | null {
  const cached = spriteCache.get(color);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  grad.addColorStop(0, color);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(SPRITE / 2, SPRITE / 2, SPRITE / 2, 0, Math.PI * 2);
  g.fill();
  spriteCache.set(color, c);
  return c;
}

function blob(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0.004) return;
  const sprite = spriteFor(color);
  if (!sprite) return;
  g.globalAlpha = Math.min(1, alpha);
  const d = radius * 4;
  g.drawImage(sprite, x - d / 2, y - d / 2, d, d);
}

/** The backbone's colour at a point: the band's base, softened toward its neighbour. */
function legColor(t: number): string {
  const list = bands.value;
  if (list.length === 0) return DUST;
  const { index, next, mix } = bandAt(list, t);
  const h1 = HUES[list[index].baseIndex % HUES.length];
  const hue =
    next === -1
      ? h1
      : mixHue(h1, HUES[list[next].baseIndex % HUES.length], mix);
  // Saturated enough to read as a band of that base's colour, light enough to stay
  // subordinate to the lit rungs - the backbone is where the listening SITS, the rungs
  // are what makes it unusual.
  return `hsl(${hue} 50% 70%)`;
}

function draw(): void {
  const g = ctx;
  const canvas = canvasEl.value;
  if (!g || !canvas) return;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / HELIX_W;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  // Additive: overlapping particles accumulate light, which is what gives an open cloud
  // a sense of density without any single particle being opaque.
  g.globalCompositeOperation = "lighter";

  const p = phase.value;
  const activeTarget = active.value;

  for (const particle of field.legs) {
    const { x, y, depth } = project(
      particle.t,
      particle.leg,
      p,
      particle.dTheta,
      particle.dRadius,
      particle.dY,
    );
    const legActive = activeTarget?.legKey === particle.leg;
    blob(
      g,
      x,
      y,
      particle.size * (0.6 + 0.5 * depth) * (legActive ? 1.2 : 1),
      legColor(particle.t),
      particle.gain * (0.1 + 0.95 * depth) * (legActive ? 0.9 : 0.46),
    );
  }

  for (const rung of field.rungs) {
    const genre = pairs.value.get(rung.index);
    const isLit = genre !== undefined && litKeys.value.has(genre.key);
    // Every paired rung carries its own colour, not just the lit six - a rung you can
    // hover and read should look like something, and the mix is what it IS. The six stay
    // dominant through brightness and their halo, not by being the only coloured thing.
    const color = genre ? rungColor(baseMix(genre), !isLit) : DUST;
    const isActive = activeTarget?.rungIndex === rung.index;
    for (const q of rung.particles) {
      const a = project(rung.t, 0, p, 0, q.dRadius, q.dY);
      const b = project(rung.t, 1, p, 0, q.dRadius, q.dY);
      const x = a.x + (b.x - a.x) * q.f;
      const y = a.y + (b.y - a.y) * q.f;
      const depth = a.depth + (b.depth - a.depth) * q.f;
      const dgain = q.gain * (0.1 + 0.95 * depth);
      // A lit rung gets a wide, faint halo under its specks. That halo is most of what
      // makes it read as a band of light rather than a dotted line.
      if (isLit) {
        blob(g, x, y, q.size * 3.4, color, dgain * (isActive ? 0.3 : 0.15));
      }
      blob(
        g,
        x,
        y,
        q.size * (0.55 + 0.5 * depth) * (isActive ? 1.3 : isLit ? 1 : 0.85),
        color,
        dgain * (isLit ? 0.92 : 0.3) * (isActive ? 1.7 : 1),
      );
    }
  }

  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
}

function resizeCanvas(): void {
  const canvas = canvasEl.value;
  const host = plateEl.value;
  if (!canvas || !host) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(host.clientWidth * dpr));
  const height = Math.round((width * HELIX_H) / HELIX_W);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  draw();
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (spinning.value) {
    phase.value += RADIANS_PER_SECOND * dt;
    // Keyboard hit targets follow the molecule, but they only have to be accurate once
    // it has stopped - which is exactly when anything can be focused. Refreshing them
    // every frame would re-render 28 SVG nodes for nobody's benefit.
    if (now - lastTargetsAt > 250) {
      lastTargetsAt = now;
      refreshHitTargets();
    }
  }
  draw();
  rafId = requestAnimationFrame(frame);
}

// ---- hit testing -------------------------------------------------------------------

/** Convert a pointer position to plate coordinates. */
function toPlate(
  event: PointerEvent | MouseEvent,
): { x: number; y: number } | null {
  const host = plateEl.value;
  if (!host) return null;
  const rect = host.getBoundingClientRect();
  if (rect.width === 0) return null;
  const scale = HELIX_W / rect.width;
  return {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
}

const RUNG_HIT_RADIUS = 16;
const LEG_HIT_RADIUS = 13;
const LEG_HIT_SEGMENTS = 60;

/** The rung or strand nearest the pointer, or null when it is over empty space. */
function pick(x: number, y: number): ActiveTarget | null {
  const p = phase.value;
  let best: ActiveTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const rung of field.rungs) {
    if (!pairs.value.has(rung.index)) continue; // unlit rungs carry nothing to show
    const a = project(rung.t, 0, p);
    const b = project(rung.t, 1, p);
    const d = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
    if (d < bestDistance && d < RUNG_HIT_RADIUS) {
      bestDistance = d;
      best = { rungIndex: rung.index };
    }
  }

  for (const leg of [0, 1] as const) {
    for (let i = 0; i < LEG_HIT_SEGMENTS; i++) {
      const a = project(i / LEG_HIT_SEGMENTS, leg, p);
      const b = project((i + 1) / LEG_HIT_SEGMENTS, leg, p);
      const d = distanceToSegment(x, y, a.x, a.y, b.x, b.y);
      if (d < bestDistance && d < LEG_HIT_RADIUS) {
        bestDistance = d;
        best = { legKey: leg };
      }
    }
  }
  return best;
}

function onPointerMove(event: PointerEvent): void {
  const point = toPlate(event);
  if (!point) return;
  const hit = pick(point.x, point.y);
  if (hit) setHover(hit);
  else clearHover();
}

function onClick(event: MouseEvent): void {
  const point = toPlate(event);
  if (!point) return;
  const hit = pick(point.x, point.y);
  if (hit) togglePin(hit);
}

interface HitTarget {
  key: string;
  kind: "leg" | "rung";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  active: ActiveTarget;
}
const hitTargets = shallowRef<HitTarget[]>([]);

function refreshHitTargets(): void {
  const p = phase.value;
  const out: HitTarget[] = [];
  for (const leg of [0, 1] as const) {
    const a = project(0, leg, p);
    const b = project(1, leg, p);
    out.push({
      key: `leg-${leg}`,
      kind: "leg",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      label: legAriaLabel.value,
      active: { legKey: leg },
    });
  }
  for (const rung of field.rungs) {
    const genre = pairs.value.get(rung.index);
    if (!genre) continue;
    const a = project(rung.t, 0, p);
    const b = project(rung.t, 1, p);
    out.push({
      key: `rung-${rung.index}`,
      kind: "rung",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      label: rungAriaLabel(genre),
      active: { rungIndex: rung.index },
    });
  }
  hitTargets.value = out;
}

// ---- lifecycle ---------------------------------------------------------------------

function onVisibility(): void {
  pageHidden.value = document.visibilityState === "hidden";
}
function onMotionPreference(event: MediaQueryListEvent): void {
  reduceMotion.value = event.matches;
}

onMounted(() => {
  const canvas = canvasEl.value;
  if (canvas) ctx = canvas.getContext("2d");
  resizeCanvas();
  refreshHitTargets();
  if (typeof ResizeObserver !== "undefined" && plateEl.value) {
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(plateEl.value);
  }
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();
  prefersReducedMotion?.addEventListener?.("change", onMotionPreference);
  if (typeof requestAnimationFrame === "function") {
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
  document.removeEventListener("visibilitychange", onVisibility);
  prefersReducedMotion?.removeEventListener?.("change", onMotionPreference);
});

// Stopping is the moment the hit targets must be exact, because that is when they can be
// focused and when the callout is anchored.
watch(active, () => refreshHitTargets());
watch([() => props.genres, () => props.bases], () => {
  refreshHitTargets();
  draw();
});

// ---- callout ------------------------------------------------------------------------

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
    const mid = project(0.5, target.legKey as 0 | 1, phase.value);
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
      anchor: { x: mid.x, y: mid.y },
    };
  }

  const rung = field.rungs.find((r) => r.index === target.rungIndex);
  const genre = rung ? pairs.value.get(rung.index) : undefined;
  if (!rung || !genre) return null;
  const a = project(rung.t, 0, phase.value);
  const b = project(rung.t, 1, phase.value);
  const mix = baseMix(genre);
  return {
    code: secondaryCode(orderedRank.value.get(genre.key) ?? 0),
    title: genre.label,
    desc: $t("listening_genome.molecule.share_of_listening", {
      percent: formatPercent(genre.share),
      plays: formatPlays(estimatePlays(genre.share, props.totalListens)),
    }),
    mix,
    mixLabels: bases.value.map((b) => b.label),
    mixKnown: mix.length > 0,
    status: statusForRatio(genre.ratio),
    anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
});

const reticle = computed(() => (hudInfo.value ? hudInfo.value.anchor : null));

const hudTopFraction = computed(() =>
  reticle.value ? Math.max(0.01, reticle.value.y / HELIX_H - 0.06) : 0,
);

const hudStyle = computed(() => ({
  "--hud-top-fr": `${hudTopFraction.value}`,
}));

const barMaskStyle = {
  maskImage: `url("${barMaskSrc}")`,
  WebkitMaskImage: `url("${barMaskSrc}")`,
  // auto width, not 100%: stretching the strip to the bar's width squashes every bubble
  // into a tall oval. Tiling keeps them round at any bar width.
  maskSize: "auto 100%",
  WebkitMaskSize: "auto 100%",
  maskRepeat: "repeat-x",
  WebkitMaskRepeat: "repeat-x",
};

const hudBarGradient = computed(() => {
  if (!hudInfo.value || !hudInfo.value.mixKnown) return "";
  const stops = mixGradientStops(hudInfo.value.mix, (i) => baseColor(i, 58));
  return `linear-gradient(90deg, ${stops
    .map((s) => `${s.color} ${s.offsetPercent.toFixed(1)}%`)
    .join(",")})`;
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
     query below establishes - the page has a sidebar, so vw would undersize it. */
  --stage-h: clamp(380px, 62cqi, 660px);
  /* The plate's aspect ratio is fixed, so its rendered width follows from the stage
     height - which is what lets the callout lanes be plain calc(). */
  --plate-w: calc(var(--stage-h) * 540 / 700);
  --stage-pad: 18px;
  --panel-w: clamp(170px, 20cqi, 230px);
  --lane-gap: 22px;
  position: relative;
  /* Three columns: a callout lane, the molecule, a callout lane. The molecule sits in
     the middle of the card rather than hard left, and the space on both sides is a place
     for information rather than margin. Which lane the callout uses depends on which
     side of the axis the reticle is on, so the leader line never crosses the molecule. */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  height: var(--stage-h);
  padding: var(--stage-pad);
  border-radius: 10px;
  /* The molecule is light on darkness, so the panel carries its own ground rather than
     inheriting the theme's. */
  background: #06070a;
}
.genome-plate {
  position: relative;
  grid-column: 2;
  height: 100%;
  aspect-ratio: 540 / 700;
}
.genome-plate__canvas,
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
  grid-column: 3;
  /* Nearer the molecule than the card's edge: pinned to the far right it read as a
     separate sidebar rather than a legend belonging to the thing beside it. */
  justify-self: start;
  margin-left: var(--lane-gap);
  width: var(--panel-w);
  align-self: start;
  padding: 14px 15px 13px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}
.genome-panel__heading {
  font-family: var(--genome-text);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.2em;
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
  width: clamp(190px, 22cqi, 290px);
  top: min(
    calc(var(--stage-pad) + var(--hud-top-fr) * var(--stage-h)),
    calc(100% - 230px)
  );
}
/* The left lane, always. Choosing a side from the reticle looked appealing but is
   degenerate: a rung spans both strands, so its midpoint sits on the axis whichever rung
   it is, and the callout would have flipped on noise. A fixed side also means the panel
   never moves between two rungs, which matters more than symmetry. */
.genome-hud {
  right: calc(50% + var(--plate-w) / 2 + var(--lane-gap));
}
/* The code tab sits at the panel's top-right now that the callout is in the left lane,
   so it points back toward the molecule. Floating it collapsed the tab out of flow. */
.genome-hud__code {
  display: block;
  width: fit-content;
  margin-left: auto;
  border-radius: 4px 4px 0 0;
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
  font: 600 12.5px/1.25 var(--genome-display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
}
.genome-hud__desc {
  font-family: var(--genome-text);
  font-size: 11px;
  color: #8f939d;
  margin-top: 3px;
  line-height: 1.35;
}
.genome-hud__bar {
  display: flex;
  /* Taller than a plain progress bar needs to be: it is masked by the speck texture,
     and specks need room to read as specks. */
  height: 15px;
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
  width: 11px;
  height: 11px;
  margin-right: 5px;
  vertical-align: -1px;
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
  width: 15px;
  height: 15px;
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

/* Narrow: no room for a callout lane. The stage stacks, and the callout stops floating
   entirely - it becomes a block under the molecule. Overlaying it on a small plate hid
   the thing it was describing. The reticle still marks the spot. */
/* Narrow: no room for a lane either side. One column, and the callout stops floating
   entirely - it becomes a block under the molecule. Overlaying it on a small plate hid
   the thing it was describing. The reticle still marks the spot. */
@container (max-width: 860px) {
  .genome-stage {
    --stage-h: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
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
    left: auto;
    right: auto;
  }
  .genome-hud__code {
    margin-left: 0;
  }
  .genome-panel {
    order: 3;
    width: 100%;
    max-width: 420px;
    justify-self: stretch;
  }
  .genome-leader {
    display: none;
  }
}
</style>
