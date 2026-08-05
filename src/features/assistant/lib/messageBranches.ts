import type { AssistantMessage } from '../assistantData';

const ROOT_KEY = 'root';

export interface MessageVersionInfo {
  index: number;
  count: number;
  siblingIds: string[];
}

export interface MessagePath {
  path: AssistantMessage[];
  /** Keyed by message id — only present for messages whose sibling group has more than one member. */
  versions: Record<string, MessageVersionInfo>;
}

/**
 * Reconstructs the single default root→leaf path through a conversation's
 * full message tree — the frontend mirror of the backend's
 * ai-conversations.repository.ts toActivePath(). Groups by parentId (null →
 * 'root'), and at every branch point descends into the child with the max
 * createdAt (newest edit wins) unless `overrides` picks a different sibling
 * for that branch point — that's how the "< i/n >" version nav works: it
 * never touches the server, just re-walks this same tree with one entry
 * overridden.
 */
export function buildMessagePath(
  messages: AssistantMessage[],
  overrides: Record<string, string>,
): MessagePath {
  const childrenByParent = new Map<string, AssistantMessage[]>();
  for (const message of messages) {
    const key = message.parentId ?? ROOT_KEY;
    const siblings = childrenByParent.get(key);
    if (siblings) siblings.push(message);
    else childrenByParent.set(key, [message]);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const path: AssistantMessage[] = [];
  const versions: Record<string, MessageVersionInfo> = {};
  let parentKey = ROOT_KEY;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const siblings = childrenByParent.get(parentKey);
    if (!siblings || siblings.length === 0) break;

    const siblingIds = siblings.map((m) => m.id);
    const override = overrides[parentKey];
    const chosen = (override && siblings.find((m) => m.id === override)) || siblings[siblings.length - 1];

    if (siblings.length > 1) {
      versions[chosen.id] = { index: siblingIds.indexOf(chosen.id), count: siblings.length, siblingIds };
    }

    path.push(chosen);
    parentKey = chosen.id;
  }

  return { path, versions };
}

export { ROOT_KEY };
