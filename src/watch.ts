export async function runWatchLoop(
  sync: () => Promise<void>,
  wait: (signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    await sync();
    if (signal.aborted) break;
    await wait(signal);
  }
}
