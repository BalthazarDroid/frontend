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

        <template v-if="lastfmBusy">
          <Progress
            :model-value="lastfmJob?.progress ?? null"
            :class="
              lastfmJob?.progress == null
                ? 'genome-progress-indeterminate'
                : undefined
            "
          />
          <p class="text-sm text-muted-foreground">
            {{
              lastfmJob?.message ||
              $t("listening_genome.settings.job_running_lastfm")
            }}
          </p>
        </template>
        <template v-else>
          <FieldError v-if="lastfmError">{{ lastfmError }}</FieldError>
          <FieldError v-else-if="lastfmJob?.state === 'error'">
            {{ jobOutcomeText(lastfmJob) }}
          </FieldError>
          <p
            v-else-if="jobOutcomeText(lastfmJob)"
            class="text-sm text-muted-foreground"
          >
            {{ jobOutcomeText(lastfmJob) }}
          </p>
        </template>
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
        <!-- Two phases with two honest progress sources: the browser knows exactly how
             much of the file it has uploaded, and after the last chunk only the server
             knows how the ingest is going - which is usually "no idea how far", hence the
             indeterminate bar rather than one frozen at 0%. -->
        <template v-if="appleUploading">
          <Progress :model-value="appleProgress" />
          <p class="text-sm text-muted-foreground">
            {{
              $t("listening_genome.settings.job_uploading", {
                percent: appleProgress,
              })
            }}
          </p>
        </template>
        <template v-else-if="appleBusy">
          <Progress
            :model-value="appleJob?.progress ?? null"
            :class="
              appleJob?.progress == null
                ? 'genome-progress-indeterminate'
                : undefined
            "
          />
          <p class="text-sm text-muted-foreground">
            {{
              appleJob?.message ||
              $t("listening_genome.settings.job_running_apple")
            }}
          </p>
        </template>
        <template v-else>
          <FieldError v-if="appleError">{{ appleError }}</FieldError>
          <FieldError
            v-else-if="!appleResultSummary && appleJob?.state === 'error'"
          >
            {{ jobOutcomeText(appleJob) }}
          </FieldError>
          <p
            v-else-if="appleResultSummary"
            class="text-sm text-muted-foreground"
          >
            {{ appleResultSummary }}
          </p>
          <p
            v-else-if="jobOutcomeText(appleJob)"
            class="text-sm text-muted-foreground"
          >
            {{ jobOutcomeText(appleJob) }}
          </p>
        </template>
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
        <template v-if="exportBusy">
          <Progress
            :model-value="exportJob?.progress ?? null"
            :class="
              exportJob?.progress == null
                ? 'genome-progress-indeterminate'
                : undefined
            "
          />
          <p class="text-sm text-muted-foreground">
            {{
              exportJob?.message ||
              $t("listening_genome.settings.job_running_export")
            }}
          </p>
        </template>
        <template v-else>
          <FieldError v-if="exportError">{{ exportError }}</FieldError>
          <FieldError v-else-if="exportJob?.state === 'error'">
            {{ jobOutcomeText(exportJob) }}
          </FieldError>
          <p
            v-else-if="jobOutcomeText(exportJob)"
            class="text-sm text-muted-foreground"
          >
            {{ jobOutcomeText(exportJob) }}
          </p>
        </template>
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import { toast } from "vue-sonner";
import type {
  GenomeImportResult,
  GenomeJob,
  GenomeJobName,
  GenomeJobs,
  GenomeSettings,
} from "@/composables/genome/types";

// Kept in sync with docs/ARCHITECTURE.md §3.3: base64 chunk must stay under
// 512 KiB. Base64 inflates raw bytes by ~4/3, so slice the file well under
// that ceiling.
const CHUNK_RAW_BYTES = 360 * 1024;

// Two seconds is slow enough to be invisible on the websocket and fast enough that a
// job finishing does not look like the page has stopped caring.
const JOB_POLL_INTERVAL_MS = 2000;
// Only redraws "4 minutes ago"; nothing is fetched on this tick.
const CLOCK_INTERVAL_MS = 30_000;

