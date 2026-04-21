"use client";

import liff from "@line/liff";

type LiffWithReady = typeof liff & {
  ready?: Promise<unknown>;
};

export async function initLiffOrThrow(
  liffId: string,
  source = "unknown"
): Promise<void> {
  const client = liff as LiffWithReady;
  const startedAt = Date.now();

  console.log(`[liff:${source}] init start`, {
    liffId,
    href: window.location.href,
  });

  await client.init({
    liffId,
    withLoginOnExternalBrowser: true,
  });

  console.log(`[liff:${source}] init resolved`, {
    elapsedMs: Date.now() - startedAt,
  });

  if (client.ready) {
    let readyResolved = false;
    const readyTimer = window.setTimeout(() => {
      if (!readyResolved) {
        console.warn(`[liff:${source}] still waiting for ready`, {
          elapsedMs: Date.now() - startedAt,
          href: window.location.href,
        });
      }
    }, 1500);

    console.log(`[liff:${source}] awaiting ready`);

    try {
      await client.ready;
      readyResolved = true;
      console.log(`[liff:${source}] ready resolved`, {
        elapsedMs: Date.now() - startedAt,
      });
    } finally {
      window.clearTimeout(readyTimer);
    }
  } else {
    console.warn(`[liff:${source}] ready promise unavailable`);
  }
}
