import type { EditorBlock } from '@/components/ui/SlashBlockEditor';

/**
 * Conversions between the two description representations a task/issue can hold:
 *
 *  - `description`        — plain text, the simple editor. Every list, card,
 *                           board preview, search index and export reads this.
 *  - `descriptionBlocks`  — the Advanced Editor's block array.
 *
 * The two used to drift apart: switching the Advanced Editor on left the text
 * the user had just typed behind (and invisible), and edits made only in the
 * block editor never reached `description`, so nothing outside the modal ever
 * reflected them — the save looked like it hadn't happened. Keeping the plain
 * text mirrored from the blocks makes both halves agree wherever they're shown.
 */

const listPrefix = (block: EditorBlock, index: number, blocks: EditorBlock[]): string => {
  switch (block.type) {
    case 'bullet':
      return '- ';
    case 'number': {
      let position = 1;
      for (let i = index - 1; i >= 0; i--) {
        if (blocks[i].type !== 'number') break;
        position++;
      }
      return `${position}. `;
    }
    case 'check':
      return block.checked ? '[x] ' : '[ ] ';
    default:
      return '';
  }
};

/** Flatten blocks into the plain-text form shown on cards, lists and previews. */
export function blocksToPlainText(blocks?: EditorBlock[] | null): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  return blocks
    .map((block, index) => {
      if (!block) return '';
      if (block.type === 'image' || block.type === 'video' || block.type === 'audio') {
        // Media lives at a URL (or an object URL that dies with the tab) — keep
        // the caption when there is one so the text form still says something.
        return block.caption?.trim() || (block.content ? `[${block.type}]` : '');
      }
      const content = (block.content || '').trim();
      if (!content) return '';
      return `${listPrefix(block, index, blocks)}${content}`;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Seed the block editor from plain text — one text block per line. */
export function plainTextToBlocks(text?: string | null): EditorBlock[] {
  const value = (text || '').replace(/\r\n/g, '\n');
  if (!value.trim()) return [];

  const stamp = Date.now();
  return value.split('\n').map((line, index) => ({
    id: `block-${stamp}-${index}`,
    type: 'text' as const,
    content: line,
  }));
}

/** True when the blocks hold anything worth keeping (text or media). */
export function hasBlockContent(blocks?: EditorBlock[] | null): boolean {
  if (!Array.isArray(blocks)) return false;
  return blocks.some((block) => !!block && !!(block.content || '').trim());
}

/**
 * Stable serialisation for the modals' dirty checks. Block ids are generated
 * from `Date.now()` so they can't take part in the comparison.
 */
export function serializeBlocksForDirtyCheck(blocks?: EditorBlock[] | null): string {
  if (!Array.isArray(blocks)) return '';
  return JSON.stringify(
    blocks.map((block) => ({
      type: block?.type ?? 'text',
      content: block?.content ?? '',
      caption: block?.caption ?? '',
      checked: block?.checked ?? false,
    }))
  );
}
