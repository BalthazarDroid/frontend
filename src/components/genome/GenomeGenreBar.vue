<template>
  <div class="space-y-3">
    <div
      class="flex h-4 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      :aria-label="$t('listening_genome.genre_share')"
    >
      <div
        v-for="segment in segments"
        :key="segment.key"
        :style="{
          width: `${segment.share * 100}%`,
          backgroundColor: segment.isOthers
            ? 'var(--muted-foreground)'
            : `var(--chart-${segment.colorIndex + 1})`,
        }"
        :title="
          segment.isOthers
            ? undefined
            : `${segment.label} · ${formatPercent(segment.share)}`
        "
      ></div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <div
        v-for="segment in topSegments"
        :key="segment.key"
        class="flex items-center gap-1.5"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: `var(--chart-${segment.colorIndex + 1})` }"
        ></span>
        <span class="font-medium">{{ segment.label }}</span>
        <span class="tabular-nums text-muted-foreground">{{
          formatPercent(segment.share)
        }}</span>
      </div>
      <span v-if="othersN > 0" class="text-muted-foreground">
        {{ $t("listening_genome.others", { count: othersN }) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  formatPercent,
  genreBarSegments,
  othersCount,
} from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { GenreShare } from "@/composables/genome/types";

const props = defineProps<{
  genres: GenreShare[];
  topN?: number;
}>();

const topN = computed(() => props.topN ?? 3);
const segments = computed(() => genreBarSegments(props.genres, topN.value));
const topSegments = computed(() => segments.value.filter((s) => !s.isOthers));
const othersN = computed(() => othersCount(props.genres, topN.value));
</script>
