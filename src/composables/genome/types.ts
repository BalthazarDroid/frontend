/**
 * TypeScript mirror of the Python TypedDicts in
 * `music_assistant/controllers/genome/models.py` (see docs/ARCHITECTURE.md §3.4).
 *
 * This is a frozen wire contract shared with the server WPs — field names and
 * shapes must match 1:1. Do not rename fields to camelCase here; the JSON
 * comes over the wire exactly as declared server-side.
 */

export interface GenreShare {
  key: string;
  label: string;
  share: number;
  baseline_share: number;
  ratio: number;
  contribution: number;
  // Affinity to each `GenomeResult.bases` entry, same length/order as `bases`,
  // summing to 1.0 - or [] when it can't be honestly computed (common before
  // enrichment finishes) or on a base genre's own row (a base's affinity to
  // itself isn't a figure the DNA visual needs). Never a fabricated 1/n split.
  /** Absent on a payload from an older result schema; [] when not computable. */
  base_mix?: number[];
}

export interface ArtistFact {
  name: string;
  artist_key: string;
  mbid: string | null;
  plays: number;
  weight: number;
  share: number;
  lb_listeners: number | null;
  obscurity: number | null;
  ratio_vs_average: number | null;
  genres: string[];
}

export interface TrackFact {
  name: string;
  artist: string;
  track_key: string;
  plays: number;
  weight: number;
  share: number;
  year: number | null;
}

export interface EraBucket {
  decade: number;
  share: number;
  baseline_share: number;
}

export interface RhythmCell {
  weekday: number; // 0 = Monday .. 6 = Sunday
  hour: number; // 0..23
  weight: number;
  share: number;
}

export interface PlayerSplit {
  player_id: string;
  name: string;
  share: number;
}

export interface GenomeStats {
  total_listens: number;
  weighted_listens: number;
  distinct_artists: number;
  distinct_tracks: number;
  first_listen: number | null;
  last_listen: number | null;
  coverage_by_source: Record<string, number>;
  enrichment_coverage: number;
  // Artist genre resolution runs in a paced background pass against MusicBrainz, so a fresh
  // import shows a genre breakdown (and therefore a divergence score) that is still firming
  // up. Surfaced so the page can say so rather than presenting a provisional score as final.
  artists_pending: number;
  artists_resolved: number;
}

export interface DivergenceFacts {
  score: number;
  percent: number;
  top_over: GenreShare[];
  top_under: GenreShare[];
}

export interface ObscurityFacts {
  index: number;
  percentile: number;
  threshold_listeners: number;
  known_share: number;
}

export interface EraFacts {
  center_of_mass: number;
  spread: number;
  buckets: EraBucket[];
  known_share: number;
}

export interface LoyaltyFacts {
  exploration_ratio: number;
  concentration: number;
  top_artist_share: number;
  new_artists_90d: number;
  repeat_rate: number;
}

export interface GenomeResult {
  schema_version: number;
  engine_version: string;
  baseline_version: string;
  listener: string;
  generated_at: number;
  stale: boolean;
  half_life_days: number;
  stats: GenomeStats;
  genres: GenreShare[];
  // Top 4 entries of `genres` by share, in order - 0-4 entries, never padded.
  // The DNA visual's four "bases"; see docs/ARCHITECTURE.md §3.4 "Four bases".
  bases: GenreShare[];
  divergence: DivergenceFacts;
  obscurity: ObscurityFacts;
  era: EraFacts;
  loyalty: LoyaltyFacts;
  top_artists: ArtistFact[];
  top_tracks: TrackFact[];
  rhythm: RhythmCell[];
  players: PlayerSplit[];
}

export interface GenomeRebuildResult {
  listener: string;
  listens_scanned: number;
  duration_ms: number;
  genome: GenomeResult;
}

export interface GenomeImportResult {
  source: string;
  rows_read: number;
  rows_imported: number;
  rows_skipped: number;
  rows_duplicate: number;
  first_played_at: number | null;
  last_played_at: number | null;
  warnings: string[];
}

export interface GenomeSettings {
  half_life_days: number;
  lastfm_username: string;
  lastfm_configured: boolean;
  lastfm_poll_enabled: boolean;
  enrich_enabled: boolean;
  obscurity_percentile: number;
  min_seconds_played: number;
  apple_import_dir: string;
  baseline_version: string;
  last_rebuild_at: number | null;
}

export interface GenomeSettingsPatch {
  half_life_days?: number;
  lastfm_username?: string;
  lastfm_api_key?: string;
  lastfm_poll_enabled?: boolean;
  enrich_enabled?: boolean;
  obscurity_percentile?: number;
  min_seconds_played?: number;
  apple_import_dir?: string;
}
