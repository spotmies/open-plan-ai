import { describe, it, expect } from 'vitest';
import type { EditorBlock } from '@/components/ui/SlashBlockEditor';
import {
  blocksToPlainText,
  hasBlockContent,
  plainTextToBlocks,
  serializeBlocksForDirtyCheck,
} from '@/lib/descriptionBlocks';

const block = (partial: Partial<EditorBlock>): EditorBlock => ({
  id: 'b',
  type: 'text',
  content: '',
  ...partial,
});

describe('plainTextToBlocks', () => {
  it('seeds one text block per line', () => {
    const blocks = plainTextToBlocks('first\nsecond');
    expect(blocks.map(b => ({ type: b.type, content: b.content }))).toEqual([
      { type: 'text', content: 'first' },
      { type: 'text', content: 'second' },
    ]);
  });

  it('gives every seeded block a distinct id', () => {
    const ids = plainTextToBlocks('a\nb\nc').map(b => b.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('returns nothing for empty or whitespace-only text', () => {
    expect(plainTextToBlocks('')).toEqual([]);
    expect(plainTextToBlocks('   \n  ')).toEqual([]);
    expect(plainTextToBlocks(undefined)).toEqual([]);
  });

  it('normalises CRLF line endings', () => {
    expect(plainTextToBlocks('a\r\nb')).toHaveLength(2);
  });
});

describe('blocksToPlainText', () => {
  it('flattens headings and text', () => {
    expect(
      blocksToPlainText([
        block({ type: 'h1', content: 'Title' }),
        block({ type: 'text', content: 'Body' }),
      ])
    ).toBe('Title\nBody');
  });

  it('prefixes list blocks and numbers them in sequence', () => {
    expect(
      blocksToPlainText([
        block({ type: 'bullet', content: 'one' }),
        block({ type: 'number', content: 'step a' }),
        block({ type: 'number', content: 'step b' }),
        block({ type: 'check', content: 'done', checked: true }),
        block({ type: 'check', content: 'todo' }),
      ])
    ).toBe('- one\n1. step a\n2. step b\n[x] done\n[ ] todo');
  });

  it('uses the caption for media blocks, falling back to a type marker', () => {
    expect(blocksToPlainText([block({ type: 'image', content: 'blob:x', caption: 'Wiring' })])).toBe('Wiring');
    expect(blocksToPlainText([block({ type: 'image', content: 'blob:x' })])).toBe('[image]');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(blocksToPlainText([])).toBe('');
    expect(blocksToPlainText(undefined)).toBe('');
    expect(blocksToPlainText([block({ content: '   ' })])).toBe('');
  });

  it('round-trips plain text through the block form', () => {
    const text = 'Steps to reproduce\nOpen the modal';
    expect(blocksToPlainText(plainTextToBlocks(text))).toBe(text);
  });
});

describe('hasBlockContent', () => {
  it('ignores the empty starter block the editor mounts with', () => {
    expect(hasBlockContent([block({ content: '' })])).toBe(false);
    expect(hasBlockContent([])).toBe(false);
    expect(hasBlockContent(undefined)).toBe(false);
  });

  it('detects real content', () => {
    expect(hasBlockContent([block({ content: '' }), block({ content: 'x' })])).toBe(true);
  });
});

describe('serializeBlocksForDirtyCheck', () => {
  it('changes when the content changes', () => {
    const before = serializeBlocksForDirtyCheck([block({ content: 'a' })]);
    const after = serializeBlocksForDirtyCheck([block({ content: 'b' })]);
    expect(before).not.toBe(after);
  });

  it('ignores the generated ids so a re-seed is not a phantom edit', () => {
    const a = serializeBlocksForDirtyCheck([block({ id: 'block-1', content: 'same' })]);
    const b = serializeBlocksForDirtyCheck([block({ id: 'block-2', content: 'same' })]);
    expect(a).toBe(b);
  });
});
