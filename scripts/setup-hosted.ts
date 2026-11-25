import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../server/hosted-auth.ts";
const root = process.cwd(),
  env = path.join(root, ".env.local");
try {
  await access(env);
  throw new Error("An .env.local already exists. It was not changed.");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const password = randomBytes(24).toString("base64url"),
  secret = randomBytes(32).toString("base64url");
await writeFile(
  env,
  `APP_SECRET=${secret}\nAPP_PASSWORD_HASH=${hashPassword(password)}\nHOSTED_MODE=1\nPORT=4318\n`,
  { mode: 0o600 },
);
await writeFile(
  path.join(root, "..", "seo-workbench-access.txt"),
  `SEO Workbench private owner access\n\nWorkspace password: ${password}\n\nKeep this file private. Do not put it in GitHub or share it with visitors.\nThe NVIDIA key is entered separately in AI Studio.\n`,
  { mode: 0o600 },
);
console.log(
  "Owner access created. Server settings are in .env.local (gitignored). The private password is in ../seo-workbench-access.txt. No values were printed.",
);
