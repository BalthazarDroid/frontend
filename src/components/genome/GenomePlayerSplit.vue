<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("listening_genome.players") }}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div
        v-for="player in sortedPlayers"
        :key="player.player_id"
        class="flex items-center gap-3"
      >
        <span class="w-28 shrink-0 truncate text-sm">{{ player.name }}</span>
        <Progress :model-value="player.share * 100" class="h-2 flex-1" />
        <span
          class="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
        >
          {{ formatPercent(player.share) }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { PlayerSplit } from "@/composables/genome/types";

const props = defineProps<{
  players: PlayerSplit[];
}>();

const sortedPlayers = computed(() =>
  [...props.players].sort((a, b) => b.share - a.share),
);
</script>
