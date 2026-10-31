import { test as setup } from "@playwright/test";
import { authFiles, createCredentials, registerMember } from "./auth.helpers";

for (const [member, path] of Object.entries(authFiles)) {
  setup(`inscrire ${member}`, async ({ page }) => {
    await registerMember(page, createCredentials());
    await page.context().storageState({ path });
  });
}
