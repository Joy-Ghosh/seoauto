import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { pollScan } from "../src/poll-scan";
import type { Scan } from "../src/types";

test("switching scans ignores a late response from the previous scan", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve!: (scan: Scan) => void;
  const received: Scan[] = [];
  const stop = pollScan(
    () =>
      new Promise<Scan>((done) => {
        resolve = done;
      }),
    (scan) => received.push(scan),
    assert.fail,
  );
  t.mock.timers.tick(700);
  stop();
  resolve({ id: "previous", status: "running" } as Scan);
  await setImmediate();
  assert.deepEqual(received, []);
});

test("slow scan reads do not overlap and a completed scan stops polling", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let resolve!: (scan: Scan) => void;
  const received: Scan[] = [];
  const stop = pollScan(
    () => {
      calls++;
      return new Promise<Scan>((done) => {
        resolve = done;
      });
    },
    (scan) => received.push(scan),
    assert.fail,
  );
  t.mock.timers.tick(700);
  t.mock.timers.tick(5000);
  assert.equal(calls, 1);
  resolve({ id: "current", status: "completed" } as Scan);
  await setImmediate();
  t.mock.timers.tick(5000);
  assert.equal(calls, 1);
  assert.equal(received[0].status, "completed");
  stop();
});

test("a disposed scan view ignores a late failure too", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let reject!: (error: Error) => void;
  const errors: Error[] = [];
  const stop = pollScan(
    () =>
      new Promise<Scan>((_, fail) => {
        reject = fail;
      }),
    () => assert.fail("Disposed scan received a response"),
    (error) => errors.push(error),
  );
  t.mock.timers.tick(700);
  stop();
  reject(new Error("old request"));
  await setImmediate();
  assert.deepEqual(errors, []);
});
