import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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

  afterEach(() => vi.unstubAllGlobals());

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

describe("uploadTextAsGoogleDoc", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "new-doc-id-456" }),
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("calls Drive multipart upload with Google Doc mimeType and correct text", async () => {
    const { uploadTextAsGoogleDoc } = await import("@/lib/google/driveAdmin");
    const fileId = await uploadTextAsGoogleDoc({
      folderId: "folder-abc",
      name: "會議摘要",
      text: "重點：測試成功",
    });

    expect(fileId).toBe("new-doc-id-456");
    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fake-token",
        }),
      })
    );
    const callBody = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string;
    expect(callBody).toContain('"name":"會議摘要"');
    expect(callBody).toContain('"mimeType":"application/vnd.google-apps.document"');
    expect(callBody).toContain('"parents":["folder-abc"]');
    expect(callBody).toContain("重點：測試成功");
  });

  it("throws when Drive upload API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Forbidden" } }),
      })
    );
    const { uploadTextAsGoogleDoc } = await import("@/lib/google/driveAdmin");
    await expect(
      uploadTextAsGoogleDoc({ folderId: "f", name: "摘要", text: "t" })
    ).rejects.toThrow("Forbidden");
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
