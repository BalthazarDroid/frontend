<template>
  <Card class="genome-panel-frame genome-tops">
    <CardHeader>
      <CardTitle>{{ $t("listening_genome.top_lists") }}</CardTitle>
    </CardHeader>
    <CardContent class="genome-tops__body">
      <Tabs default-value="artists" class="genome-tops__tabs">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="artists">
            {{ $t("listening_genome.top_artists") }}
          </TabsTrigger>
          <TabsTrigger value="tracks">
            {{ $t("listening_genome.top_tracks") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artists" class="genome-tops__pane">
          <ol class="genome-rank genome-tops__scroll">
            <li
              v-for="(artist, i) in topArtists"
              :key="artist.artist_key"
              class="genome-rank__row"
            >
              <span class="genome-rank__index">{{ pad(i + 1) }}</span>
              <span class="genome-rank__body">
                <span class="genome-rank__name">{{ artist.name }}</span>
                <span class="genome-rank__meta">
                  {{ $t("listening_genome.plays", { count: artist.plays }) }}
                  <template v-if="artist.ratio_vs_average">
                    ·
                    {{
                      $t("listening_genome.vs_average", {
                        ratio: formatRatio(artist.ratio_vs_average),
                      })
                    }}
                  </template>
                </span>
              </span>
            </li>
          </ol>
        </TabsContent>

        <TabsContent value="tracks" class="genome-tops__pane">
          <ol class="genome-rank genome-tops__scroll">
            <li
              v-for="(track, i) in topTracks"
              :key="track.track_key"
              class="genome-rank__row"
            >
              <span class="genome-rank__index">{{ pad(i + 1) }}</span>
              <span class="genome-rank__body">
                <span class="genome-rank__name">{{ track.name }}</span>
                <span class="genome-rank__meta">
                  {{ track.artist }} ·
                  {{ $t("listening_genome.plays", { count: track.plays }) }}
                </span>
              </span>
            </li>
          </ol>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
/**
 * The household's top twenty artists and tracks.
 *
 * Deliberately no share meter. The bar re-encoded what the play count already states, and
 * spent most of each row's width doing it - which left a wide gap between the name and a
 * graphic that added nothing. The rank number carries the ordering instead, and the twenty
 * rows fit a column that scrolls rather than a page that grows.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRatio } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import type { ArtistFact, TrackFact } from "@/composables/genome/types";

defineProps<{
  topArtists: ArtistFact[];
  topTracks: TrackFact[];
}>();

/** Zero-padded so the rank column stays a fixed width and the names line up. */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
</script>
