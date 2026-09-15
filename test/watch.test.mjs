import test from "node:test";
import assert from "node:assert/strict";
import { runWatchLoop } from "../dist/watch.js";

test("watch waits for a sync to finish before scheduling the next one", async () => {
  const controller = new AbortController();
  let finishFirst;
  const first = new Promise((resolve) => { finishFirst = resolve; });
  let startedFirst;
  const firstStarted = new Promise((resolve) => { startedFirst = resolve; });
  let finishWait;
  const waitGate = new Promise((resolve) => { finishWait = resolve; });
  let calls = 0;
  let waits = 0;
  const loop = runWatchLoop(async () => {
    calls++;
    if (calls === 1) {
      startedFirst();
      await first;
    } else {
      controller.abort();
    }
  }, async () => {
    waits++;
    await waitGate;
  }, controller.signal);

  await firstStarted;
  assert.equal(calls, 1);
  assert.equal(waits, 0);
  finishFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(waits, 1);
  finishWait();
  await loop;
  assert.equal(calls, 2);
});

test("watch finishes the current sync before stopping", async () => {
  const controller = new AbortController();
  let finishSync;
  const syncGate = new Promise((resolve) => { finishSync = resolve; });
  let started;
  const syncStarted = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  let waits = 0;
  const loop = runWatchLoop(async () => {
    calls++;
    started();
    await syncGate;
  }, async () => { waits++; }, controller.signal);
  await syncStarted;
  controller.abort();
  finishSync();
  await loop;
  assert.equal(calls, 1);
  assert.equal(waits, 0);
});
