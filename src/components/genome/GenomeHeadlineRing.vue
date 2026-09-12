<template>
  <div class="flex flex-col items-center gap-3">
    <svg
      viewBox="0 0 100 100"
      class="h-[200px] w-[200px] shrink-0 sm:h-[240px] sm:w-[240px]"
      role="img"
      :aria-label="
        $t('listening_genome.ring_aria', { percent: divergence.percent })
      "
    >
      <g transform="rotate(-90 50 50)">
        <circle
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          stroke="var(--muted)"
          stroke-width="10"
        />
        <circle
          v-for="arc in arcs"
          :key="arc.key"
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          :stroke="`var(--chart-${arc.colorIndex + 1})`"
          stroke-width="10"
          stroke-linecap="butt"
          :stroke-dasharray="arc.dashArray"
          :stroke-dashoffset="arc.dashOffset"
        />
      </g>
      <text
        x="50"
        y="47"
        text-anchor="middle"
        class="fill-foreground text-[22px] font-semibold"
        style="font-variant-numeric: tabular-nums"
      >
        {{ divergence.percent }}%
      </text>
      <text
        x="50"
        y="60"
        text-anchor="middle"
        class="fill-muted-foreground text-[6.5px]"
      >
        {{ $t("listening_genome.divergence_caption") }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computeRingArcs } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { DivergenceFacts, GenreShare } from "@/composables/genome/types";

const props = defineProps<{
  divergence: DivergenceFacts;
  genres: GenreShare[];
}>();

const radius = 40;
const circumference = computed(() => 2 * Math.PI * radius);
const arcs = computed(() => computeRingArcs(props.genres, circumference.value));
</script>
