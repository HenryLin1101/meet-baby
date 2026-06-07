"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
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
  /** When true, render the dropdown popover into document.body so it escapes
   *  scrollable / clipped ancestors (e.g. dialog containers with overflow:auto). */
  usePortal?: boolean;
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
  usePortal = false,
}: MemberMultiSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalRect, setPortalRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  // 點擊元件外部時收起懸浮選單。Portal 模式下面板不在 containerRef 內，
  // 因此也要排除點擊在面板上的情況。
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // 在 portal 模式時，根據觸發元素位置定位浮動面板，並於捲動 / 縮放時跟隨。
  // 使用 useLayoutEffect 確保面板在第一次 paint 前已測得正確座標，避免閃爍。
  // 若下方空間不足以容納面板，會自動翻轉到觸發元素上方開啟（避免擋住送出鍵）。
  // 關閉時不必清空 portalRect — 面板透過 isOpen 條件移除，下次開啟也會立刻被覆寫。
  useLayoutEffect(() => {
    if (!usePortal || !isOpen) return;
    function updateRect() {
      const node = containerRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const spaceBelow = viewportHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const maxCap = compact ? 224 : 288; // 14rem / 18rem assuming 16px base
      const flip = spaceAbove > spaceBelow && spaceAbove > 80;
      const maxHeight = Math.max(80, Math.min(maxCap, flip ? spaceAbove : spaceBelow));
      const top = flip ? r.top - maxHeight - 6 : r.bottom + 6;
      setPortalRect({ top, left: r.left, width: r.width, maxHeight });
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [usePortal, isOpen, compact]);

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
    } else {
      onChange([...selectedIds, nextUserId]);
    }
    // 點選後清空搜尋條件，但保持選單開啟方便連續選取
    setQuery("");
    inputRef.current?.focus();
  }

  function removeMember(userId: number, event: MouseEvent) {
    event.stopPropagation(); // 避免觸發外層的 onClick
    const nextUserId = String(userId);
    onChange(selectedIds.filter((id) => id !== nextUserId));
  }

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      onClick={() => {
        if (!disabled) {
          setIsOpen(true);
          inputRef.current?.focus();
        }
      }}
    >
      {/* 整合標籤與輸入框的容器 */}
      <div
        style={{
          ...comboboxStyle,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          borderColor: isOpen ? `rgba(${T.accentRgb}, 0.8)` : T.surfaceBorder,
          boxShadow: isOpen ? `0 0 0 3px rgba(${T.accentRgb}, 0.15)` : T.shadowCard,
        }}
      >
        {selectedMembers.map((member) => (
          <span
            key={member.userId}
            style={chipStyle}
            onClick={(e) => !disabled && removeMember(member.userId, e)}
          >
            <MemberAvatar
              displayName={member.displayName}
              pictureUrl={member.pictureUrl}
              size={20}
            />
            <span style={chipTextStyle}>{member.displayName}</span>
            <span style={chipRemoveIconStyle}>×</span>
          </span>
        ))}

        <input
          ref={inputRef}
          style={bareInputStyle}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedMembers.length === 0 ? "搜尋並加入參與者..." : ""}
          disabled={disabled}
        />
      </div>

      {/* 懸浮選單 (Popover) — Portal 模式下，等到位置量測完成才渲染，避免閃爍。 */}
      {isOpen && !disabled && (!usePortal || portalRect !== null) && (() => {
        const panel = (
          <div
            ref={panelRef}
            style={
              usePortal && portalRect
                ? {
                    ...floatingPanelStyle,
                    position: "fixed",
                    top: portalRect.top,
                    left: portalRect.left,
                    width: portalRect.width,
                    maxHeight: portalRect.maxHeight,
                    zIndex: 10000,
                  }
                : {
                    ...floatingPanelStyle,
                    maxHeight: compact ? "14rem" : "18rem",
                  }
            }
          >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMember(member.userId);
                    }}
                  >
                    <MemberAvatar
                      displayName={member.displayName}
                      pictureUrl={member.pictureUrl}
                      size={32}
                    />
                    <span style={optionTitleStyle}>{member.displayName}</span>
                    {isSelected && <span style={checkIconStyle}>✓</span>}
                  </button>
                );
              })
            ) : (
              <div style={emptyStateStyle}>找不到符合條件的成員。</div>
            )}
          </div>
        );
        return usePortal && typeof document !== "undefined"
          ? createPortal(panel, document.body)
          : panel;
      })()}
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────── */

const wrapperStyle: CSSProperties = {
  position: "relative", // 讓內部的選單可以 absolute 定位
  width: "100%",
};

const comboboxStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.4rem",
  width: "100%",
  minHeight: "2.85rem",
  padding: "0.4rem 0.6rem",
  background: "#fafbfc",
  border: `1px solid ${T.surfaceBorder}`,
  borderRadius: "16px",
  transition: "all 150ms ease",
  boxSizing: "border-box",
};

const bareInputStyle: CSSProperties = {
  flex: "1 1 80px",
  minWidth: 0,
  border: "none",
  background: "transparent",
  outline: "none",
  fontSize: "0.95rem",
  color: T.text,
  padding: "0.3rem",
  margin: 0,
  fontFamily: "inherit",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.2rem 0.4rem 0.2rem 0.2rem",
  borderRadius: "999px",
  border: `1px solid rgba(${T.accentRgb}, 0.35)`,
  background: `rgba(${T.accentRgb}, 0.1)`,
  color: T.text,
  cursor: "pointer",
  transition: "all 120ms ease",
};

const chipTextStyle: CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const chipRemoveIconStyle: CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1,
  color: `rgba(${T.accentRgb}, 0.8)`,
  padding: "0 0.2rem",
};

const floatingPanelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)", // 浮動在輸入框正下方
  left: 0,
  right: 0,
  zIndex: 1000,           // 確保蓋過其他表單欄位
  padding: "0.4rem",
  borderRadius: "16px",
  background: T.surface,
  border: `1px solid ${T.surfaceBorder}`,
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
  overflowY: "auto",
};

const optionStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "12px",
  border: "none",
  background: "transparent",
  color: T.text,
  textAlign: "left",
  cursor: "pointer",
  transition: "background 120ms ease",
  WebkitTapHighlightColor: "transparent",
};

const selectedOptionStyle: CSSProperties = {
  background: `rgba(${T.accentRgb}, 0.08)`,
};

const optionTitleStyle: CSSProperties = {
  flex: 1,
  fontSize: "0.95rem",
  fontWeight: 600,
  color: T.text,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const checkIconStyle: CSSProperties = {
  color: `rgb(${T.accentRgb})`,
  fontSize: "1.1rem",
  fontWeight: 800,
};

const emptyStateStyle: CSSProperties = {
  padding: "1rem",
  color: T.textMuted,
  fontSize: "0.88rem",
  textAlign: "center",
};