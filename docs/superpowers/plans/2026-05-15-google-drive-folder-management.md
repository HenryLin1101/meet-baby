# Google Drive 資料夾管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 當米特寶寶加入 LINE 群組時自動建立 Google Drive 群組資料夾；每次建立會議時在母資料夾底下建立子資料夾，並把連結回傳到 LINE 群組。

**Architecture:** Service Account JWT 認證（無 user 授權）；Drive API raw fetch（仿 `lib/google/drive.ts`）。建資料夾同步執行於 `join` webhook handler（母資料夾）與 `app/api/events` POST handler（子資料夾）。失敗不阻斷主流程。

**Tech Stack:** Node.js built-in `crypto` (RS256 JWT)、Google Drive API v3 REST、Supabase PostgreSQL、Vitest

---

## File Map

| 動作 | 路徑 |
|---|---|
| 新增 | `supabase/migrations/20260515_drive_folder_columns.sql` |
| 修改 | `db/schema.sql` |
| 修改 | `lib/db/repository.ts` |
| 新增 | `lib/google/serviceAccount.ts` |
| 新增 | `lib/google/driveAdmin.ts` |
| 新增 | `lib/google/__tests__/serviceAccount.test.ts` |
| 新增 | `lib/google/__tests__/driveAdmin.test.ts` |
| 修改 | `lib/line/handleLineEvent.ts` |
| 修改 | `app/api/events/route.ts` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260515_drive_folder_columns.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: 建立 migration 檔**

`supabase/migrations/20260515_drive_folder_columns.sql`:
```sql
ALTER TABLE chat_groups
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
```

- [ ] **Step 2: 同步更新 schema.sql**

在 `db/schema.sql` 的 `chat_groups` 定義後（`picture_url` ALTER 那段下方）加入：
```sql
ALTER TABLE chat_groups
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
```

在 `events` 定義後加入：
```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
```

- [ ] **Step 3: 套用到 Supabase**

前往 Supabase Dashboard → SQL Editor，貼上 migration 內容執行。
確認 `chat_groups` 和 `events` 表都出現 `drive_folder_id` 欄位。

- [ ] **Step 4: 更新 `ChatGroupRow` 型別**

在 `lib/db/repository.ts` 第 4-8 行的 `ChatGroupRow` 加上新欄位：

```typescript
type ChatGroupRow = {
  id: number;
  line_group_id: string;
  name: string | null;
  picture_url: string | null;
  drive_folder_id: string | null;
};
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260515_drive_folder_columns.sql db/schema.sql lib/db/repository.ts
git commit -m "feat(db): add drive_folder_id to chat_groups and events"
```

---

## Task 2: Service Account Token 換取

**Files:**
- Create: `lib/google/serviceAccount.ts`
- Create: `lib/google/__tests__/serviceAccount.test.ts`

- [ ] **Step 1: 寫失敗測試**

新增 `lib/google/__tests__/serviceAccount.test.ts`：

```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("getServiceAccountKey", () => {
  const ORIGINAL_ENV = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = ORIGINAL_ENV;
    }
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
```

- [ ] **Step 2: 確認測試失敗**

```bash
npx vitest run lib/google/__tests__/serviceAccount.test.ts
```
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `lib/google/serviceAccount.ts`**

```typescript
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
```

- [ ] **Step 4: 確認測試通過**

```bash
npx vitest run lib/google/__tests__/serviceAccount.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/google/serviceAccount.ts lib/google/__tests__/serviceAccount.test.ts
git commit -m "feat(google): add service account JWT token exchange"
```

---

## Task 3: Drive Admin（建資料夾 + 設權限）

**Files:**
- Create: `lib/google/driveAdmin.ts`
- Create: `lib/google/__tests__/driveAdmin.test.ts`

- [ ] **Step 1: 寫失敗測試**

新增 `lib/google/__tests__/driveAdmin.test.ts`：

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/google/serviceAccount", () => ({
  getServiceAccountAccessToken: vi.fn().mockResolvedValue("fake-token"),
}));

