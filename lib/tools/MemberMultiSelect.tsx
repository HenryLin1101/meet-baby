"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { LIFF_UI_THEME as T } from "@/lib/liff/liffUiTheme";

export type MemberMultiSelectMember = {
  userId: number;
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

type MemberMultiSelectProps = {
  members: MemberMultiSelectMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
};

function getAvatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}

function MemberAvatar({
  displayName,
  pictureUrl,
  size = 36,
}: {
  displayName: string;
  pictureUrl: string | null;
  size?: number;
}) {
  const avatarStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: "999px",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, rgba(${T.accentRgb}, 0.18) 0%, rgba(${T.accentRgb}, 0.08) 100%)`,
    color: T.text,
    fontSize: size <= 28 ? "0.72rem" : "0.8rem",
    fontWeight: 700,
    border: `1px solid ${T.surfaceBorder}`,
    boxShadow: T.shadowCard,
  };

  if (pictureUrl) {
    return (
      <Image
        src={pictureUrl}
        alt={displayName}
        width={size}
        height={size}
        style={{ ...avatarStyle, objectFit: "cover" }}
        unoptimized
      />
    );
  }

  return <span style={avatarStyle}>{getAvatarInitials(displayName)}</span>;
}

export default function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
  disabled = false,
  compact = false,
}: MemberMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedIdSet.has(String(member.userId))),
    [members, selectedIdSet]
  );

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const visibleMembers = keyword
      ? members.filter((member) => {
          const displayName = member.displayName.toLowerCase();
          const lineUserId = member.lineUserId.toLowerCase();
          return displayName.includes(keyword) || lineUserId.includes(keyword);
        })
      : members;

    return [...visibleMembers].sort((left, right) => {
      const leftSelected = selectedIdSet.has(String(left.userId)) ? 1 : 0;
      const rightSelected = selectedIdSet.has(String(right.userId)) ? 1 : 0;
      if (leftSelected !== rightSelected) return rightSelected - leftSelected;
      return left.displayName.localeCompare(right.displayName, "zh-Hant");
    });
  }, [members, query, selectedIdSet]);

  function toggleMember(userId: number) {
    const nextUserId = String(userId);
    if (selectedIdSet.has(nextUserId)) {
      onChange(selectedIds.filter((id) => id !== nextUserId));
      return;
    }

    onChange([...selectedIds, nextUserId]);
  }

  return (
    <div ref={containerRef} style={wrapperStyle}>
      <button
        type="button"
        style={{
          ...triggerStyle,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onClick={() => {
          if (!disabled) setIsOpen((open) => !open);
        }}
        disabled={disabled}
        aria-expanded={isOpen && !disabled}
      >
        <div style={{ flex: 1 }}>
          <div style={triggerLabelStyle}>選擇參與者</div>
          <div style={triggerValueStyle}>
            {selectedMembers.length > 0
              ? `已選擇 ${selectedMembers.length} 位`
              : "尚未選擇任何參與者"}
          </div>
        </div>
        <span style={triggerMetaStyle}>{isOpen ? "收合" : "展開"}</span>
      </button>

      {selectedMembers.length > 0 && (
        <div style={chipListStyle}>
          {selectedMembers.map((member) => (
            <button
              key={member.userId}
              type="button"
              style={chipStyle}
              onClick={() => toggleMember(member.userId)}
              disabled={disabled}
            >
              <MemberAvatar
                displayName={member.displayName}
                pictureUrl={member.pictureUrl}
                size={28}
              />
              <span style={chipTextStyle}>{member.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && !disabled && (
        <div
          style={{
            ...panelStyle,
            maxHeight: compact ? "18rem" : "20rem",
          }}
        >
          <input
            style={searchInputStyle}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋名稱"
            disabled={disabled}
          />

          <div style={optionListStyle}>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const isSelected = selectedIdSet.has(String(member.userId));

                return (
                  <button
                    key={member.userId}
                    type="button"
                    style={{
                      ...optionStyle,
                      ...(isSelected ? selectedOptionStyle : {}),
                    }}
                    onClick={() => toggleMember(member.userId)}
                  >
                    <MemberAvatar
                      displayName={member.displayName}
                      pictureUrl={member.pictureUrl}
                    />
                    <div style={optionTextWrapStyle}>
                      <span style={optionTitleStyle}>{member.displayName}</span>
                      <span style={optionSubtleStyle}>
                        {isSelected ? "已加入參與者" : "點一下加入參與者"}
                      </span>
                    </div>
                    <span style={selectionPillStyle}>
                      {isSelected ? "已選" : "未選"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div style={emptyStateStyle}>找不到符合條件的成員。</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
};

const triggerStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "0.85rem",
  padding: "0.9rem 1rem",
  textAlign: "left",
  background: T.surface,
  border: `1px solid ${T.surfaceBorder}`,
  borderRadius: T.radiusInput,
  color: T.text,
  boxShadow: T.shadowCard,
  minHeight: "2.85rem",
  WebkitTapHighlightColor: "transparent",
};

const triggerLabelStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: T.textMuted,
  marginBottom: "0.2rem",
};

const triggerValueStyle: CSSProperties = {
  fontSize: "0.98rem",
  fontWeight: 600,
  color: T.text,
};

const triggerMetaStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: T.accent,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const chipListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.55rem",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  padding: "0.35rem 0.55rem 0.35rem 0.35rem",
  borderRadius: "999px",
  border: `1px solid rgba(${T.accentRgb}, 0.35)`,
  background: `rgba(${T.accentRgb}, 0.1)`,
  color: T.text,
  minHeight: "2.25rem",
  WebkitTapHighlightColor: "transparent",
};

const chipTextStyle: CSSProperties = {
  fontSize: "0.86rem",
  lineHeight: 1.2,
};

const panelStyle: CSSProperties = {
  padding: "0.8rem",
  borderRadius: T.radiusPanel,
  background: T.surface,
  border: `1px solid ${T.surfaceBorder}`,
  boxShadow: T.shadowPanel,
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.72rem 0.85rem",
  borderRadius: T.radiusControl,
  border: `1px solid ${T.surfaceBorder}`,
  background: T.surfaceSubtle,
  color: T.text,
  fontSize: "0.95rem",
  minHeight: "2.75rem",
  boxSizing: "border-box",
};

const optionListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  overflowY: "auto",
};

const optionStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 0.85rem",
  borderRadius: T.radiusControl,
  border: `1px solid ${T.surfaceBorder}`,
  background: T.surfaceSubtle,
  color: T.text,
  textAlign: "left",
  minHeight: "2.85rem",
  WebkitTapHighlightColor: "transparent",
};

const selectedOptionStyle: CSSProperties = {
  border: `1px solid rgba(${T.accentRgb}, 0.5)`,
  background: `rgba(${T.accentRgb}, 0.1)`,
  boxShadow: T.shadowCard,
};

const optionTextWrapStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "0.14rem",
  minWidth: 0,
};

const optionTitleStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: T.text,
};

const optionSubtleStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: T.textMuted,
};

const selectionPillStyle: CSSProperties = {
  padding: "0.25rem 0.55rem",
  borderRadius: "999px",
  background: T.surfaceSubtle,
  border: `1px solid ${T.surfaceBorder}`,
  color: T.textMuted,
  fontSize: "0.76rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const emptyStateStyle: CSSProperties = {
  padding: "0.8rem",
  borderRadius: T.radiusControl,
  background: T.surfaceSubtle,
  color: T.textMuted,
  fontSize: "0.88rem",
  textAlign: "center",
};
