<template>
  <div class="space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Dna class="mr-2 h-5 w-5" />
          {{ $t("listening_genome.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("listening_genome.subtitle") }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button as-child variant="ghost" size="icon">
          <RouterLink
            to="/settings/genome-import"
            class="no-underline"
            :aria-label="$t('listening_genome.open_settings')"
            :title="$t('listening_genome.open_settings')"
          >
            <Settings class="size-4" />
          </RouterLink>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading"
          @click="rebuild"
        >
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
          {{ $t("listening_genome.rebuild") }}
        </Button>
      </div>
    </header>

    <template v-if="loading && !genome">
      <div class="space-y-6">
        <Skeleton class="h-64 w-full" />
        <Skeleton class="h-28 w-full" />
        <Skeleton class="h-72 w-full" />
      </div>
    </template>

    <template v-else-if="genome && genome.stats.total_listens === 0">
      <GenomeEmptyState :loading="loading" @rebuild="rebuild" />
    </template>

    <template v-else-if="genome">
      <!-- Genre resolution runs as a paced background pass against MusicBrainz. Until it
           finishes, the genre breakdown - and therefore the divergence score - is provisional,
           and saying so is more honest than showing a confident number built on partial data. -->
      <Alert v-if="genome.stats.artists_pending > 0" variant="default">
        <Loader2 class="size-4 animate-spin" />
        <AlertTitle>{{ $t("listening_genome.enriching_title") }}</AlertTitle>
        <AlertDescription>
          {{
            $t("listening_genome.enriching_body", {
              pending: genome.stats.artists_pending,
              resolved: genome.stats.artists_resolved,
            })
          }}
        </AlertDescription>
      </Alert>

      <!-- Headline: the DNA molecule (bases + secondary genre rungs) -->
      <GenomeMolecule
        :genres="genome.genres"
        :bases="genome.bases"
        :total-listens="genome.stats.total_listens"
      />

      <div
        v-if="genome.divergence.top_over.length > 0"
        class="flex flex-wrap gap-1.5"
      >
        <Badge
          v-for="g in genome.divergence.top_over"
          :key="g.key"
          variant="secondary"
        >
          {{ g.label }}
          {{
            $t("listening_genome.vs_average", {
              ratio: formatRatio(g.ratio),
            })
          }}
        </Badge>
      </div>

      <GenomeStatTiles
        :obscurity="genome.obscurity"
        :era="genome.era"
        :loyalty="genome.loyalty"
      />

      <GenomeTopLists
        :top-artists="genome.top_artists"
        :top-tracks="genome.top_tracks"
      />

      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <GenomeRhythmHeatmap :rhythm="genome.rhythm" />
        <GenomePlayerSplit :players="genome.players" />
      </div>

      <p class="text-xs text-muted-foreground">
        {{
          $t("listening_genome.stats_footer", {
            listens: formatPlays(genome.stats.total_listens),
            artists: formatPlays(genome.stats.distinct_artists),
            tracks: formatPlays(genome.stats.distinct_tracks),
          })
        }}
        <span v-if="genome.stale">
          · {{ $t("listening_genome.stale_notice") }}
        </span>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GenomeEmptyState from "@/components/genome/GenomeEmptyState.vue";
import GenomeMolecule from "@/components/genome/GenomeMolecule.vue";
import GenomePlayerSplit from "@/components/genome/GenomePlayerSplit.vue";
import GenomeRhythmHeatmap from "@/components/genome/GenomeRhythmHeatmap.vue";
import GenomeStatTiles from "@/components/genome/GenomeStatTiles.vue";
import GenomeTopLists from "@/components/genome/GenomeTopLists.vue";
import { useGenome } from "@/composables/genome/useGenome";
import { formatPlays, formatRatio } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { Dna, Loader2, RefreshCw, Settings } from "@lucide/vue";
import { onMounted } from "vue";
import { RouterLink } from "vue-router";

const { genome, loading, load, rebuild } = useGenome();

onMounted(() => {
  load();
});
</script>
