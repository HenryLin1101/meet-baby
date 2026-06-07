import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/google/oauth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: "user-token-xyz" }),
}));

describe("copyFileToFolder", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "copied-file-id-789" }),
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("calls Drive copy API with correct fileId and target folder", async () => {
    const { copyFileToFolder } = await import("@/lib/google/drive");
    const newFileId = await copyFileToFolder({
      fileId: "source-file-id",
      folderId: "target-folder-id",
      refreshToken: "rt-abc",
    });

    expect(newFileId).toBe("copied-file-id-789");
    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/source-file-id/copy?supportsAllDrives=true",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-token-xyz",
          "Content-Type": "application/json",
        }),
      })
    );
    const callBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string;
    expect(JSON.parse(callBody)).toEqual({ parents: ["target-folder-id"] });
  });

  it("throws when Drive copy API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "File not found" } }),
      })
    );
    const { copyFileToFolder } = await import("@/lib/google/drive");
    await expect(
      copyFileToFolder({ fileId: "bad-id", folderId: "f", refreshToken: "rt" })
    ).rejects.toThrow("File not found");
  });
});
