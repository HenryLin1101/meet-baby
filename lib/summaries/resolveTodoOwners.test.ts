import { describe, expect, it } from "vitest";
import {
  matchOwnerToLineMember,
  resolveActionItemOwners,
  type TodoOwnerCandidate,
} from "@/lib/summaries/resolveTodoOwners";

const members: TodoOwnerCandidate[] = [
  {
    userId: 1,
    displayName: "祐亨",
    email: "henry.lin1101@gmail.com",
    googleDisplayName: "Henry Lin",
  },
  { userId: 2, displayName: "王小明", email: null, googleDisplayName: null },
  {
    userId: 3,
    displayName: "Amy Chen",
    email: "amy.chen@example.com",
    googleDisplayName: "Amy Chen",
  },
];

describe("matchOwnerToLineMember", () => {
  it("matches Google account name to LINE user via googleDisplayName", () => {
    expect(matchOwnerToLineMember("Henry Lin", members)?.userId).toBe(1);
  });

  it("matches exact LINE display name", () => {
    expect(matchOwnerToLineMember("王小明", members)?.userId).toBe(2);
  });

  it("matches Google-style name via email local part", () => {
    expect(matchOwnerToLineMember("Henry Lin", members)?.displayName).toBe("祐亨");
  });

  it("returns null when ambiguous or unknown", () => {
    expect(matchOwnerToLineMember("Unknown Person", members)).toBeNull();
  });
});

describe("resolveActionItemOwners", () => {
  it("rewrites owner to LINE display name and assigns user id", () => {
    const resolved = resolveActionItemOwners(
      [
        { owner: "Henry Lin", item: "跑模型測試", due: "" },
        { owner: "未知同事", item: "整理文件", due: "" },
      ],
      members
    );

    expect(resolved[0]?.owner).toBe("祐亨");
    expect(resolved[0]?.assignedUserIds).toEqual([1]);
    expect(resolved[1]?.owner).toBe("未知同事");
    expect(resolved[1]?.assignedUserIds).toEqual([]);
  });
});
