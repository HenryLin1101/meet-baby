import { createQStashClient, getDriveScanCallbackUrl } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron: every hour on the hour
const DRIVE_SCAN_CRON = "0 * * * *";
const SCHEDULE_HEADER = "x-admin-secret";

function getAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) throw new Error("ADMIN_SECRET 尚未設定。");
  return secret;
}

function isAuthorized(request: Request): boolean {
  try {
    return request.headers.get(SCHEDULE_HEADER) === getAdminSecret();
  } catch {
    return false;
  }
}

// GET: list existing drive-scan schedules
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createQStashClient();
  const schedules = await client.schedules.list();
  const driveScanUrl = getDriveScanCallbackUrl();
  const driveScanSchedules = schedules.filter((s) =>
    s.destination === driveScanUrl
  );

  return Response.json({ schedules: driveScanSchedules, url: driveScanUrl });
}

// POST: register drive-scan cron (idempotent — skips if already exists)
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createQStashClient();
  const driveScanUrl = getDriveScanCallbackUrl();

  const existing = await client.schedules.list();
  const already = existing.find((s) => s.destination === driveScanUrl);
  if (already) {
    return Response.json({ ok: true, skipped: true, scheduleId: already.scheduleId });
  }

  const result = await client.schedules.create({
    destination: driveScanUrl,
    cron: DRIVE_SCAN_CRON,
  });

  return Response.json({ ok: true, skipped: false, scheduleId: result.scheduleId });
}

// DELETE: remove all drive-scan cron schedules
export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createQStashClient();
  const driveScanUrl = getDriveScanCallbackUrl();
  const schedules = await client.schedules.list();
  const targets = schedules.filter((s) => s.destination === driveScanUrl);

  for (const s of targets) {
    await client.schedules.delete(s.scheduleId);
  }

  return Response.json({ ok: true, deleted: targets.length });
}