const lastfmApiKeySignupUrl = "https://www.last.fm/api/account/create";

const lastfmUsername = ref("");
const lastfmApiKeyInput = ref("");
const lastfmConfigured = ref(false);
const lastfmError = ref("");

const fileInput = ref<HTMLInputElement | null>(null);
const appleFileName = ref("");
const appleUploading = ref(false);
const appleIngesting = ref(false);
const appleProgress = ref(0);
const appleError = ref("");
const appleResultSummary = ref("");

const exportError = ref("");

// Server-owned job state. This is the whole reason the page can be closed and reopened:
// everything worth showing about a running or finished job lives on the server, so a
// remount re-reads it instead of starting from a blank slate.
const jobs = ref<GenomeJobs | null>(null);
// Bridges the gap between clicking a button and the first poll coming back, so the
// button does not flicker back to enabled for a couple of seconds.
const dispatching = ref<Record<GenomeJobName, boolean>>({
  lastfm_import: false,
  apple_import: false,
  export_db: false,
});
const nowSeconds = ref(Math.floor(Date.now() / 1000));

let pollTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const lastfmJob = computed(() => jobs.value?.lastfm_import ?? null);
const appleJob = computed(() => jobs.value?.apple_import ?? null);
const exportJob = computed(() => jobs.value?.export_db ?? null);

function isBusy(job: GenomeJob | null, name: GenomeJobName): boolean {
  return dispatching.value[name] || job?.state === "running";
}

const lastfmBusy = computed(() => isBusy(lastfmJob.value, "lastfm_import"));
const exportBusy = computed(() => isBusy(exportJob.value, "export_db"));
// The upload half is entirely client-side, so it counts as busy even before the server
// has a job to report.
const appleBusy = computed(
  () =>
    appleUploading.value ||
    appleIngesting.value ||
    isBusy(appleJob.value, "apple_import"),
);

const anyJobRunning = computed(() => {
  const current = jobs.value;
  if (!current) return false;
  return Object.values(current).some((job) => job.state === "running");
});

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

/**
 * "4 minutes ago" without pulling in a date library for one line of text.
 * Rounded rather than truncated, because "59 seconds ago" reading as "just now"
 * is fine but "119 seconds ago" reading as "1 minute ago" is not.
 */
function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "";
  const seconds = Math.max(0, nowSeconds.value - timestamp);
  if (seconds < 45) return $t("listening_genome.settings.time_just_now");
  const minutes = Math.round(seconds / 60);
  if (minutes <= 1) return $t("listening_genome.settings.time_minute_ago");
  if (minutes < 60) {
    return $t("listening_genome.settings.time_minutes_ago", { count: minutes });
  }
  const hours = Math.round(minutes / 60);
  if (hours <= 1) return $t("listening_genome.settings.time_hour_ago");
  if (hours < 24) {
    return $t("listening_genome.settings.time_hours_ago", { count: hours });
  }
  const days = Math.round(hours / 24);
  if (days <= 1) return $t("listening_genome.settings.time_day_ago");
  return $t("listening_genome.settings.time_days_ago", { count: days });
}

/** The server's own wording, plus when it happened. Never reworded here. */
function jobOutcomeText(job: GenomeJob | null): string {
  if (!job || !job.message || job.state === "running") return "";
  const when = relativeTime(job.finished_at);
  if (!when) return job.message;
  return $t("listening_genome.settings.job_result_when", {
    message: job.message,
    when,
  });
}

