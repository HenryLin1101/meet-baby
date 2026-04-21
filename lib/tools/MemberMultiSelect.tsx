"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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
    background:
      "linear-gradient(135deg, rgba(158, 238, 255, 0.34) 0%, rgba(116, 216, 242, 0.22) 100%)",
    color: "#d8f8ff",
    fontSize: size <= 28 ? "0.72rem" : "0.8rem",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 8px 18px rgba(10, 16, 24, 0.2)",
  };

  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt={displayName}
        style={{ ...avatarStyle, objectFit: "cover" }}
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
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

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
        aria-expanded={isOpen}
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

      {isOpen && (
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
  background:
    "linear-gradient(180deg, rgba(236, 242, 248, 0.1) 0%, rgba(236, 242, 248, 0.06) 100%)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: "16px",
  color: "var(--text)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const triggerLabelStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--muted)",
  marginBottom: "0.2rem",
};

const triggerValueStyle: CSSProperties = {
  fontSize: "0.98rem",
  fontWeight: 600,
};

const triggerMetaStyle: CSSProperties = {
  fontSize: "0.82rem",
  color: "#8ce1e6",
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
  border: "1px solid rgba(158, 238, 255, 0.18)",
  background: "rgba(158, 238, 255, 0.08)",
  color: "var(--text)",
};

const chipTextStyle: CSSProperties = {
  fontSize: "0.86rem",
  lineHeight: 1.2,
};

const panelStyle: CSSProperties = {
  padding: "0.8rem",
  borderRadius: "18px",
  background:
    "linear-gradient(180deg, rgba(21, 30, 42, 0.96) 0%, rgba(15, 22, 31, 0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 34px rgba(5, 10, 16, 0.28)",
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.72rem 0.85rem",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(236, 242, 248, 0.08)",
  color: "var(--text)",
  fontSize: "0.95rem",
};

const optionListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  overflowY: "auto",
};

const optionStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.7rem 0.8rem",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--text)",
  textAlign: "left",
};

const selectedOptionStyle: CSSProperties = {
  border: "1px solid rgba(140, 225, 230, 0.3)",
  background: "rgba(140, 225, 230, 0.12)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
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
};

const optionSubtleStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--muted)",
};

const selectionPillStyle: CSSProperties = {
  padding: "0.25rem 0.55rem",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.08)",
  color: "#d8f8ff",
  fontSize: "0.76rem",
  whiteSpace: "nowrap",
};

const emptyStateStyle: CSSProperties = {
  padding: "0.8rem",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.03)",
  color: "var(--muted)",
  fontSize: "0.88rem",
  textAlign: "center",
};
