import sharp from "sharp";
import { MAX_AVATAR_BYTES, type AvatarImageError } from "./avatar";

/** Aucun nom de fichier ni MIME annoncé : le contenu seul fait autorité (SEC-02). */
export async function processAvatarImage(input: Buffer): Promise<
  { ok: true; image: Buffer } | { ok: false; code: AvatarImageError }
> {
  if (input.byteLength > MAX_AVATAR_BYTES) return { ok: false, code: "TOO_LARGE" };
  try {
    const image = sharp(input, { limitInputPixels: 25_000_000, pages: 1, page: 0 });
    const { format } = await image.metadata();
    if (format !== "jpeg" && format !== "png" && format !== "webp") {
      return { ok: false, code: "UNSUPPORTED_TYPE" };
    }
    // Sans keepMetadata/withMetadata, sharp retire EXIF, GPS, ICC, XMP et IPTC.
    return { ok: true, image: await image.rotate().resize(256, 256, { fit: "cover" }).webp().toBuffer() };
  } catch {
    return { ok: false, code: "INVALID_IMAGE" };
  }
}
