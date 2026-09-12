import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { GenomeRebuildResult, GenomeResult } from "./types";

/**
 * Dev-only fixture fallback: when running `pnpm dev` with `?fixture=1` in the
 * URL, `load()` serves the static sample instead of calling the server. This
 * lets the page (and its components) be built and reviewed before the server
 * work packages land, per docs/ARCHITECTURE.md §3.10 / Part 4 WP-C. Never
 * active in a production build — `import.meta.env.DEV` is stripped at build
 * time, so the fixture JSON isn't even bundled into prod output.
 */
function useFixture(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("fixture") === "1";
  } catch {
    return false;
  }
}

async function loadFixture(): Promise<GenomeResult> {
  const mod = await import("./__fixtures__/genome_sample.json");
  return mod.default as unknown as GenomeResult;
}

export function useGenome(): {
  genome: Ref<GenomeResult | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  load: (refresh?: boolean) => Promise<void>;
  rebuild: () => Promise<void>;
} {
  const genome = ref<GenomeResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(refresh = false): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      if (useFixture()) {
        genome.value = await loadFixture();
        return;
      }
      genome.value = await api.sendCommand<GenomeResult>("genome/get", {
        listener: "household",
        refresh,
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      toast.error($t("listening_genome.load_error"));
    } finally {
      loading.value = false;
    }
  }

  async function rebuild(): Promise<void> {
    loading.value = true;
    try {
      if (useFixture()) {
        genome.value = await loadFixture();
        toast.success($t("listening_genome.rebuild_success"));
        return;
      }
      const result = await api.sendCommand<GenomeRebuildResult>(
        "genome/rebuild",
        { listener: "household" },
      );
      genome.value = result.genome;
      toast.success($t("listening_genome.rebuild_success"));
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      toast.error($t("listening_genome.rebuild_error"));
    } finally {
      loading.value = false;
    }
  }

  return { genome, loading, error, load, rebuild };
}
