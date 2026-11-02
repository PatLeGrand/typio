export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarImageError = "TOO_LARGE" | "UNSUPPORTED_TYPE" | "INVALID_IMAGE";
export type AvatarErrorCode = AvatarImageError | "UNAUTHORIZED" | "RATE_LIMITED" | "UNKNOWN";
export type AvatarResult = { ok: true; version: number | null } | { ok: false; code: AvatarErrorCode };
