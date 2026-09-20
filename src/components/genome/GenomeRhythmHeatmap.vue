<template>
  <Card class="genome-panel-frame rounded-lg bg-transparent">
    <CardHeader>
      <CardTitle>{{ $t("listening_genome.rhythm") }}</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <svg
          :viewBox="`0 0 ${width} ${height}`"
          class="h-auto min-w-[480px]"
          role="img"
          :aria-label="$t('listening_genome.rhythm')"
        >
          <text
            v-for="(label, i) in weekdayLabels"
            :key="label"
            :x="0"
            :y="labelOffset + i * cellSize + cellSize * 0.7"
            class="fill-muted-foreground text-[9px]"
          >
            {{ label }}
          </text>

          <g
            v-for="cellData in cells"
            :key="`${cellData.weekday}-${cellData.hour}`"
          >
            <rect
              :x="gridX + cellData.hour * cellSize"
              :y="labelOffset + cellData.weekday * cellSize"
              :width="cellSize - 1"
              :height="cellSize - 1"
              rx="1.5"
              :fill="cellData.fill"
            >
              <title>
                {{ weekdayLabels[cellData.weekday] }} {{ cellData.hour }}:00 ·
                {{ formatPercent(cellData.share) }}
              </title>
            </rect>
          </g>

          <text
            v-for="tick in hourTicks"
            :key="tick"
            :x="gridX + tick * cellSize + cellSize / 2"
            :y="labelOffset + 7 * cellSize + 10"
            text-anchor="middle"
            class="fill-muted-foreground text-[9px]"
          >
            {{ tick }}
          </text>
        </svg>
      </div>

      <!-- The steps are ranked rather than linear, so a reader has no way to infer the scale
           from the cells alone. The legend is what makes it honest. -->
      <div class="genome-rhythm__legend">
        <span class="genome-code">{{
          $t("listening_genome.rhythm_quieter")
        }}</span>
        <span
          v-for="(swatch, i) in legendSwatches"
          :key="i"
          class="genome-rhythm__swatch"
          :style="{ background: swatch }"
          aria-hidden="true"
        ></span>
        <span class="genome-code">{{
          $t("listening_genome.rhythm_busier")
        }}</span>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, maxRhythmShare } from "@/helpers/genome_format";
import {
  RHYTHM_STEPS,
  rhythmColor,
  rhythmStep,
  rhythmThresholds,
} from "@/helpers/genome_color";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { RhythmCell } from "@/composables/genome/types";

const props = defineProps<{
  rhythm: RhythmCell[];
}>();

const cellSize = 16;
const gridX = 22;
const labelOffset = 4;
const hourTicks = [0, 6, 12, 18];
const weekdayLabels = [
  $t("listening_genome.weekday_mon"),
  $t("listening_genome.weekday_tue"),
  $t("listening_genome.weekday_wed"),
  $t("listening_genome.weekday_thu"),
  $t("listening_genome.weekday_fri"),
  $t("listening_genome.weekday_sat"),
  $t("listening_genome.weekday_sun"),
];

const width = gridX + 24 * cellSize + 4;
const height = labelOffset + 7 * cellSize + 16;

const thresholds = computed(() =>
  rhythmThresholds(props.rhythm.map((c) => c.share)),
);
const maxShare = computed(() => maxRhythmShare(props.rhythm));

/** Swatches for the legend, quietest to busiest. */
const legendSwatches = computed(() =>
  Array.from({ length: RHYTHM_STEPS }, (_, i) =>
    rhythmColor(i / (RHYTHM_STEPS - 1)),
  ),
);
/**
 * Each cell is a solid colour rather than one tint at varying opacity.
 *
 * Opacity let the page background show through, so a quiet hour read as a hole in the card
 * instead of as a low value, and the scale inherited whatever was behind it. A colour taken
 * from the genome ramp keeps the grid reading as one surface and puts the card on the same
 * palette as the molecule above it.
 */
const cells = computed(() =>
  props.rhythm.map((c) => ({
    ...c,
    fill: rhythmColor(
      rhythmStep(c.share, thresholds.value, maxShare.value) /
        (RHYTHM_STEPS - 1),
    ),
  })),
);
</script>
