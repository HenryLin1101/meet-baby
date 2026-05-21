"use client";

import liff from "@line/liff";

type LiffWithReady = typeof liff & {
  ready?: Promise<unknown>;
};

const LIFF_INIT_TIMEOUT_MS = 8000;
const LIFF_READY_TIMEOUT_MS = 8000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          `${label} 等待超過 ${ms}ms 未回應，可能是 LIFF SDK 卡住或 LINE 登入流程中斷。`
        )
      );
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

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

  await withTimeout(
    client.init({ liffId, withLoginOnExternalBrowser: true }),
    LIFF_INIT_TIMEOUT_MS,
    `[liff:${source}] init`
  );

  console.log(`[liff:${source}] init resolved`, {
    elapsedMs: Date.now() - startedAt,
  });

  if (client.ready) {
    console.log(`[liff:${source}] awaiting ready`);
    await withTimeout(
      client.ready as Promise<unknown>,
      LIFF_READY_TIMEOUT_MS,
      `[liff:${source}] ready`
    );
    console.log(`[liff:${source}] ready resolved`, {
      elapsedMs: Date.now() - startedAt,
    });
  } else {
    console.warn(`[liff:${source}] ready promise unavailable`);
  }
}
