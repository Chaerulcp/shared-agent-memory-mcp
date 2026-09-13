import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("doctor reports token presence without revealing token bytes", async () => {
  const token = "secret_DOCTOR_OUTPUT_SENTINEL_123456789";
  const child = spawn(process.execPath, ["dist/cli.js", "doctor"], {
    cwd: process.cwd(),
    env: { ...process.env, NOTION_TOKEN: token, NOTION_DATABASE_ID: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const firstLine = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("doctor did not print token status"));
    }, 5000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const line = output.match(/^NOTION_TOKEN\s*:\s*(.*)$/m);
      if (!line) return;
      clearTimeout(timeout);
      child.kill();
      resolve(line[1].trim());
    });
  });

  assert.equal(firstLine, "OK");
});
