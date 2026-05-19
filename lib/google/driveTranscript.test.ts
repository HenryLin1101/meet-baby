import { describe, expect, it } from "vitest";
import {
  isExcludedTactiqMetadataFile,
  pickBestTranscript,
  scoreTranscriptTitleMatch,
  type TactiqTranscriptFile,
} from "@/lib/google/driveTranscript";

function file(
  overrides: Partial<TactiqTranscriptFile> & Pick<TactiqTranscriptFile, "fileId" | "name">
): TactiqTranscriptFile {
  return {
    webViewLink: `https://docs.google.com/document/d/${overrides.fileId}/edit`,
    modifiedTime: "2026-05-16T10:00:00.000Z",
    createdTime: "2026-05-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("driveTranscript", () => {
  it("excludes metadata file names", () => {
    expect(isExcludedTactiqMetadataFile("會議詳細資料")).toBe(true);
    expect(isExcludedTactiqMetadataFile("產品週會")).toBe(false);
  });

  it("scores title match for Chinese event names", () => {
    expect(scoreTranscriptTitleMatch("產品週會", "產品週會")).toBe(100);
    expect(scoreTranscriptTitleMatch("產品週會 會議記錄", "產品週會")).toBe(80);
    expect(scoreTranscriptTitleMatch("其他會議", "產品週會")).toBe(0);
  });

  it("picks file matching event title when multiple in window", () => {
    const picked = pickBestTranscript(
      [
        file({
          fileId: "a",
          name: "其他討論",
          modifiedTime: "2026-05-16T11:00:00.000Z",
        }),
        file({
          fileId: "b",
          name: "產品週會",
          modifiedTime: "2026-05-16T10:00:00.000Z",
        }),
      ],
      {
        excludedFileIds: new Set(),
        referenceTime: new Date("2026-05-16T10:30:00.000Z"),
        eventTitle: "產品週會",
      }
    );

    expect(picked?.fileId).toBe("b");
  });

  it("falls back to closest modifiedTime when no title match", () => {
    const ref = new Date("2026-05-16T10:30:00.000Z");
    const picked = pickBestTranscript(
      [
        file({
          fileId: "a",
          name: "會議 A",
          modifiedTime: "2026-05-16T10:25:00.000Z",
        }),
        file({
          fileId: "b",
          name: "會議 B",
          modifiedTime: "2026-05-16T09:00:00.000Z",
        }),
      ],
      {
        excludedFileIds: new Set(),
        referenceTime: ref,
        eventTitle: "不存在的標題",
      }
    );

    expect(picked?.fileId).toBe("a");
  });
});
