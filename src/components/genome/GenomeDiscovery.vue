<template>
  <Card class="genome-panel-frame genome-discovery bg-transparent">
    <CardHeader>
      <CardTitle>{{ $t("listening_genome.discovery.title") }}</CardTitle>
      <Button
        data-slot="card-action"
        variant="ghost"
        size="icon"
        class="genome-discovery__refresh"
        :disabled="loading"
        :aria-label="$t('listening_genome.discovery.refresh')"
        :title="$t('listening_genome.discovery.refresh')"
        @click="refresh"
      >
        <RefreshCw class="size-3.5" :class="{ 'animate-spin': loading }" />
      </Button>
    </CardHeader>

    <CardContent class="genome-discovery__body">
      <p class="genome-discovery__lead">
        {{ $t("listening_genome.discovery.lead") }}
      </p>

      <!-- Suggestions first: they are the answer to "what should I try", where the cold
           corners below are the answer to "what have I already got and forgotten". -->
      <section class="genome-discovery__section">
        <h4 class="genome-code genome-discovery__label">
          {{ $t("listening_genome.discovery.suggested_heading") }}
        </h4>

        <p
          v-if="data && data.suggested_state === 'unavailable'"
          class="genome-discovery__empty"
        >
          {{ $t("listening_genome.discovery.no_lastfm") }}
          <RouterLink
            to="/settings/genome-import"
            class="genome-discovery__link"
          >
            {{ $t("listening_genome.discovery.no_lastfm_action") }}
          </RouterLink>
        </p>
        <p
          v-else-if="data && data.suggested_state === 'pending'"
          class="genome-discovery__empty"
        >
          {{ $t("listening_genome.discovery.pending") }}
        </p>
        <p
          v-else-if="data && data.suggested.length === 0"
          class="genome-discovery__empty"
        >
          {{ $t("listening_genome.discovery.no_suggestions") }}
        </p>

        <ul v-else-if="data" class="genome-discovery__list">
          <li
            v-for="a in data.suggested"
            :key="`${a.seed_artist}:${a.artist_name}`"
            class="genome-strand"
          >
            <!-- The marker is the same bubble as a molecule particle, tinted by the genre
                 the suggestion was matched on, so the card reads as part of the same
                 instrument rather than a list bolted onto the page. -->
            <span
              class="genome-strand__mark"
              :style="{ background: markFor(a.genre_key) }"
              aria-hidden="true"
            ></span>
            <span class="genome-strand__body">
              <span class="genome-strand__name">{{ a.artist_name }}</span>
              <span class="genome-strand__meta">
                {{
                  $t("listening_genome.discovery.because", {
                    seed: a.seed_artist,
                  })
                }}
              </span>
            </span>
            <span
              class="genome-strand__score"
              :title="$t('listening_genome.discovery.match_title')"
            >
              <span
                class="genome-strand__bar"
                :style="{
                  width: `${Math.round(Math.max(0, Math.min(1, a.match)) * 100)}%`,
                  background: markLine(a.genre_key),
                }"
              ></span>
            </span>
          </li>
        </ul>
      </section>

      <section class="genome-discovery__section">
        <h4 class="genome-code genome-discovery__label">
          {{ $t("listening_genome.discovery.cold_heading") }}
        </h4>

        <p
          v-if="data && data.in_library.length === 0"
          class="genome-discovery__empty"
        >
          {{ $t("listening_genome.discovery.no_cold") }}
        </p>
        <ul v-else-if="data" class="genome-discovery__list">
          <li
            v-for="a in data.in_library"
            :key="a.artist_key"
            class="genome-strand"
          >
            <span
              class="genome-strand__mark"
              :style="{ background: markFor(a.genre_key) }"
              aria-hidden="true"
            ></span>
            <span class="genome-strand__body">
              <span class="genome-strand__name">{{ a.artist_name }}</span>
              <span class="genome-strand__meta">
                {{
                  a.plays === 0
                    ? $t("listening_genome.discovery.never_played")
                    : $t("listening_genome.discovery.n_plays", {
                        plays: a.plays,
                      })
                }}
                <template v-if="a.genre_label">
                  · {{ a.genre_label }}
                </template>
              </span>
            </span>
          </li>
        </ul>
      </section>

      <p v-if="loadError" class="genome-discovery__empty">
        {{ $t("listening_genome.discovery.error") }}
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
/**
 * Artists worth trying next: the household's own cold corners, and Last.fm suggestions.
 *
 * The two sources deliberately never block on each other. Cold corners come straight out of
 * the library and are always there; the suggestions come from a cached background pass and
 * may legitimately be absent, pending, or unavailable (no Last.fm key). Each of those is a
 * sentence in the card rather than an empty space, because an empty space reads as breakage.
 *
 * Nothing here triggers network work on load. `genome/discovery` is a pure read (D-16); only
 * the explicit refresh button dispatches a pass, and even that returns immediately rather
 * than waiting for it.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { RefreshCw } from "@lucide/vue";
import { RouterLink } from "vue-router";
import { onMounted, ref } from "vue";
import { BASE_HUES, oklch } from "@/helpers/genome_color";
import type { DiscoveryResult } from "@/composables/genome/types";

const data = ref<DiscoveryResult | null>(null);
const loading = ref(false);
const loadError = ref(false);

/**
 * A stable colour per genre key.
 *
 * The four base hues are assigned to the four bases by rank, which is a different question
 * from "which of the palette's hues belongs to this arbitrary genre". Hashing the key gives
 * every genre a fixed slot in the same palette, so two suggestions sharing a genre share a
 * colour and the page keeps one vocabulary of colour throughout.
 */
function hueFor(key: string | null): number {
  if (!key) return 220;
  let h = 0;
  for (let i = 0; i < key.length; i++)
    h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return BASE_HUES[h % BASE_HUES.length];
}

function markFor(key: string | null): string {
  const hue = hueFor(key);
  const core = oklch(0.8, key ? 0.13 : 0.02, hue);
  const edge = oklch(0.64, key ? 0.12 : 0.02, hue);
  return (
    `radial-gradient(circle at 38% 34%, rgba(255,255,255,.5) 0%, ` +
    `rgba(255,255,255,0) 34%), ` +
    `radial-gradient(circle at 50% 50%, ${core} 0%, ${core} 38%, ${edge} 62%, ` +
    `transparent 76%)`
  );
}

function markLine(key: string | null): string {
  return oklch(0.72, key ? 0.1 : 0.02, hueFor(key));
}

async function load(): Promise<void> {
  try {
    data.value = (await api.sendCommand("genome/discovery")) as DiscoveryResult;
    loadError.value = false;
  } catch {
    loadError.value = true;
  }
}

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    await api.sendCommand("genome/discovery_refresh");
    // The pass runs in the background, so re-reading immediately is expected to return the
    // PREVIOUS result. That is correct: the card shows what is cached, and the next load
    // picks up the new pass. Pretending otherwise would mean polling a command that is
    // explicitly not allowed to block.
    await load();
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