describe("createDriveFolder", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "folder-id-123",
          webViewLink: "https://drive.google.com/drive/folders/folder-id-123",
        }),
      })
    );
  });

  it("calls Drive API with correct folder metadata", async () => {
    const { createDriveFolder } = await import("@/lib/google/driveAdmin");
    const result = await createDriveFolder({ name: "Test Folder" });

    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fake-token",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toEqual({
      id: "folder-id-123",
      webViewLink: "https://drive.google.com/drive/folders/folder-id-123",
    });
  });

  it("includes parentId in parents array when provided", async () => {
    const { createDriveFolder } = await import("@/lib/google/driveAdmin");
    await createDriveFolder({ name: "Sub Folder", parentId: "parent-123" });

    const callArg = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const body = JSON.parse(callArg.body as string) as {
      parents?: string[];
    };
    expect(body.parents).toEqual(["parent-123"]);
  });

  it("throws when Drive API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Forbidden" } }),
      })
    );
    const { createDriveFolder } = await import("@/lib/google/driveAdmin");
    await expect(createDriveFolder({ name: "Fail" })).rejects.toThrow(
      "Forbidden"
    );
  });
});

describe("setDriveFolderPermission", () => {
  it("calls Drive permissions API with anyone/writer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
    const { setDriveFolderPermission } = await import(
      "@/lib/google/driveAdmin"
    );
    await setDriveFolderPermission({ folderId: "folder-123", role: "writer" });

    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/folder-123/permissions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "anyone", role: "writer" }),
      })
    );
  });
});
```

- [ ] **Step 2: 確認測試失敗**

```bash
npx vitest run lib/google/__tests__/driveAdmin.test.ts
```
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `lib/google/driveAdmin.ts`**

```typescript
import { getServiceAccountAccessToken } from "@/lib/google/serviceAccount";

export type DriveFolder = {
  id: string;
  webViewLink: string;
};

export async function createDriveFolder(input: {
  name: string;
  parentId?: string;
}): Promise<DriveFolder> {
  const accessToken = await getServiceAccountAccessToken();

  const metadata: Record<string, unknown> = {
    name: input.name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (input.parentId) {
    metadata.parents = [input.parentId];
  }

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
    }
  );

  const json = (await response.json()) as {
    id?: string;
    webViewLink?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      `Drive create folder error: ${json.error?.message ?? response.status}`
    );
  }
  if (!json.id || !json.webViewLink) {
    throw new Error("Drive API returned incomplete folder data.");
  }
  return { id: json.id, webViewLink: json.webViewLink };
}

export async function setDriveFolderPermission(input: {
  folderId: string;
  role: "reader" | "writer";
}): Promise<void> {
  const accessToken = await getServiceAccountAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.folderId)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", role: input.role }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const json = (await response
      .json()
      .catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(
      `Drive set permission error: ${json?.error?.message ?? response.status}`
    );
  }
}

export function formatMeetingFolderName(title: string, startsAt: string): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(startsAt))
    .replace(/-/g, "");
  return `${date}_${title}`;
}
```

- [ ] **Step 4: 確認測試通過**

```bash
npx vitest run lib/google/__tests__/driveAdmin.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/google/driveAdmin.ts lib/google/__tests__/driveAdmin.test.ts
git commit -m "feat(google): add Drive folder creation and permission helpers"
```

---

## Task 4: Repository 新增 DB 函式

**Files:**
- Modify: `lib/db/repository.ts`

在檔案最底部（`getGoogleCredentialByLineUserId` 之後）新增以下三個函式。

- [ ] **Step 1: 新增 `upsertGroupDriveFolderId`**

```typescript
export async function upsertGroupDriveFolderId(
  lineGroupId: string,
  driveFolderId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const trimmedGroupId = requireNonEmpty(lineGroupId, "lineGroupId");
  const trimmedFolderId = requireNonEmpty(driveFolderId, "driveFolderId");
  const { error } = await supabase
    .from("chat_groups")
    .update({ drive_folder_id: trimmedFolderId })
    .eq("line_group_id", trimmedGroupId);
  assertNoError(error, "更新群組 Drive 資料夾 ID 失敗。");
}
```

- [ ] **Step 2: 新增 `getGroupDriveFolderId`**

```typescript
export async function getGroupDriveFolderId(
  lineGroupId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const trimmedGroupId = requireNonEmpty(lineGroupId, "lineGroupId");
  const { data, error } = await supabase
    .from("chat_groups")
    .select("drive_folder_id")
    .eq("line_group_id", trimmedGroupId)
    .maybeSingle<{ drive_folder_id: string | null }>();
  assertNoError(error, "讀取群組 Drive 資料夾 ID 失敗。");
  return data?.drive_folder_id ?? null;
}
```

- [ ] **Step 3: 新增 `setEventDriveFolderId`**

```typescript
export async function setEventDriveFolderId(
  eventId: number,
  driveFolderId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const trimmedFolderId = requireNonEmpty(driveFolderId, "driveFolderId");
  const { error } = await supabase
    .from("events")
    .update({ drive_folder_id: trimmedFolderId })
    .eq("id", eventId);
  assertNoError(error, "更新活動 Drive 資料夾 ID 失敗。");
}
```

- [ ] **Step 4: Lint 確認**

```bash
npm run lint
```
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add lib/db/repository.ts
git commit -m "feat(db): add Drive folder ID repository functions"
```

