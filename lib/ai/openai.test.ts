import { describe, expect, it } from "vitest";
import { formatMeetingSummaryForLine } from "@/lib/ai/openai";

describe("formatMeetingSummaryForLine", () => {
  it("groups action items under owner headings", () => {
    const text = formatMeetingSummaryForLine({
      summary: {
        topic: "測試會議",
        bullets: [],
        decisions: [],
        actionItems: [
          { owner: "王小明", item: "負責 API 串接", due: "" },
          { owner: "王小明", item: "週五前交文件", due: "2026-05-20" },
          { owner: "李小華", item: "聯絡客戶", due: "" },
          { owner: "", item: "整理會議記錄", due: "" },
        ],
      },
    });

    expect(text).toContain("待辦事項：");
    expect(text).toContain("【王小明】");
    expect(text).toContain("【李小華】");
    expect(text).toContain("【待確認負責人】");
    expect(text).not.toContain("分工（依與會者）");
  });
});
