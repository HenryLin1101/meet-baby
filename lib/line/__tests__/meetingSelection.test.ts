import { describe, expect, it } from "vitest";
import {
  parseMeetingSelection,
  buildQuickRepliesFromOptions,
  type MeetingOption,
} from "@/lib/line/meetingSelection";

const options: MeetingOption[] = [
  { eventId: 10, title: "Q2 產品規劃", startsAt: "2026-06-05T02:00:00.000Z" },
  { eventId: 20, title: "行銷週會", startsAt: "2026-06-06T02:00:00.000Z" },
];

describe("parseMeetingSelection", () => {
  it("回傳第一個會議的 eventId（選 1）", () => {
    expect(parseMeetingSelection("1", options)).toEqual({ matched: true, eventId: 10 });
  });

  it("回傳第二個會議的 eventId（選 2）", () => {
    expect(parseMeetingSelection("2", options)).toEqual({ matched: true, eventId: 20 });
  });

  it("不指定時回傳 matched=true, eventId=null", () => {
    expect(parseMeetingSelection("不指定", options)).toEqual({ matched: true, eventId: null });
  });

  it("超出範圍的數字回傳 matched=false", () => {
    expect(parseMeetingSelection("3", options)).toEqual({ matched: false });
    expect(parseMeetingSelection("0", options)).toEqual({ matched: false });
  });

  it("非數字文字回傳 matched=false", () => {
    expect(parseMeetingSelection("hello", options)).toEqual({ matched: false });
    expect(parseMeetingSelection("", options)).toEqual({ matched: false });
  });

  it("部分數字加文字回傳 matched=false（例如 '1abc'）", () => {
    expect(parseMeetingSelection("1abc", options)).toEqual({ matched: false });
  });
});

describe("buildQuickRepliesFromOptions", () => {
  it("回傳數字按鈕加上不指定按鈕", () => {
    const replies = buildQuickRepliesFromOptions(options);
    expect(replies).toHaveLength(3);
    expect(replies[0].text).toBe("1");
    expect(replies[1].text).toBe("2");
    expect(replies[2].text).toBe("不指定");
    expect(replies[2].label).toBe("不指定");
  });

  it("label 不超過 20 字元", () => {
    const longOptions: MeetingOption[] = [
      { eventId: 1, title: "A".repeat(30), startsAt: "2026-06-05T02:00:00.000Z" },
    ];
    const replies = buildQuickRepliesFromOptions(longOptions);
    expect(replies[0].label.length).toBeLessThanOrEqual(20);
  });

  it("空陣列時只有不指定按鈕", () => {
    const replies = buildQuickRepliesFromOptions([]);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toBe("不指定");
  });
});
