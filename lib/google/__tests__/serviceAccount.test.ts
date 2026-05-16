import { describe, expect, it, afterEach, vi } from "vitest";

describe("getServiceAccountKey", () => {
  const ORIGINAL_ENV = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = ORIGINAL_ENV;
    }
    // reset module cache so each test gets a fresh import
    vi.resetModules();
  });

  it("throws when env var is not set", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const { getServiceAccountAccessToken } = await import(
      "@/lib/google/serviceAccount"
    );
    await expect(getServiceAccountAccessToken()).rejects.toThrow(
      "GOOGLE_SERVICE_ACCOUNT_JSON"
    );
  });

  it("throws when JSON is missing client_email", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });
    const { getServiceAccountAccessToken } = await import(
      "@/lib/google/serviceAccount"
    );
    await expect(getServiceAccountAccessToken()).rejects.toThrow(
      "client_email"
    );
  });

  it("throws when JSON is missing private_key", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "bot@project.iam.gserviceaccount.com",
    });
    const { getServiceAccountAccessToken } = await import(
      "@/lib/google/serviceAccount"
    );
    await expect(getServiceAccountAccessToken()).rejects.toThrow(
      "private_key"
    );
  });
});
