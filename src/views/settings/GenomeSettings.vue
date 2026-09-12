<template>
  <div class="space-y-6 p-6">
    <Card>
      <CardHeader>
        <CardTitle>{{
          $t("listening_genome.settings.import_lastfm")
        }}</CardTitle>
        <CardDescription>
          {{ $t("listening_genome.settings.import_lastfm_hint") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field class="flex-1">
          <FieldLabel for="genome-lastfm-username">
            {{ $t("listening_genome.settings.lastfm_username") }}
          </FieldLabel>
          <Input
            id="genome-lastfm-username"
            v-model="lastfmUsername"
            :placeholder="$t('listening_genome.settings.lastfm_username')"
          />
        </Field>
        <Button :disabled="lastfmBusy || !lastfmUsername" @click="importLastfm">
          <Spinner v-if="lastfmBusy" class="size-4" />
          {{ $t("listening_genome.settings.import_lastfm") }}
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>{{
          $t("listening_genome.settings.import_apple")
        }}</CardTitle>
        <CardDescription>
          {{ $t("listening_genome.settings.import_apple_hint") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <input
          ref="fileInput"
          type="file"
          accept=".csv"
          class="hidden"
          @change="onFilePicked"
        />
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            :disabled="appleBusy"
            @click="fileInput?.click()"
          >
            {{ $t("listening_genome.settings.choose_file") }}
          </Button>
          <span class="text-sm text-muted-foreground">
            {{
              appleFileName || $t("listening_genome.settings.no_file_chosen")
            }}
          </span>
        </div>
        <Progress v-if="appleBusy" :model-value="appleProgress" />
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { readFileAsBase64 } from "@/helpers/dspIR";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";
import type { GenomeImportResult } from "@/composables/genome/types";

// Kept in sync with docs/ARCHITECTURE.md §3.3: base64 chunk must stay under
// 512 KiB. Base64 inflates raw bytes by ~4/3, so slice the file well under
// that ceiling.
const CHUNK_RAW_BYTES = 360 * 1024;

const lastfmUsername = ref("");
const lastfmBusy = ref(false);

const fileInput = ref<HTMLInputElement | null>(null);
const appleFileName = ref("");
const appleBusy = ref(false);
const appleProgress = ref(0);

function genUploadId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function reportImport(result: GenomeImportResult): void {
  if (result.rows_imported > 0 || result.rows_read > 0) {
    toast.success(
      $t("listening_genome.settings.import_success", {
        count: result.rows_imported,
      }),
    );
  }
  for (const warning of result.warnings) {
    toast.error(warning);
  }
}

async function importLastfm(): Promise<void> {
  lastfmBusy.value = true;
  try {
    const result = await api.sendCommand<GenomeImportResult>(
      "genome/import_lastfm",
      { username: lastfmUsername.value },
    );
    reportImport(result);
  } catch (err) {
    toast.error($t("listening_genome.settings.import_error"));
    console.error("genome/import_lastfm failed:", err);
  } finally {
    lastfmBusy.value = false;
  }
}

async function onFilePicked(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  await importAppleFile(file);
}

async function importAppleFile(file: File): Promise<void> {
  appleBusy.value = true;
  appleFileName.value = file.name;
  appleProgress.value = 0;
  const uploadId = genUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_RAW_BYTES));
  try {
    let result: GenomeImportResult | null = null;
    for (let seq = 0; seq < totalChunks; seq++) {
      const start = seq * CHUNK_RAW_BYTES;
      const end = Math.min(start + CHUNK_RAW_BYTES, file.size);
      const chunk = file.slice(start, end);
      const chunkB64 = await readFileAsBase64(chunk as unknown as File);
      const final = seq === totalChunks - 1;
      result = await api.sendCommand<GenomeImportResult>(
        "genome/import_apple",
        {
          upload_id: uploadId,
          seq,
          chunk_b64: chunkB64,
          final,
          filename: file.name,
        },
      );
      appleProgress.value = Math.round(((seq + 1) / totalChunks) * 100);
    }
    if (result) reportImport(result);
  } catch (err) {
    toast.error($t("listening_genome.settings.import_error"));
    console.error("genome/import_apple failed:", err);
  } finally {
    appleBusy.value = false;
  }
}
</script>
