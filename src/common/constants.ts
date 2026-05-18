
/** Paste TTL in seconds (2 minutes) */
export const PASTE_TTL = 120;

/** Tracking key TTL in seconds (5 minutes, for 410 detection) */
export const SEEN_TTL = 300;

/** Max storage size per entry in bytes (16 KB) — covers worst-case Lexical delta + HTML wrapper for 5,000 plain-text chars */
export const MAX_CONTENT_BYTES = 16384;

/** Max plain text character count */
export const MAX_CHARS = 5000;
