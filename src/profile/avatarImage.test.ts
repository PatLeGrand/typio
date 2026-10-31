// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_AVATAR_BYTES } from "./avatar";
import { processAvatarImage } from "./avatarImage";

function image() {
  return sharp({ create: { width: 320, height: 180, channels: 3, background: "red" } });
}

describe("processAvatarImage", () => {
  it.each(["png", "jpeg", "webp"] as const)("normalise un vrai %s en WebP carré 256×256", async (format) => {
    const result = await processAvatarImage(await image().toFormat(format).toBuffer());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await sharp(result.image).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 });
  });

  it("refuse plus de 2 Mo avant tout décodage, même pour un contenu illisible", async () => {
    await expect(processAvatarImage(Buffer.alloc(MAX_AVATAR_BYTES + 1))).resolves.toEqual({ ok: false, code: "TOO_LARGE" });
  });

  it("refuse le contenu GIF", async () => {
    await expect(processAvatarImage(await image().gif().toBuffer())).resolves.toEqual({ ok: false, code: "UNSUPPORTED_TYPE" });
  });

  it("refuse du texte, même annoncé comme PNG", async () => {
    const file = new File(["not an image"], "photo.png", { type: "image/png" });
    await expect(processAvatarImage(Buffer.from(await file.arrayBuffer()))).resolves.toEqual({ ok: false, code: "INVALID_IMAGE" });
  });

  it("retire EXIF, orientation, ICC et XMP", async () => {
    const input = await image().withMetadata({ orientation: 6 }).withExif({ IFD0: { Artist: "Private" } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">Private</x:xmpmeta>').jpeg().toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processAvatarImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const metadata = await sharp(result.image).metadata();
    for (const key of ["exif", "orientation", "icc", "xmp", "iptc"] as const) expect(metadata[key]).toBeUndefined();
  });

  it("applique l'orientation EXIF avant le recadrage", async () => {
    const input = await sharp({ create: { width: 256, height: 256, channels: 3, background: "red" } })
      .composite([{ input: await sharp({ create: { width: 128, height: 256, channels: 3, background: "blue" } }).png().toBuffer(), left: 128, top: 0 }])
      .withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await processAvatarImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data, info } = await sharp(result.image).raw().toBuffer({ resolveWithObject: true });
    const top = (20 * info.width + 128) * info.channels;
    const bottom = (235 * info.width + 128) * info.channels;
    expect(data[top]).toBeGreaterThan(data[top + 2]);
    expect(data[bottom + 2]).toBeGreaterThan(data[bottom]);
  });

  it("ne conserve que la première image d'un WebP animé", async () => {
    const red = Buffer.from([255, 0, 0, 255, 0, 0]);
    const blue = Buffer.from([0, 0, 255, 0, 0, 255]);
    const input = await sharp(Buffer.concat([red, blue]), { raw: { width: 2, height: 2, channels: 3, pageHeight: 1 } })
      .webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(input).metadata()).pages).toBe(2);
    const result = await processAvatarImage(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await sharp(result.image).metadata()).pages ?? 1).toBe(1);
    const { channels } = await sharp(result.image).stats();
    expect(channels[0].mean).toBeGreaterThan(240);
    expect(channels[2].mean).toBeLessThan(15);
  });

  it("refuse une image compressée de plus de 25 Mpx", async () => {
    const input = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
    expect(input.byteLength).toBeLessThan(MAX_AVATAR_BYTES);
    await expect(processAvatarImage(input)).resolves.toEqual({ ok: false, code: "INVALID_IMAGE" });
  });
});
