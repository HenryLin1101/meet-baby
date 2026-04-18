/**
 * 會話狀態（多輪對話）儲存。
 *
 * 目前以行程內 Map 實作，方便本機開發；上線後可換成 Redis / DB，
 * 只要保持 getConversationState / setConversationState / clearConversationState
 * 三個介面不變即可。
 */

export type ConversationState = {
  commandName: string;
  step: string;
  data: Record<string, unknown>;
  updatedAt: number;
};

const TTL_MS = 5 * 60 * 1000;

const store = new Map<string, ConversationState>();

export function getConversationState(key: string): ConversationState | null {
  const state = store.get(key);
  if (!state) return null;
  if (Date.now() - state.updatedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return state;
}

export function setConversationState(
  key: string,
  state: Omit<ConversationState, "updatedAt">
): void {
  store.set(key, { ...state, updatedAt: Date.now() });
}

export function clearConversationState(key: string): void {
  store.delete(key);
}