function stopPolling(): void {
  if (pollTimer === null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function startPolling(): void {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => {
    void refreshJobs();
  }, JOB_POLL_INTERVAL_MS);
}

async function refreshJobs(): Promise<void> {
  try {
    jobs.value = await api.sendCommand<GenomeJobs>("genome/jobs", undefined, {
      suppressGlobalError: true,
    });
  } catch (err) {
    console.error("genome/jobs failed:", err);
    return;
  }
  nowSeconds.value = Math.floor(Date.now() / 1000);
  // The Apple upload is client-side work the server cannot see, so keep polling
  // through it - otherwise the ingest that follows would never be picked up.
  if (anyJobRunning.value || appleUploading.value || appleIngesting.value) {
    startPolling();
  } else {
    stopPolling();
  }
}

function applyJob(name: GenomeJobName, job: GenomeJob): void {
  if (jobs.value) jobs.value[name] = job;
  startPolling();
}

onMounted(async () => {
  clockTimer = setInterval(() => {
    nowSeconds.value = Math.floor(Date.now() / 1000);
  }, CLOCK_INTERVAL_MS);
  void refreshJobs();
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

onUnmounted(() => {
  // A leaked poll would keep firing websocket commands for the life of the session.
  stopPolling();
  if (clockTimer !== null) {
    clearInterval(clockTimer);
    clockTimer = null;
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
  dispatching.value.lastfm_import = true;
  lastfmError.value = "";
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

    // Dispatch only: the import runs on the server and reports through genome/jobs, so
    // there is no result to wait for here and nothing to lose by navigating away.
    const job = await api.sendCommand<GenomeJob>(
      "genome/import_lastfm",
      {},
      { suppressGlobalError: true },
    );
    applyJob("lastfm_import", job);
  } catch (err) {
    lastfmError.value = errorMessage(err);
    toast.error(lastfmError.value);
  } finally {
    dispatching.value.lastfm_import = false;
  }
}

async function onFilePicked(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  await importAppleFile(file);
}

async function exportDb(): Promise<void> {
  dispatching.value.export_db = true;
  exportError.value = "";
  try {
    // Same story as the Last.fm import: this returns the started job, not a result.
    const job = await api.sendCommand<GenomeJob>(
      "genome/export_db",
      {},
      { suppressGlobalError: true },
    );
    applyJob("export_db", job);
  } catch (err) {
    exportError.value = errorMessage(err);
    toast.error(exportError.value);
  } finally {
    dispatching.value.export_db = false;
  }
}

async function importAppleFile(file: File): Promise<void> {
  appleUploading.value = true;
  appleIngesting.value = false;
  appleFileName.value = file.name;
  appleProgress.value = 0;
  appleError.value = "";
  appleResultSummary.value = "";
  const uploadId = genUploadId();
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_RAW_BYTES));
  startPolling();
  try {
    let result: GenomeImportResult | null = null;
    for (let seq = 0; seq < totalChunks; seq++) {
      const start = seq * CHUNK_RAW_BYTES;
      const end = Math.min(start + CHUNK_RAW_BYTES, file.size);
      const chunk = file.slice(start, end);
      const chunkB64 = await readFileAsBase64(chunk as unknown as File);
      const final = seq === totalChunks - 1;
      if (final) {
        // The last chunk is the one that triggers the ingest, so the upload bar has
        // told its whole truth by now - hand the card over to the job's own state.
        appleUploading.value = false;
        appleIngesting.value = true;
      }
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
    appleUploading.value = false;
    appleIngesting.value = false;
    void refreshJobs();
  }
}
</script>

<style scoped>
/*
 * Indeterminate progress. The shared Progress component parks its indicator at
 * translateX(-100%) when modelValue is null, which renders as an empty bar and reads
 * as "stuck" rather than "working" - and null is the normal case here, because the
 * server usually has no total to count against. A keyframed transform outranks the
 * component's inline style, so this needs no change to the component itself.
 */
.genome-progress-indeterminate :deep([data-slot="progress-indicator"]) {
  flex: none;
  width: 40%;
  animation: genome-progress-indeterminate 1.4s ease-in-out infinite;
}

@keyframes genome-progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .genome-progress-indeterminate :deep([data-slot="progress-indicator"]) {
    animation: none;
    width: 100%;
    transform: translateX(0);
    opacity: 0.5;
  }
}
</style>
