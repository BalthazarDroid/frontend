<template>
  <div class="grid gap-4 sm:grid-cols-3">
    <Card :class="{ 'opacity-60': obscurity.known_share < 0.5 }">
      <CardContent class="space-y-1 py-4">
        <div class="flex items-center gap-1.5">
          <span class="genome-code">
            {{ $t("listening_genome.obscurity") }}
          </span>
          <TooltipProvider :delay-duration="200">
            <Tooltip>
              <TooltipTrigger as-child>
                <Info
                  class="size-3.5 text-muted-foreground"
                  :aria-label="$t('listening_genome.obscurity_tooltip')"
                />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("listening_genome.obscurity_tooltip") }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div class="text-2xl font-semibold tabular-nums">
          {{ formatPercent(obscurity.index) }}
        </div>
        <div v-if="obscurity.known_share < 0.5" class="genome-code">
          {{ $t("listening_genome.low_confidence") }}
        </div>
      </CardContent>
    </Card>

    <Card class="genome-panel-frame">
      <CardContent class="space-y-1 py-4">
        <div class="flex items-center gap-1.5">
          <span class="genome-code">
            {{ $t("listening_genome.era_center") }}
          </span>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info
                class="size-3.5 text-muted-foreground"
                :aria-label="$t('listening_genome.era_center_tooltip')"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ $t("listening_genome.era_center_tooltip") }}
            </TooltipContent>
          </Tooltip>
        </div>
        <div class="text-2xl font-semibold tabular-nums">
          {{ formatYear(era.center_of_mass) }}
        </div>
        <div class="genome-code">
          ± {{ Math.round(era.spread) }} {{ $t("listening_genome.years") }}
        </div>
      </CardContent>
    </Card>

    <Card class="genome-panel-frame">
      <CardContent class="space-y-1 py-4">
        <div class="flex items-center gap-1.5">
          <span class="genome-code">
            {{ $t("listening_genome.eclecticism") }}
          </span>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info
                class="size-3.5 text-muted-foreground"
                :aria-label="$t('listening_genome.eclecticism_tooltip')"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ $t("listening_genome.eclecticism_tooltip") }}
            </TooltipContent>
          </Tooltip>
        </div>
        <div class="text-2xl font-semibold tabular-nums">
          {{ formatEffective(loyalty.effective_genres) }}
        </div>
        <div class="genome-code">
          {{
            loyalty.baseline_effective_genres > 0
              ? $t("listening_genome.eclecticism_vs_average", {
                  baseline: formatEffective(loyalty.baseline_effective_genres),
                })
              : $t("listening_genome.eclecticism_no_baseline")
          }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
/**
 * The effective number of genres: "listens across the equivalent of N genres, evenly".
 * One decimal, because the figure is a continuous measure and rounding 8.4 to 8 throws
 * away the only thing that distinguishes two libraries of similar breadth.
 */
function formatEffective(value: number): string {
  return value.toFixed(1);
}
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPercent, formatYear } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { Info } from "@lucide/vue";
import type {
  EraFacts,
  LoyaltyFacts,
  ObscurityFacts,
} from "@/composables/genome/types";

defineProps<{
  obscurity: ObscurityFacts;
  era: EraFacts;
  loyalty: LoyaltyFacts;
}>();
</script>
