import Image from "next/image";
import type { BlobStyle } from "@/race/blobStyle";
import { BLOB_SVG_HEIGHT, BLOB_SVG_WIDTH, blobSvgDataUrl } from "@/race/blobSvg";

type BlobPreviewProps = {
  style: BlobStyle;
  /** Hauteur cible en pixels (la largeur suit le ratio exact du SVG). */
  size?: number;
  /** Description accessible ; si absente ou vide, l'aperçu est décoratif (`aria-hidden`). */
  label?: string;
  className?: string;
};

/**
 * Aperçu partagé du blob de course : utilise exactement la même source SVG que la piste Pixi.
 */
export function BlobPreview({ style, size = 120, label, className }: BlobPreviewProps) {
  const width = Math.round((size * BLOB_SVG_WIDTH) / BLOB_SVG_HEIGHT);
  const decorative = !label;

  return (
    <Image
      src={blobSvgDataUrl(style)}
      alt={label ?? ""}
      aria-hidden={decorative || undefined}
      width={width}
      height={size}
      unoptimized
      className={className}
    />
  );
}
