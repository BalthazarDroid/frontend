<template>
  <div class="genome-page space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 class="genome-title inline-flex items-center text-2xl">
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
    <div class="genome-header-rule" aria-hidden="true"></div>

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
      <!-- Two different facts, so two different notices: work still in progress, and work
           that could not be done. Folding failures into "still resolving" produced a
           progress message that sat at "3 still to go" for days. -->
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

      <Alert v-else-if="genome.stats.artists_failed > 0" variant="default">
        <TriangleAlert class="size-4" />
        <AlertTitle>{{ $t("listening_genome.unresolved_title") }}</AlertTitle>
        <AlertDescription>
          {{
            $t("listening_genome.unresolved_body", {
              failed: genome.stats.artists_failed,
            })
          }}
          <Dialog>
            <DialogTrigger as-child>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="loadUnresolved"
              >
                {{ $t("listening_genome.unresolved_show") }}
              </Button>
            </DialogTrigger>
            <DialogScrollContent class="genome-page max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {{ $t("listening_genome.unresolved_title") }}
                </DialogTitle>
                <DialogDescription>
                  {{ $t("listening_genome.unresolved_dialog_hint") }}
                </DialogDescription>
              </DialogHeader>
              <p
                v-if="unresolvedLoading"
                class="py-4 text-sm text-muted-foreground"
              >
                {{ $t("listening_genome.loading") }}
              </p>
              <p class="genome-unresolved__advice">
                {{ $t("listening_genome.unresolved_what_to_do") }}
              </p>
              <ul v-if="!unresolvedLoading" class="genome-unresolved">
                <li v-for="a in unresolved" :key="a.artist_key">
                  <span class="genome-unresolved__name">{{
                    a.artist_name
                  }}</span>
                  <span class="genome-code">{{
                    formatAttempt(a.resolved_at)
                  }}</span>
                </li>
              </ul>
              <DialogFooter class="genome-unresolved__actions">
                <span class="genome-unresolved__hint">
                  {{ $t("listening_genome.unresolved_dismiss_hint") }}
                </span>
                <div class="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="dismissUnresolved"
                  >
                    {{ $t("listening_genome.unresolved_dismiss") }}
                  </Button>
                  <Button size="sm" @click="retryUnresolved">
                    {{ $t("listening_genome.unresolved_retry") }}
                  </Button>
                </div>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>
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

      <!-- The three figures stack in one narrow column and the top-twenty list fills a card
           beside them, sized to that column rather than to its own content. Three wide tiles
           in a row left each figure marooned in a third of the page. -->
      <div class="genome-columns">
        <GenomeStatTiles
          :obscurity="genome.obscurity"
          :era="genome.era"
          :loyalty="genome.loyalty"
        />
        <GenomeTopLists
          :top-artists="genome.top_artists"
          :top-tracks="genome.top_tracks"
        />
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <GenomeRhythmHeatmap :rhythm="genome.rhythm" />
        <GenomeDiscovery />
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
import "@/styles/genome.css";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GenomeEmptyState from "@/components/genome/GenomeEmptyState.vue";
import GenomeMolecule from "@/components/genome/GenomeMolecule.vue";
import GenomeDiscovery from "@/components/genome/GenomeDiscovery.vue";
import GenomeRhythmHeatmap from "@/components/genome/GenomeRhythmHeatmap.vue";
import GenomeStatTiles from "@/components/genome/GenomeStatTiles.vue";
import GenomeTopLists from "@/components/genome/GenomeTopLists.vue";
import { api } from "@/plugins/api";
import { toast } from "vue-sonner";
import type { FailedArtist } from "@/composables/genome/types";
import { useGenome } from "@/composables/genome/useGenome";
import { formatPlays, formatRatio } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { Dna, Loader2, RefreshCw, Settings, TriangleAlert } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const { genome, loading, load, rebuild } = useGenome();

// Fetched on demand rather than folded into the genome payload: it is a diagnostic a
// person opens once when something looks wrong, not part of the profile.
const unresolved = ref<FailedArtist[]>([]);
const unresolvedLoading = ref(false);

async function loadUnresolved(): Promise<void> {
  unresolvedLoading.value = true;
  try {
    unresolved.value = await api.sendCommand<FailedArtist[]>(
      "genome/unresolved_artists",
      { limit: 100 },
    );
  } catch {
    unresolved.value = [];
  } finally {
    unresolvedLoading.value = false;
  }
}

async function retryUnresolved(): Promise<void> {
  await api.sendCommand("genome/retry_artists", {});
  toast.success($t("listening_genome.unresolved_retried"));
  await load(true);
}

async function dismissUnresolved(): Promise<void> {
  await api.sendCommand("genome/dismiss_unresolved", {});
  await load(true);
}

/** "last tried 4 hours ago" - the absolute timestamp means nothing to a reader here. */
function formatAttempt(seconds: number): string {
  if (!seconds) return "";
  const hours = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 3600));
  if (hours < 1) return $t("listening_genome.attempted_recently");
  if (hours < 48) return $t("listening_genome.attempted_hours", { hours });
  return $t("listening_genome.attempted_days", {
    days: Math.round(hours / 24),
  });
}

onMounted(() => {
  load();
});
</script>
