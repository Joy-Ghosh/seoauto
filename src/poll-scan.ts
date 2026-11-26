import type { Scan } from "./types";

/** One read at a time; disposed views never receive an old scan or error. */
export function pollScan(
  read: () => Promise<Scan>,
  receive: (scan: Scan) => void,
  fail: (error: Error) => void,
) {
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  async function next() {
    try {
      const scan = await read();
      if (!active) return;
      receive(scan);
      if (scan.status !== "running") active = false;
    } catch (error) {
      if (active)
        fail(
          error instanceof Error
            ? error
            : new Error("Could not refresh the scan."),
        );
    } finally {
      if (active) timer = setTimeout(next, 700);
    }
  }
  timer = setTimeout(next, 700);
  return () => {
    active = false;
    clearTimeout(timer);
  };
}
