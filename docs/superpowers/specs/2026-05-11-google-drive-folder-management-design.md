# Google Drive 資料夾管理功能設計

**Date:** 2026-05-11  
**Status:** Approved — pending implementation  
**Scope:** 資料夾管理（群組母資料夾 + 會議子資料夾）。不含自動備份。

---

## 需求摘要

當米特寶寶 bot 加入 LINE 群組時，自動在 Google Drive 建立一個群組專屬資料夾。每次在該群組建立新會議時，自動在母資料夾底下建立會議子資料夾，並把連結貼回 LINE 群組。

---

## 決策

| 項目 | 選擇 | 理由 |
|---|---|---|
| 認證方式 | GCP Service Account | 完全自動化，不需 user 授權 |
| 資料夾位置 | Service Account 的 Drive | Bot 統一管理 |
| 分享權限 | 知道連結的人可以編輯 (writer) | 群組成員可共同上傳檔案 |
| 子資料夾時機 | 建立會議時立刻建立 | 連結當場回傳，使用者即時可用 |
| 實作方式 | 方案 A：同步內嵌 | 符合現有 codebase 風格；Drive folder 建立速度快 |
| Drive 客戶端 | 自製 raw fetch（仿 `lib/google/drive.ts`） | 不引入新套件，維持一致風格 |

---

## 架構

### 資料流

```
Bot 加入群組 (join webhook — bot 自己加入，非 memberJoined)
  └── createGroupDriveFolder(lineGroupId, groupName)
        ├── Service Account token 換取
        ├── Drive API: 建母資料夾
        ├── Drive API: 設權限 anyone→writer
        ├── DB: upsertGroupDriveFolderId(lineGroupId, folderId)
        └── LINE: 推 Flex 訊息（資料夾連結）

建立會議 (createEventCommand)
  └── createMeetingDriveFolder(eventId, title, date, groupLineId)
        ├── DB: getGroupDriveFolderId(lineGroupId)  → 若無則先建母資料夾
        ├── Service Account token 換取
        ├── Drive API: 建子資料夾（名稱格式：YYYYMMDD_會議名稱）
        ├── Drive API: 設權限 anyone→writer
        ├── DB: setEventDriveFolderId(eventId, folderId)
        └── 把連結塞進「建立成功」的回覆訊息
```

### 錯誤處理

- Drive API 呼叫**不阻斷主流程**
- 建母資料夾失敗 → 靜默 log，不推錯誤到群組
- 建子資料夾失敗 → 會議照常建立；回覆訊息改為「資料夾建立失敗，請稍後再試」
- 舊群組（功能上線前已加入，無母資料夾）→ 建會議時補建母資料夾

---

## 新增 / 修改檔案

### 新增

| 路徑 | 說明 |
|---|---|
| `lib/google/serviceAccount.ts` | Service Account JWT 簽名（RS256，Node.js `crypto` 內建）+ access token 換取 |
| `lib/google/driveAdmin.ts` | `createFolder(name, parentId?, accessToken)` → `{ id, webViewLink }` |
| | `setFolderPermission(folderId, role, accessToken)` → `void` |
| `supabase/migrations/YYYYMMDD_drive_folder_columns.sql` | `chat_groups.drive_folder_id TEXT`, `events.drive_folder_id TEXT` |

### 修改

| 路徑 | 變更說明 |
|---|---|
| `lib/db/repository.ts` | 新增 `upsertGroupDriveFolderId`, `setEventDriveFolderId`, `getGroupDriveFolderId` |
| `lib/line/handleLineEvent.ts` | 在既有的 `join` event handler 裡呼叫建母資料夾 |
| `lib/line/commands/createEventCommand.ts` | 建完 event 後呼叫建子資料夾，回覆訊息加上資料夾連結 |
| `db/schema.sql` | 同步新增兩個欄位定義（紀錄用） |

---

## Service Account 認證流程

```typescript
// lib/google/serviceAccount.ts

// 1. 從 process.env.GOOGLE_SERVICE_ACCOUNT_JSON 解析 JSON
// 2. 用 private_key (PEM) + RS256 建立 JWT：
//    header: { alg: "RS256", typ: "JWT" }
//    payload: {
//      iss: client_email,
//      scope: "https://www.googleapis.com/auth/drive",
//      aud: "https://oauth2.googleapis.com/token",
//      exp: now + 3600,
//      iat: now
//    }
// 3. POST https://oauth2.googleapis.com/token
//    grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
// 4. 回傳 access_token

export async function getServiceAccountAccessToken(): Promise<string>
```

Token 不做快取（低頻操作）。

---

## DB 變更

```sql
-- supabase/migrations/YYYYMMDD_drive_folder_columns.sql
ALTER TABLE chat_groups
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
```

---

## 環境變數

| 變數名稱 | 說明 | 必填 |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GCP Service Account JSON 金鑰完整內容（單行） | 是 |

---

## GCP 事前設定（手動步驟）

1. GCP Console → 啟用 **Google Drive API**（APIs & Services → Library）
2. IAM & Admin → Service Accounts → **建立 Service Account**
3. Service Account → Keys → Add Key → JSON → **下載金鑰**
4. 把 JSON 內容貼進 Vercel 環境變數 `GOOGLE_SERVICE_ACCOUNT_JSON`
5. 不需設定 IAM 角色（Drive 資料夾 ownership 由 Drive API 控制）

> Service Account 建立的資料夾屬於 Service Account 的 Drive，**不會出現在個人 My Drive**，只能透過共享連結存取。Service Account Drive 免費空間 15 GB。

---

## 子資料夾命名規則

```
YYYYMMDD_<會議名稱>
例如：20260511_Q2 產品規劃會議
```

---

## 尚未實作（Out of Scope）

- 自動備份：user tag @米特寶寶 傳檔案 → 自動上傳 Drive
- 查詢現有資料夾連結的指令
- 刪除 / 重新命名資料夾
