import { expect, test } from "@playwright/test";
import sharp from "sharp";
import fr from "../src/i18n/dictionaries/fr.json";
import { authFiles } from "./auth.helpers";

test.use({ storageState: authFiles.memberB });

test("le membre téléverse une photo, refuse un faux PNG et retire sa photo (AUTH-04, SEC-02)", async ({ page }) => {
  await page.goto("/fr/profile");
  const labels = fr.profile.avatar;
  const form = page.getByRole("form", { name: labels.title, exact: true });
  const file = form.getByLabel(labels.file, { exact: true });
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#30b070" } }).png().toBuffer();
  await file.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await form.getByRole("button", { name: labels.upload, exact: true }).click();
  await expect(form.getByText(labels.saved, { exact: true })).toBeVisible();
  const headerPhoto = page.getByRole("banner").locator('img[src*="/api/avatars/"]');
  await expect(headerPhoto).toBeVisible();
  await expect(headerPhoto).toHaveJSProperty("naturalWidth", 256);
  await expect(form.getByRole("img", { name: labels.preview, exact: true })).toBeVisible();
  const photoSrc = await headerPhoto.getAttribute("src");

  await file.setInputFiles({ name: "faux.png", mimeType: "image/png", buffer: Buffer.from("Ceci est du texte, pas une image PNG.") });
  await form.getByRole("button", { name: labels.upload, exact: true }).click();
  await expect(form.getByText(labels.errors.INVALID_IMAGE, { exact: true })).toBeVisible();
  await expect(headerPhoto).toHaveAttribute("src", photoSrc!);

  await form.getByRole("button", { name: labels.remove, exact: true }).click();
  await expect(form.getByText(labels.saved, { exact: true })).toBeVisible();
  await expect(form.getByRole("img", { name: labels.preview, exact: true })).toHaveCount(0);
  await expect(headerPhoto).toHaveCount(0);
  await expect(form.getByRole("button", { name: labels.remove, exact: true })).toBeDisabled();
  await page.reload();
  await expect(headerPhoto).toHaveCount(0);
  await expect(form.getByRole("button", { name: labels.remove, exact: true })).toBeDisabled();
});
