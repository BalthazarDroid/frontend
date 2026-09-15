<template>
  <Card class="genome-panel-frame">
    <CardHeader>
      <CardTitle>{{ $t("listening_genome.top_lists") }}</CardTitle>
    </CardHeader>
    <CardContent>
      <Tabs default-value="artists">
        <TabsList class="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="artists">
            {{ $t("listening_genome.top_artists") }}
          </TabsTrigger>
          <TabsTrigger value="tracks">
            {{ $t("listening_genome.top_tracks") }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artists" class="mt-4 space-y-1.5">
          <Item
            v-for="artist in topArtists"
            :key="artist.artist_key"
            variant="outline"
            size="sm"
            class="justify-between"
          >
            <ItemContent>
              <ItemTitle>{{ artist.name }}</ItemTitle>
              <ItemDescription class="text-xs">
                {{ $t("listening_genome.plays", { count: artist.plays }) }}
              </ItemDescription>
            </ItemContent>
            <ItemContent class="flex-none items-end gap-1.5 text-right">
              <Progress
                :model-value="artist.share * scaleArtists * 100"
                class="w-24"
              />
              <Badge
                v-if="artist.ratio_vs_average"
                variant="secondary"
                class="tabular-nums"
              >
                {{
                  $t("listening_genome.vs_average", {
                    ratio: formatRatio(artist.ratio_vs_average),
                  })
                }}
              </Badge>
            </ItemContent>
          </Item>
        </TabsContent>

        <TabsContent value="tracks" class="mt-4 space-y-1.5">
          <Item
            v-for="track in topTracks"
            :key="track.track_key"
            variant="outline"
            size="sm"
            class="justify-between"
          >
            <ItemContent>
              <ItemTitle>{{ track.name }}</ItemTitle>
              <ItemDescription class="text-xs">
                {{ track.artist }}
              </ItemDescription>
            </ItemContent>
            <ItemContent class="flex-none items-end gap-1.5 text-right">
              <Progress
                :model-value="track.share * scaleTracks * 100"
                class="w-24"
              />
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ $t("listening_genome.plays", { count: track.plays }) }}
              </span>
            </ItemContent>
          </Item>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRatio } from "@/helpers/genome_format";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import type { ArtistFact, TrackFact } from "@/composables/genome/types";

const props = defineProps<{
  topArtists: ArtistFact[];
  topTracks: TrackFact[];
}>();

// Progress bars are relative to the top row within each list, not the
// (much smaller) absolute share, so the leader reads as a full bar.
function relativeScale(shares: number[]): number {
  const max = shares.reduce((m, s) => Math.max(m, s), 0);
  return max > 0 ? 1 / max : 0;
}

const scaleArtists = computed(() =>
  relativeScale(props.topArtists.map((a) => a.share)),
);
const scaleTracks = computed(() =>
  relativeScale(props.topTracks.map((t) => t.share)),
);
</script>
