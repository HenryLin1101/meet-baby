import { describe, expect, it } from "vitest";
import {
  matchOwnerToLineMember,
  resolveActionItemOwners,
  type TodoOwnerCandidate,
} from "@/lib/summaries/resolveTodoOwners";

const members: TodoOwnerCandidate[] = [
  { userId: 1, displayName: "Henry Lin", email: "henry.lin@example.com" },
  { userId: 2, displayName: "王小明", email: null },
  { userId: 3, displayName: "Amy Chen", email: "amy.chen@example.com" },
];

describe("matchOwnerToLineMember", () => {
  it("matches exact LINE display name", () => {
    expect(matchOwnerToLineMember("王小明", members)?.userId).toBe(2);
  });

  it("matches Google-style name via email local part", () => {
    expect(matchOwnerToLineMember("Henry Lin", members)?.userId).toBe(1);
  });

  it("returns null when ambiguous or unknown", () => {
    expect(matchOwnerToLineMember("Unknown Person", members)).toBeNull();
  });
});

describe("resolveActionItemOwners", () => {
  it("rewrites owner to LINE display name and assigns user id", () => {
    const resolved = resolveActionItemOwners(
      [
        { owner: "henry.lin", item: "跑模型測試", due: "" },
        { owner: "未知同事", item: "整理文件", due: "" },
      ],
      members
    );

    expect(resolved[0]?.owner).toBe("Henry Lin");
    expect(resolved[0]?.assignedUserIds).toEqual([1]);
    expect(resolved[1]?.owner).toBe("未知同事");
    expect(resolved[1]?.assignedUserIds).toEqual([]);
  });
});