---

## Task 5: 群組加入時建立母資料夾

**Files:**
- Modify: `lib/line/handleLineEvent.ts`

- [ ] **Step 1: 在 import 區塊加入 Drive 相關 import**

在 `lib/line/handleLineEvent.ts` 頂端現有 imports 之後加入：

```typescript
import {
  createDriveFolder,
  setDriveFolderPermission,
} from "@/lib/google/driveAdmin";
import {
  upsertGroupDriveFolderId,
} from "@/lib/db/repository";
```

- [ ] **Step 2: 修改 `syncGroupFromJoin`，新增回傳型別並在裡面建 Drive 資料夾**

找到 `syncGroupFromJoin`（目前約 349 行），將其從回傳 `Promise<void>` 改為回傳 `Promise<string | null>`（Drive 資料夾連結）：

```typescript
async function syncGroupFromJoin(
  client: messagingApi.MessagingApiClient,
  event: Extract<LineEvent, { type: "join" }>
): Promise<string | null> {
  if (!isGroupJoinEvent(event)) return null;

  const groupSummary = await getGroupName(client, event.source.groupId);
  await ensureChatGroup(
    event.source.groupId,
    groupSummary.name,
    groupSummary.pictureUrl
  );

  try {
    const folder = await createDriveFolder({
      name: groupSummary.name ?? event.source.groupId,
    });
    await setDriveFolderPermission({ folderId: folder.id, role: "writer" });
    await upsertGroupDriveFolderId(event.source.groupId, folder.id);
    return folder.webViewLink;
  } catch (error) {
    console.error("[drive.createGroupFolder]", error);
    return null;
  }
}
```

- [ ] **Step 3: 修改 `join` event handler，把資料夾連結加進回覆訊息**

找到 `join` handler（目前約 493 行）：

```typescript
join: async (client, event) => {
  if (event.type !== "join") return;
  let driveFolderLink: string | null = null;
  try {
    driveFolderLink = await syncGroupFromJoin(client, event);
  } catch (error) {
    console.error("[LINE join sync]", error);
  }
  const messages: messagingApi.Message[] = [
    textMessage(WELCOME_ON_JOIN),
  ];
  if (driveFolderLink) {
    messages.push(
      textMessage(`📁 已為本群組建立 Google Drive 資料夾：\n${driveFolderLink}`)
    );
  }
  await client.replyMessage({
    replyToken: event.replyToken,
    messages,
  });
},
```

- [ ] **Step 4: Lint 確認**

