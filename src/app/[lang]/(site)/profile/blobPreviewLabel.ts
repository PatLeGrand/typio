import type { Dictionary } from "@/i18n/dictionaries";
import type { BlobStyle } from "@/race/blobStyle";

export function formatBlobPreviewLabel(
  template: string,
  style: BlobStyle,
  labels: Dictionary["profile"]["blob"],
): string {
  return template
    .replace("{color}", labels.colors[style.color])
    .replace("{expression}", labels.expressions[style.expression])
    .replace("{glasses}", labels.glasses[style.glasses])
    .replace("{hat}", labels.hats[style.hat])
    .replace("{accessory}", labels.accessories[style.accessory]);
}

export function formatBlobStyleSummary(
  style: BlobStyle,
  labels: Dictionary["profile"]["blob"],
): string {
  const parts = [labels.colors[style.color], labels.expressions[style.expression]];
  if (style.glasses !== "none") parts.push(labels.glasses[style.glasses]);
  if (style.hat !== "none") parts.push(labels.hats[style.hat]);
  if (style.accessory !== "none") parts.push(labels.accessories[style.accessory]);
  return parts.join(" · ");
}
