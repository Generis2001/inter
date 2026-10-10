/**
 * One-time entity secret registration script.
 * Run: bun run scripts/register-entity-secret.ts
 * NEVER commit this file's output or the .env values it writes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { registerEntitySecretCiphertext, initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("ERROR: CIRCLE_API_KEY is not set in .env");
  process.exit(1);
}

// Generate a cryptographically secure 32-byte secret without printing it
const entitySecret = crypto.randomBytes(32).toString("hex");

// Ensure recovery dir exists under /home/user/app so the user can download it
const recoveryDir = "/home/user/app/.circle";
fs.mkdirSync(recoveryDir, { recursive: true });

console.log("Registering entity secret ciphertext with Circle...");
const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  recoveryFileDownloadPath: recoveryDir,
});

const recoveryPath = path.join(recoveryDir, "recovery_file.dat");
if (response.data?.recoveryFile) {
  fs.writeFileSync(recoveryPath, response.data.recoveryFile);
  console.log("Recovery file written to .circle/recovery_file.dat");
} else {
  console.log("Note: recovery file was not returned by the API — check Circle console.");
}

// Verify registration with a read call
console.log("Verifying registration...");
const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
await client.listWalletSets({ pageSize: 1 });
console.log("Verification OK.");

// Persist entity secret to .env (never print the value)
const envPath = path.join("/home/user/app", ".env");
const current = fs.readFileSync(envPath, "utf-8");
if (!current.includes("CIRCLE_ENTITY_SECRET")) {
  fs.appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, "utf-8");
  console.log("CIRCLE_ENTITY_SECRET written to .env");
} else {
  console.log("CIRCLE_ENTITY_SECRET already present in .env — skipped append.");
}

console.log("Done. Back up BOTH the CIRCLE_ENTITY_SECRET value and .circle/recovery_file.dat NOW.");
