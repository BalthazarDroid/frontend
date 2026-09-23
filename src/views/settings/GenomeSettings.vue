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
      <CardContent class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
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
          <Field class="flex-1">
            <FieldLabel for="genome-lastfm-api-key">
              {{ $t("listening_genome.settings.lastfm_api_key") }}
            </FieldLabel>
            <Input
              id="genome-lastfm-api-key"
              v-model="lastfmApiKeyInput"
              type="password"
              autocomplete="off"
              :placeholder="
                lastfmConfigured
                  ? $t(
                      'listening_genome.settings.lastfm_api_key_set_placeholder',
                    )
                  : $t('listening_genome.settings.lastfm_api_key_placeholder')
              "
            />
            <FieldDescription>
              {{ $t("listening_genome.settings.lastfm_api_key_hint") }}
              <a
                :href="lastfmApiKeySignupUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary underline underline-offset-2"
              >
                {{ $t("listening_genome.settings.lastfm_get_api_key") }}
              </a>
            </FieldDescription>
          </Field>
        </div>

        <Alert :variant="readiness.variant">
          <component :is="readiness.icon" />
          <AlertDescription>{{ readiness.message }}</AlertDescription>
        </Alert>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            :disabled="lastfmBusy || !readiness.ready"
            :title="readiness.ready ? undefined : readiness.message"
            @click="importLastfm"
          >
            <Spinner v-if="lastfmBusy" class="size-4" />
            {{ $t("listening_genome.settings.import_lastfm") }}
          </Button>
        </div>

        <FieldError v-if="lastfmError">{{ lastfmError }}</FieldError>
        <p v-if="lastfmResultSummary" class="text-sm text-muted-foreground">
          {{ lastfmResultSummary }}
        </p>
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
        <FieldError v-if="appleError">{{ appleError }}</FieldError>
        <p v-if="appleResultSummary" class="text-sm text-muted-foreground">
          {{ appleResultSummary }}
        </p>
      </CardContent>
    </Card>

    <!-- TEMPORARY. Exists so the listening history survives the move to the standalone
         Home Assistant integration; remove it once that migration is done. It lives here
         rather than only in the core config editor because this is the page anyone looking
         for their genome data actually opens. -->
    <Card>
      <CardHeader>
        <CardTitle>{{
          $t("listening_genome.settings.export_title")
        }}</CardTitle>
        <CardDescription>
          {{ $t("listening_genome.settings.export_hint") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div>
          <Button variant="outline" :disabled="exportBusy" @click="exportDb">
            <Loader2 v-if="exportBusy" class="mr-2 size-4 animate-spin" />
            {{ $t("listening_genome.settings.export_action") }}
          </Button>
        </div>
        <FieldError v-if="exportError">{{ exportError }}</FieldError>
        <p v-if="exportSummary" class="text-sm text-muted-foreground">
          {{ exportSummary }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { CircleCheck, Loader2, TriangleAlert } from "@lucide/vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { readFileAsBase64 } from "@/helpers/dspIR";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import type {
  GenomeImportResult,
  GenomeSettings,
} from "@/composables/genome/types";

// Kept in sync with docs/ARCHITECTURE.md §3.3: base64 chunk must stay under
// 512 KiB. Base64 inflates raw bytes by ~4/3, so slice the file well under
// that ceiling.
const CHUNK_RAW_BYTES = 360 * 1024;

const lastfmApiKeySignupUrl = "https://www.last.fm/api/account/create";

const lastfmUsername = ref("");
const lastfmApiKeyInput = ref("");
const lastfmConfigured = ref(false);
const lastfmBusy = ref(false);
const lastfmError = ref("");
const lastfmResultSummary = ref("");

const fileInput = ref<HTMLInputElement | null>(null);
const appleFileName = ref("");
const appleBusy = ref(false);
const appleProgress = ref(0);
const appleError = ref("");
const appleResultSummary = ref("");

// `genome/settings` deliberately never returns the stored API key (see
// GenomeController.get_settings) - only whether one is configured. So
// readiness is derived from "already configured, or about to be" rather
// than ever trying to display the key itself.
const readiness = computed(() => {
  const hasUsername = lastfmUsername.value.trim().length > 0;
  const hasApiKey =
    lastfmConfigured.value || lastfmApiKeyInput.value.length > 0;
  if (hasUsername && hasApiKey) {
    return {
      ready: true,
      variant: "info" as const,
      icon: CircleCheck,
      message: $t("listening_genome.settings.lastfm_ready"),
    };
  }
  if (!hasUsername && !hasApiKey) {
    return {
      ready: false,
      variant: "warning" as const,
      icon: TriangleAlert,
      message: $t("listening_genome.settings.lastfm_missing_both"),
    };
  }
  if (!hasUsername) {
    return {
      ready: false,
      variant: "warning" as const,
      icon: TriangleAlert,
      message: $t("listening_genome.settings.lastfm_missing_username"),
    };
  }
  return {
    ready: false,
    variant: "warning" as const,
    icon: TriangleAlert,
    message: $t("listening_genome.settings.lastfm_missing_api_key"),
  };
});

onMounted(async () => {
  try {
    const settings = await api.sendCommand<GenomeSettings>(
      "genome/settings",
      undefined,
      { suppressGlobalError: true },
    );
    lastfmUsername.value = settings.lastfm_username;
    lastfmConfigured.value = settings.lastfm_configured;
  } catch (err) {
    console.error("genome/settings failed:", err);
  }
});

function genUploadId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function summarizeImport(result: GenomeImportResult): string {
  const counts = $t("listening_genome.settings.import_result_detail", {
    imported: result.rows_imported,
    skipped: result.rows_skipped,
    duplicate: result.rows_duplicate,
  });
  // The warnings are the only part that says WHY, and they were shown as toasts alone - which
  // is a message that has already gone by the time anyone reads the counts and wonders. The
  // summary line persists, so the explanation belongs there as well.
  if (result.warnings.length === 0) return counts;
  return `${counts} ${result.warnings.join(" ")}`;
}

function reportImport(
  result: GenomeImportResult,
  summaryRef: { value: string },
): void {
  summaryRef.value = summarizeImport(result);
  if (result.rows_imported > 0) {
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
  lastfmError.value = "";
  lastfmResultSummary.value = "";
  try {
    // persist through the same genome/settings/set path the editcore/genome config page
    // uses, so the username and API key stay in sync wherever they are edited - and so a
    // key typed here survives even if the import itself then fails
    const patch: Record<string, string> = {
      lastfm_username: lastfmUsername.value.trim(),
    };
    if (lastfmApiKeyInput.value.length > 0) {
      patch.lastfm_api_key = lastfmApiKeyInput.value;
    }
    const settings = await api.sendCommand<GenomeSettings>(
      "genome/settings/set",
      { settings: patch },
      { suppressGlobalError: true },
    );
    lastfmConfigured.value = settings.lastfm_configured;
    lastfmApiKeyInput.value = "";

    const result = await api.sendCommand<GenomeImportResult>(
      "genome/import_lastfm",
      {},
      { suppressGlobalError: true },
    );
    reportImport(result, lastfmResultSummary);
  } catch (err) {
    lastfmError.value = errorMessage(err);
    toast.error(lastfmError.value);
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

interface GenomeExportResult {
  path: string;
  bytes: number;
  listens: number;
}

const exportBusy = ref(false);
const exportError = ref("");
const exportSummary = ref("");

async function exportDb(): Promise<void> {
  exportBusy.value = true;
  exportError.value = "";
  exportSummary.value = "";
  try {
    const result = await api.sendCommand<GenomeExportResult>(
      "genome/export_db",
      {},
      { suppressGlobalError: true },
    );
    // The path is the whole point of the message: a backup nobody can find is not a backup.
    exportSummary.value = $t("listening_genome.settings.export_result", {
      listens: result.listens,
      path: result.path,
    });
  } catch (err) {
    exportError.value = errorMessage(err);
    toast.error(exportError.value);
  } finally {
    exportBusy.value = false;
  }
}

async function importAppleFile(file: File): Promise<void> {
  appleBusy.value = true;
  appleFileName.value = file.name;
  appleProgress.value = 0;
  appleError.value = "";
  appleResultSummary.value = "";
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
        { suppressGlobalError: true },
      );
      appleProgress.value = Math.round(((seq + 1) / totalChunks) * 100);
    }
    if (result) reportImport(result, appleResultSummary);
  } catch (err) {
    appleError.value = errorMessage(err);
    toast.error(appleError.value);
  } finally {
    appleBusy.value = false;
  }
}
</script>
