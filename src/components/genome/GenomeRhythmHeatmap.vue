<template>
  <Card>
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
              fill="var(--chart-1)"
              :opacity="cellData.opacity"
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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPercent,
  maxRhythmShare,
  rhythmCellOpacity,
} from "@/helpers/genome_format";
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

const maxShare = computed(() => maxRhythmShare(props.rhythm));
const cells = computed(() =>
  props.rhythm.map((c) => ({
    ...c,
    opacity: rhythmCellOpacity(c.share, maxShare.value),
  })),
);
</script>