```bash
npm run lint
```
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add lib/line/handleLineEvent.ts
git commit -m "feat(line): create Drive group folder on bot join"
```

---

## Task 6: 建立會議時建子資料夾

**Files:**
- Modify: `app/api/events/route.ts`

- [ ] **Step 1: 加入 import**

在 `app/api/events/route.ts` 頂端現有 imports 之後加入：

```typescript
import {
  createDriveFolder,
  setDriveFolderPermission,
  formatMeetingFolderName,
} from "@/lib/google/driveAdmin";
import {
  getGroupDriveFolderId,
  setEventDriveFolderId,
} from "@/lib/db/repository";
```

- [ ] **Step 2: 在 POST handler 中，於 reminder 排程之後加入 Drive 子資料夾邏輯**

在 `app/api/events/route.ts` 的 `POST` handler 裡，`reminderScheduled` 那段之後、`return Response.json(...)` 之前，插入：

```typescript
let driveFolderUrl: string | null = null;
try {
  let parentFolderId = await getGroupDriveFolderId(input.groupId);

  if (!parentFolderId) {
    const groupFolder = await createDriveFolder({ name: input.groupId });
    await setDriveFolderPermission({
      folderId: groupFolder.id,
      role: "writer",
    });
    await upsertGroupDriveFolderId(input.groupId, groupFolder.id);
    parentFolderId = groupFolder.id;
  }

  const folderName = formatMeetingFolderName(
    createdEvent.title,
    createdEvent.startsAt
  );
  const meetingFolder = await createDriveFolder({
    name: folderName,
    parentId: parentFolderId,
  });
  await setDriveFolderPermission({
    folderId: meetingFolder.id,
    role: "writer",
  });
  await setEventDriveFolderId(createdEvent.eventId, meetingFolder.id);
  driveFolderUrl = meetingFolder.webViewLink;
} catch (error) {
  console.error("[create-event.drive-folder]", error);
}

if (driveFolderUrl) {
  try {
    const driveClient = createMessagingClient();
    await driveClient.pushMessage({
      to: createdEvent.lineGroupId,
      messages: [
        {
          type: "text",
          text: `📁 會議資料夾：\n${driveFolderUrl}`,
        },
      ],
    });
  } catch (error) {
    console.error("[create-event.drive-folder.notify]", error);
  }
}
```

也需要把 `upsertGroupDriveFolderId` 加到頂端 import：

```typescript
import {
  createEventWithAttendees,
  setEventReminderSchedule,
  listGroupEvents,
  listLineUsersByIds,
  RepositoryError,
  upsertLineUser,
  getGroupDriveFolderId,
  setEventDriveFolderId,
  upsertGroupDriveFolderId,
} from "@/lib/db/repository";
```

- [ ] **Step 3: 把 `driveFolderUrl` 加進 response body**

將 `return Response.json(...)` 改為：

```typescript
return Response.json(
  {
    eventId: createdEvent.eventId,
    notificationSent,
    reminderScheduled,
    driveFolderUrl,
  },
  { status: 201 }
);
```

- [ ] **Step 4: Lint 確認**

```bash
npm run lint
```
Expected: 0 errors, 0 warnings

- [ ] **Step 5: 跑全部測試**

```bash
npx vitest run
```
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/events/route.ts
git commit -m "feat(events): create Drive meeting subfolder on event creation"
```

---

## Task 7: 手動驗收測試

- [ ] **Step 1: 啟動 dev server**

```bash
npm run dev
```

- [ ] **Step 2: 測試 Service Account token（選做，需要 .env 設定好）**

```bash
node -e "
require('dotenv').config({ path: '.env' });
const { getServiceAccountAccessToken } = require('./lib/google/serviceAccount');
getServiceAccountAccessToken().then(t => console.log('Token OK, length:', t.length)).catch(console.error);
" 
```
Expected: `Token OK, length: <數字>`

> 如果 TypeScript import 有問題，先 build：`npm run build`，再從 `.next/server` 目錄測試。

- [ ] **Step 3: 驗收 join 事件**

用 LINE Developers Console 的 Webhook Test，或重新把 bot 踢出群組再加回來，觀察 LINE 群組是否收到：
1. 歡迎訊息
2. 「📁 已為本群組建立 Google Drive 資料夾：https://drive.google.com/...」

- [ ] **Step 4: 驗收 event 建立**

從 LIFF 建立一個新會議，觀察 LINE 群組是否在建立成功通知後收到：
「📁 會議資料夾：https://drive.google.com/...」

- [ ] **Step 5: 點開連結確認**

點開連結，確認可以進入 Drive 資料夾、可以上傳檔案。
