<template>
  <Empty class="genome-panel-frame border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Dna class="size-6" />
      </EmptyMedia>
      <EmptyTitle>{{ $t("listening_genome.empty_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("listening_genome.empty_body") }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <div class="flex flex-wrap justify-center gap-2">
        <Button as-child>
          <RouterLink to="/settings/genome-import" class="no-underline">
            {{ $t("listening_genome.empty_cta") }}
          </RouterLink>
        </Button>
        <Button variant="outline" :disabled="loading" @click="$emit('rebuild')">
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
          {{ $t("listening_genome.rebuild") }}
        </Button>
      </div>
    </EmptyContent>
  </Empty>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { $t } from "@/plugins/i18n";
import { Dna, RefreshCw } from "@lucide/vue";
import { RouterLink } from "vue-router";

defineProps<{
  loading?: boolean;
}>();
defineEmits<{ rebuild: [] }>();
</script>
