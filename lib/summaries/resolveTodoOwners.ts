import type { ActionItem } from "@/lib/ai/openai";

export type TodoOwnerCandidate = {
  userId: number;
  displayName: string;
  email: string | null;
  googleDisplayName: string | null;
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

function tokenMatchesName(token: string, part: string): boolean {
  if (!token || !part) return false;
  return token === part || token.startsWith(part) || part.startsWith(token);
}

function emailMatchesOwner(ownerParts: string[], email: string): boolean {
  const tokens = emailLocalTokens(email);
  if (tokens.length === 0 || ownerParts.length === 0) return false;

  if (ownerParts.length === 1) {
    return tokens.some((token) => tokenMatchesName(token, ownerParts[0]!));
  }

  const first = ownerParts[0]!;
  const last = ownerParts[ownerParts.length - 1]!;
  const firstMatch = tokens.some((token) => tokenMatchesName(token, first));
  const lastMatch = tokens.some((token) => tokenMatchesName(token, last));
  return firstMatch && lastMatch;
}

function matchesNameLabel(label: string, ownerLower: string, ownerNorm: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  const labelLower = trimmed.toLowerCase();
  if (labelLower === ownerLower) return true;
  return normalizeName(trimmed) === ownerNorm;
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

  for (const member of members) {
    if (matchesNameLabel(member.displayName, ownerLower, ownerNorm)) {
      return member;
    }
    if (
      member.googleDisplayName &&
      matchesNameLabel(member.googleDisplayName, ownerLower, ownerNorm)
    ) {
      return member;
    }
  }

  if (ownerParts.length > 0) {
    const partMatches = members.filter((member) => {
      const labels = [member.displayName, member.googleDisplayName]
        .filter((label): label is string => Boolean(label?.trim()))
        .map((label) => label.toLowerCase());
      return labels.some((label) => ownerParts.every((part) => label.includes(part)));
    });
    if (partMatches.length === 1) return partMatches[0];
  }

  const emailMatches = members.filter(
    (member) => member.email && emailMatchesOwner(ownerParts, member.email)
  );
  if (emailMatches.length === 1) return emailMatches[0];

  const partial = members.filter((member) => {
    const labels = [member.displayName, member.googleDisplayName]
      .filter((label): label is string => Boolean(label?.trim()))
      .map((label) => label.toLowerCase());
    return labels.some(
      (label) => label.includes(ownerLower) || ownerLower.includes(label)
    );
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
