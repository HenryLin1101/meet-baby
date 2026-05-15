import { createSign } from "crypto";

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

function base64urlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function getServiceAccountKey(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set.");
  const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!parsed.client_email)
    throw new Error("Service account JSON missing client_email.");
  if (!parsed.private_key)
    throw new Error("Service account JSON missing private_key.");
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function buildJwt(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );
  const payload = base64urlEncode(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = base64urlEncode(sign.sign(key.private_key));
  return `${signingInput}.${signature}`;
}

export async function getServiceAccountAccessToken(): Promise<string> {
  const key = getServiceAccountKey();
  const jwt = buildJwt(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      `Service Account token error: ${json.error ?? response.status}`
    );
  }
  const token = json.access_token?.trim();
  if (!token)
    throw new Error("Service Account token response missing access_token.");
  return token;
}
