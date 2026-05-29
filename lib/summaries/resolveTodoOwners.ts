import type { ActionItem } from "@/lib/ai/openai";

export type TodoOwnerCandidate = {
  userId: number;
  displayName: string;
  email: string | null;
};

export type ResolvedActionItem = ActionItem & {
  assignedUserIds: number[];
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function emailLocalPart(email: string): string {
  return email.split("@")[0]?.trim().toLowerCase() ?? "";
}

function emailLocalTokens(email: string): string[] {
  return emailLocalPart(email)
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function matchOwnerToLineMember(
  owner: string,
  members: TodoOwnerCandidate[]
): TodoOwnerCandidate | null {
  const trimmed = owner.trim();
  if (!trimmed || members.length === 0) return null;

  const ownerLower = trimmed.toLowerCase();
  const ownerNorm = normalizeName(trimmed);
  const ownerParts = ownerLower.split(/\s+/).filter(Boolean);

  const exact = members.find(
    (member) => member.displayName.trim().toLowerCase() === ownerLower
  );
  if (exact) return exact;

  const normalized = members.find(
    (member) => normalizeName(member.displayName) === ownerNorm
  );
  if (normalized) return normalized;

  if (ownerParts.length > 0) {
    const partMatches = members.filter((member) => {
      const displayLower = member.displayName.toLowerCase();
      return ownerParts.every((part) => displayLower.includes(part));
    });
    if (partMatches.length === 1) return partMatches[0];
  }

  for (const member of members) {
    if (!member.email) continue;
    const localNorm = normalizeName(emailLocalPart(member.email));
    if (localNorm && localNorm === ownerNorm) return member;

    const tokens = emailLocalTokens(member.email);
    if (
      ownerParts.length >= 2 &&
      tokens.length >= 2 &&
      ownerParts[0] === tokens[0] &&
      ownerParts[ownerParts.length - 1] === tokens[tokens.length - 1]
    ) {
      return member;
    }
  }

  const partial = members.filter((member) => {
    const displayLower = member.displayName.toLowerCase();
    return displayLower.includes(ownerLower) || ownerLower.includes(displayLower);
  });
  if (partial.length === 1) return partial[0];

  return null;
}

export function resolveActionItemOwners(
  items: ActionItem[],
  members: TodoOwnerCandidate[]
): ResolvedActionItem[] {
  const ownerDisplayCache = new Map<string, string>();
  const ownerUserCache = new Map<string, number>();

  return items.map((item) => {
    const rawOwner = item.owner.trim();
    if (!rawOwner) {
      return { ...item, owner: "", assignedUserIds: [] };
    }

    let displayName = ownerDisplayCache.get(rawOwner);
    let userId = ownerUserCache.get(rawOwner);

    if (!displayName) {
      const matched = matchOwnerToLineMember(rawOwner, members);
      displayName = matched?.displayName ?? rawOwner;
      ownerDisplayCache.set(rawOwner, displayName);
      if (matched) {
        userId = matched.userId;
        ownerUserCache.set(rawOwner, matched.userId);
      }
    }

    return {
      ...item,
      owner: displayName,
      assignedUserIds: userId !== undefined ? [userId] : [],
    };
  });
}
