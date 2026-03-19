/**
 * Single source of truth for Anthropic Claude model configuration.
 *
 * IMPORTANT: Do not use deprecated models (e.g. claude-3-5-sonnet-latest) — they return 404.
 *
 * Use current model IDs from https://docs.anthropic.com/en/docs/models-overview
 * Override via ANTHROPIC_MODEL env var if needed.
 */
export const ANTHROPIC_CONFIG = {
  /** Model for text synthesis, report chat, and fallback vision. */
  model:
    process.env.ANTHROPIC_MODEL ||
   "claude-sonnet-4-6",
} as const;
