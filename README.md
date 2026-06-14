# 米特寶寶（Meet Baby）

內建於 LINE 群組的會議管理機器人：在群組裡即可預約會議、自動同步 Google Calendar、產生會議摘要與待辦事項，並以自然語言查詢歷史會議內容。

成員不需要切換到其他工具，就能完成「排會議 → 開會 → 整理逐字稿 → 產生摘要與待辦 → 追蹤進度 → 查詢歷史」的完整會議生命週期。前端 UI 以 LIFF（LINE Front-end Framework）嵌入 LINE，後端部署於 Vercel。

## 目錄

- [核心功能](#核心功能)
- [系統架構](#系統架構)
- [技術棧](#技術棧)
- [專案目錄結構](#專案目錄結構)
- [快速開始](#快速開始)
- [環境變數](#環境變數)
- [資料庫](#資料庫)
- [API 一覽](#api-一覽)
- [LINE 指令](#line-指令)
- [測試](#測試)
- [部署](#部署)
- [文件](#文件)

## 核心功能

| 功能 | 說明 |
| --- | --- |
| **會議建立與管理** | 在 LINE 群組內透過 LIFF 介面建立 / 修改 / 取消會議，並同步至 Google Calendar |
| **自動會議摘要** | 偵測 Google Drive 中的逐字稿後，以 LLM 自動生成會議摘要、決議與待辦清單 |
| **RAG 智慧查詢** | 將會議摘要與 Drive 文件向量化，讓使用者以自然語言查詢歷史會議內容 |
| **Google Drive 檔案管理** | 機器人加入群組與建立會議時自動建立對應 Drive 資料夾，供成員集中管理檔案 |
| **會議提醒** | 透過 QStash 排程，在會議開始前的指定時間以 LINE 推播提醒參與者 |
| **代辦事項管理** | 從會議摘要自動擷取待辦事項並支援多人指派，於 LIFF Dashboard 追蹤 |

## 系統架構

```
                       ┌──────────────────────────┐
   LINE 使用者 ───────▶│   LINE Messaging Platform │
        ▲              └────────────┬─────────────┘
        │ 推播 / Flex / LIFF        │ webhook
        │                           ▼
        │              ┌──────────────────────────────────────┐
        │              │   Next.js (App Router) on Vercel       │
        │              │                                        │
        │   LIFF 網頁  │  app/api/*   ── 後端 API 路由           │
        └──────────────┤  app/liff/*  ── 內嵌 LINE 的前端頁面    │
                       │  lib/*       ── 領域邏輯（命令、摘要…） │
                       └───┬───────┬───────┬───────┬───────────┘
                           │       │       │       │
                  ┌────────▼─┐ ┌───▼────┐ ┌▼──────┐ ┌▼──────────┐
                  │ Supabase │ │ Google │ │ QStash│ │ LLM        │
                  │ Postgres │ │ Drive  │ │ 排程  │ │ OpenAI /   │
                  │ + pgvector│ │+Calendar│ │ 任務 │ │ Gemini     │
                  └──────────┘ └────────┘ └───────┘ └────────────┘
```

- **同步請求**：使用者在 LIFF 操作 → 呼叫 `app/api/*` → 讀寫 Supabase / Google API。
- **非同步任務**：建立會議或偵測逐字稿時，將工作丟到 **QStash**，由 `app/api/qstash/*` 端點在排定時間回呼執行（提醒推播、摘要生成、Drive 掃描）。
- **AI 分工**：會議摘要使用 **OpenAI**（`lib/ai/openai.ts`）；RAG 的向量嵌入與問答使用 **Gemini**（`lib/ai/embeddings.ts`、`app/api/rag`）。

## 技術棧

| 層級 | 技術 |
| --- | --- |
| 前端 / 後端框架 | Next.js 16（App Router）、React 19、TypeScript |
| 樣式 | Tailwind CSS v4 |
| 聊天機器人 | LINE Messaging API（`@line/bot-sdk`）、LIFF（`@line/liff`） |
| 資料庫 | Supabase（PostgreSQL + pgvector） |
| 排程 / 佇列 | Upstash QStash |
| Google 整合 | Google Drive API、Google Calendar API（Service Account + 使用者 OAuth） |
| AI | OpenAI（摘要）、Google Gemini（RAG 嵌入與問答） |
| 測試 | Vitest |
| 部署 | Vercel |

## 專案目錄結構

```
meet-baby/
├── app/
│   ├── api/                    # 後端 API 路由
│   │   ├── line/               # LINE webhook 入口
│   │   ├── events/             # 會議 CRUD
│   │   ├── todo-items/         # 待辦事項 CRUD
│   │   ├── dashboard/          # Dashboard 資料
│   │   ├── group-members/      # 群組成員
│   │   ├── rag/                # RAG 智慧查詢
│   │   ├── google/             # OAuth、Calendar scope、Drive 資料夾
│   │   ├── qstash/             # 排程回呼（summary / reminder / drive-scan / tactiq-scan）
│   │   └── admin/              # 管理用端點（drive-scan cron）
│   └── liff/                   # 內嵌 LINE 的前端頁面
│       ├── meeting/            #   建立 / 編輯會議
│       ├── dashboard/          #   會議與待辦總覽
│       ├── drive/              #   跳轉群組 Drive 資料夾
│       ├── rag/                #   自然語言查詢
│       └── google-auth/        #   Google OAuth 授權引導
├── lib/
│   ├── line/                   # LINE 事件處理、指令路由與各指令
│   ├── google/                 # Drive / Calendar / OAuth / Service Account helpers
│   ├── ai/                     # 摘要（OpenAI）、嵌入與索引（Gemini）
│   ├── summaries/              # 摘要排程與待辦解析
│   ├── reminders/              # 提醒排程
│   ├── db/                     # Supabase client 與 repository（唯一資料層）
│   ├── qstash/                 # QStash client
│   ├── conversation/           # 對話狀態
│   ├── liff/                   # LIFF client 與工具
│   └── modules/                # 共用型別與命令基底
├── supabase/migrations/        # 資料庫 schema 歷史
├── db/                         # schema 與 service role 設定參考
└── vitest.config.ts
```

所有資料庫操作集中在 `lib/db/repository.ts`，是唯一的資料存取層。

## 快速開始

需求：Node.js >= 20.9.0。

```bash
# 1. 安裝相依套件
npm install

# 2. 設定環境變數（見下節）
cp .env.example .env.local
# 編輯 .env.local 填入金鑰

# 3. 啟動開發伺服器
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

> LINE webhook 與 LIFF 需要 HTTPS 與公開網址。本機測試可使用 `npm run dev:https`（需自備憑證）搭配 ngrok 之類的工具，或直接部署到 Vercel 取得正式網址。

常用指令：

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 建置正式版本 |
| `npm run start` | 啟動正式版本 |
| `npm run lint` | ESLint 檢查 |
| `npm run test` | 執行單元測試（Vitest） |
| `npm run test:watch` | 監看模式執行測試 |

## 環境變數

於 `.env.local`（本機）或 Vercel 專案設定中配置。**所有 server-only 金鑰絕不可暴露給瀏覽器**（僅 `NEXT_PUBLIC_` 開頭的變數會帶到前端）。

| 變數 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 金鑰（**server only**） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API access token |
| `LINE_CHANNEL_SECRET` | LINE webhook 簽章驗證 |
| `NEXT_PUBLIC_LIFF_ID` | LIFF App ID（前端用） |
| `APP_BASE_URL` | 應用程式對外網址（OAuth 回調、QStash 回呼用） |
| `QSTASH_TOKEN` | QStash 發布任務用 token（**server only**） |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash 簽章驗證（現用金鑰） |
| `QSTASH_NEXT_SIGNING_KEY` | QStash 簽章驗證（輪替金鑰） |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service Account 憑證 JSON（建立 Drive 資料夾、設權限） |
| `GOOGLE_CLIENT_ID` | Google OAuth client id（使用者授權 Calendar / 讀取 Docs） |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret（**server only**） |
| `OPENAI_API_KEY` | 會議摘要生成（**server only**） |
| `OPENAI_MODEL` | 摘要模型，預設 `gpt-4.1-mini` |
| `GEMINI_API_KEY` | RAG 向量嵌入與問答（**server only**） |
| `CHAT_MODEL` | RAG 對話模型，預設 `gemini-2.0-flash` |
| `ADMIN_SECRET` | 保護管理用端點（如 drive-scan cron） |

選用（Tactiq 逐字稿自動掃描）：`TACTIQ_DRIVE_FOLDER_NAME`、`TACTIQ_TRANSCRIPT_FILE_NAME`、`TACTIQ_EXCLUDED_FILE_NAMES`、`TACTIQ_HOST_LINE_USER_ID`、`TACTIQ_DEFAULT_MEETING_DURATION_MINUTES`。

## 資料庫

採用 Supabase（PostgreSQL，啟用 `pgvector` 供 RAG 使用）。Schema 變更歷史見 `supabase/migrations/`。主要資料表：

| 資料表 | 說明 |
| --- | --- |
| `line_users` | LINE 使用者基本資料 |
| `chat_groups` | LINE 群組（含群組 Drive 資料夾 ID） |
| `group_memberships` | 使用者與群組的多對多關係 |
| `events` | 會議事件（含 Calendar / Drive 關聯） |
| `event_attendees` | 會議參加者 |
| `event_summaries` | 會議摘要資訊 |
| `todo_items` | 專案代辦事項 |
| `todo_item_assignees` | 代辦事項指派關聯 |
| `documents_chunks` | RAG 向量資料（pgvector） |
| `drive_indexed_files` | 已索引的 Drive 檔案追蹤紀錄 |
| `google_credentials` | 使用者的 Google OAuth refresh token |
| `webhook_event_logs` | LINE webhook 事件日誌 |

完整 EER 圖：<https://dbdiagram.io/d/meet-baby-EER-6a1be4bd2eeb2f46cd253260>

> Drive 資料夾為兩層結構：每個群組一個資料夾，其下每場會議一個 `YYYYMMDD_會議標題` 子資料夾。

## API 一覽

所有路由位於 `app/api/`。認證方式分為：使用者操作用 **LINE Bearer Token**（前端帶 LINE access token）、webhook 用 **X-Line-Signature**、排程回呼用 **QStash Signature**。

| Method | Endpoint | 功能 | 認證 |
| --- | --- | --- | --- |
| POST | `/api/line` | 接收 LINE webhook | X-Line-Signature |
| GET | `/api/dashboard` | 取得使用者所有群組與會議 | LINE Bearer |
| POST | `/api/events` | 建立新會議 | LINE Bearer |
| PATCH | `/api/events/[eventId]` | 更新會議資訊 | LINE Bearer |
| DELETE | `/api/events/[eventId]` | 取消會議 | LINE Bearer |
| GET | `/api/todo-items` | 取得使用者所有群組的待辦事項 | LINE Bearer |
| POST | `/api/todo-items` | 建立待辦事項 | LINE Bearer |
| PATCH | `/api/todo-items/[id]` | 更新待辦事項 / 標記完成 | LINE Bearer |
| DELETE | `/api/todo-items/[id]` | 刪除待辦事項 | LINE Bearer |
| GET | `/api/group-members` | 取得群組成員列表 | LINE Bearer |
| POST | `/api/rag` | RAG 智慧查詢歷史會議與文件 | LINE Bearer |
| GET | `/api/google/calendar-scope` | 檢查 Google Calendar 授權狀態 | LINE Bearer |
| GET | `/api/google/oauth/start` · `/consent` | 導向 Google OAuth 授權頁面 | — |
| GET | `/api/google/oauth/callback` | Google OAuth 回調處理 | — |
| GET | `/api/google/drive-folder` | 取得群組 Drive 資料夾連結 | LINE Bearer |
| POST | `/api/qstash/summary` | 執行會議摘要生成 | QStash Signature |
| POST/GET | `/api/qstash/drive-scan` | 掃描 Drive 資料夾並索引檔案 | QStash Signature |
| POST | `/api/qstash/event-reminder` | 發送會議提醒推播 | QStash Signature |
| POST | `/api/qstash/tactiq-scan` | 掃描 Tactiq 逐字稿 | QStash Signature |
| GET | `/api/admin/drive-scan-cron` | 管理用 Drive 掃描排程 | `ADMIN_SECRET` |

## LINE 指令

在群組中可用明確前綴（`/` 或 `!`）或關鍵字觸發（指令定義於 `lib/line/commands/`，路由於 `lib/line/commandRouter.ts`）：

| 指令 | 功能 |
| --- | --- |
| Help | 顯示可用功能說明 |
| Summary | 觸發 / 查詢會議摘要 |
| ScanTranscript | 掃描逐字稿並產生摘要 |
| Meeting | 開啟建立會議的 LIFF 介面 |
| Upcoming | 列出即將到來的會議 |
| Liff | 開啟對應 LIFF 功能頁 |

> 當使用者 @ 機器人但無法對應到已知指令時，會回覆一張含「建立會議 / 檔案管理 / Dashboard」等按鈕的 Flex Message 選單。

## 測試

使用 Vitest，測試檔與被測模組同目錄（`*.test.ts` 或 `__tests__/`）。

```bash
npm run test        # 執行一次
npm run test:watch  # 監看模式
```

| 測試檔 | 測試對象 |
| --- | --- |
| `lib/ai/openai.test.ts` | `formatMeetingSummaryForLine` |
| `lib/google/__tests__/drive.test.ts` | `copyFileToFolder` |
| `lib/google/__tests__/driveAdmin.test.ts` | `createDriveFolder`、`uploadTextAsGoogleDoc`、`setDriveFolderPermission` |
| `lib/google/__tests__/serviceAccount.test.ts` | `getServiceAccountKey` |
| `lib/google/driveTranscript.test.ts` | Google Docs 逐字稿解析 |
| `lib/line/__tests__/meetingSelection.test.ts` | `parseMeetingSelection`、`buildQuickRepliesFromOptions` |
| `lib/reminders/schedule.test.ts` | `resolveReminderScheduleTime`、`toUnixTimestampSeconds` |
| `lib/summaries/schedule.test.ts` | 摘要排程時間計算 |
| `lib/summaries/resolveTodoOwners.test.ts` | `matchOwnerToLineMember`、`resolveActionItemOwners` |

## 部署

部署於 **Vercel**：

1. 連接此 GitHub repository 至 Vercel 專案。
2. 在 Vercel 設定上述所有環境變數。
3. 將 LINE channel 的 webhook URL 指向 `https://<your-domain>/api/line`。
4. 在 LINE Developers Console 設定 LIFF App，endpoint 指向 `https://<your-domain>/liff/...`。
5. 於 QStash 設定排程任務指向 `/api/qstash/*` 回呼端點。

## 文件

設計與規劃文件、流程圖與專案管理紀錄整理於下：

| 文件 | 內容 | 連結 |
| --- | --- | --- |
| 系統設計文件 | User Story Mapping、BPMN 流程圖、EER 圖、API 文件、測試報告 | [米特寶寶M4文件_重新排版.pdf](./米特寶寶M4文件_重新排版.pdf) |
| EER 資料庫圖 | 線上互動式 ER 圖 | <https://dbdiagram.io/d/meet-baby-EER-6a1be4bd2eeb2f46cd253260> |
| 專案進度看板 | Trello 看板 | <https://trello.com/b/qVLyxrHj/%E7%B1%B3%E7%89%B9%E5%AF%B6%E5%AF%B6> |
