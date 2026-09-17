<template>
  <canvas
    ref="canvasEl"
    class="gene-glyph"
    role="presentation"
    aria-hidden="true"
  ></canvas>
</template>

<script setup lang="ts">
/**
 * A small rotating helix, drawn from the same particles as the molecule.
 *
 * It sits in the dead space of a stat tile and turns at exactly the molecule's rate, so
 * the page reads as one instrument rather than a chart with a decoration stuck on it.
 * It carries no data - a glyph that looked like it encoded something but did not would
 * be worse than an obvious ornament - so it is hidden from assistive technology.
 *
 * It keeps its own clock rather than sharing the molecule's. Same SPEED, independent
 * phase: the molecule stops whenever a callout is open, and a row of tiles freezing
 * because someone hovered a rung two cards away would look like a bug.
 */
import { GENOME_RADIANS_PER_SECOND } from "@/helpers/genome_helix";
import { BASE_L, oklch } from "@/helpers/genome_color";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    /** OKLCH hue in degrees, normally one of the molecule's four base hues. */
    hue?: number;
    /** 0..1 - how far this tile's own figure sits along its range, if it has one. */
    intensity?: number;
  }>(),
  { hue: 195, intensity: 0.6 },
);

const W = 64;
const H = 92;
const TURNS = 1.75;
const RADIUS = 17;
const TOP = 10;
const BOTTOM = H - 10;
const STEPS = 46;
const PER_STEP = 2;
/** The same 9-degree lean as the molecule, so the two read as the same object. */
const TILT = (9 * Math.PI) / 180;

interface Speck {
  t: number;
  leg: 0 | 1;
  dR: number;
  dY: number;
  size: number;
  gain: number;
}

/** Deterministic, like the molecule's own field: this glyph must not reshuffle on mount. */
function buildSpecks(): Speck[] {
  let seed = 11;
  const rnd = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: Speck[] = [];
  for (let i = 0; i < STEPS; i++) {
    for (const leg of [0, 1] as const) {
      for (let k = 0; k < PER_STEP; k++) {
        out.push({
          t: i / STEPS,
          leg,
          dR: (rnd() - 0.5) * 3.2,
          dY: (rnd() - 0.5) * 2.4,
          size: 0.9 + rnd() * 1.5,
          gain: 0.45 + rnd() * 0.75,
        });
      }
    }
  }
  return out;
}
const specks = buildSpecks();

const canvasEl = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let raf: number | null = null;
let last = 0;
let phase = 0;

const reduceMotionQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

function draw(): void {
  const canvas = canvasEl.value;
  if (!ctx || !canvas) return;
  const scale = canvas.width / W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = "lighter";

  for (const s of specks) {
    const theta = phase + 2 * Math.PI * TURNS * s.t + (s.leg ? Math.PI : 0);
    const r = RADIUS + s.dR;
    const rawX = W / 2 + r * Math.cos(theta);
    const rawY = TOP + s.t * (BOTTOM - TOP) + s.dY;
    const midY = (TOP + BOTTOM) / 2;
    const ca = Math.cos(TILT);
    const sa = Math.sin(TILT);
    const dx = rawX - W / 2;
    const dy = rawY - midY;
    const x = W / 2 + dx * ca - dy * sa;
    const y = midY + dx * sa + dy * ca;
    const depth = (Math.sin(theta) + 1) / 2;
    const alpha =
      s.gain * (0.12 + 0.85 * depth) * (0.35 + 0.5 * props.intensity);
    if (alpha <= 0.01) continue;
    // Lightness barely moves with depth; chroma carries it instead. In OKLCH that keeps
    // the near face reading as "more colour" rather than "brighter", so the glyph does not
    // flash as it turns.
    const l = BASE_L - 0.1 + 0.08 * depth;
    const c = 0.05 + 0.075 * depth;
    ctx.fillStyle = oklch(l, c, props.hue, Math.min(1, alpha));
    ctx.beginPath();
    ctx.arc(x, y, s.size * (0.6 + 0.6 * depth), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!document.hidden && !reduceMotionQuery?.matches) {
    phase += GENOME_RADIANS_PER_SECOND * dt;
  }
  draw();
  raf = requestAnimationFrame(frame);
}

function resize(): void {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  draw();
}

onMounted(() => {
  const canvas = canvasEl.value;
  if (canvas) ctx = canvas.getContext("2d");
  resize();
  if (typeof requestAnimationFrame === "function") {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
});
onBeforeUnmount(() => {
  if (raf !== null) cancelAnimationFrame(raf);
});
watch(() => [props.hue, props.intensity], draw);
</script>

<style scoped>
.gene-glyph {
  /* 64 x 92 internally, so this keeps the aspect exactly rather than squashing the
     helix a fraction narrower than the one in the plate. */
  width: 44px;
  height: 63px;
  flex: 0 0 auto;
  opacity: 0.9;
  pointer-events: none;
}
</style>
