import type { Dictionary } from "@/i18n/dictionaries";
import type { BlobStyle } from "@/race/blobStyle";

export function formatBlobPreviewLabel(
  template: string,
  style: BlobStyle,
  labels: Dictionary["profile"]["blob"],
): string {
  return template
    .replace("{color}", labels.colors[style.color])
    .replace("{glasses}", labels.glasses[style.glasses])
    .replace("{hat}", labels.hats[style.hat]);
}
