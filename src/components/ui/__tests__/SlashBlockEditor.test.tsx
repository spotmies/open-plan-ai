import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlashBlockEditor, EditorBlock } from '@/components/ui/SlashBlockEditor';

// The editor keeps its own copy of the blocks. These cover the seam where an
// external caller replaces `initialBlocks` — switching Advanced Editor on seeds
// it from the plain description — without letting that clobber live typing.
describe('SlashBlockEditor', () => {
  it('emits the typed content', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SlashBlockEditor onChange={onChange} />);

    await user.type(screen.getByPlaceholderText("Type '/' for commands"), 'hi');

    const last = onChange.mock.calls.at(-1)?.[0] as EditorBlock[];
    expect(last.map(b => b.content)).toEqual(['hi']);
  });

  it('adopts blocks seeded from outside after mount', async () => {
    const { rerender } = render(<SlashBlockEditor initialBlocks={[]} />);

    rerender(
      <SlashBlockEditor
        initialBlocks={[{ id: 'seed-0', type: 'text', content: 'seeded from plain text' }]}
      />
    );

    expect(await screen.findByDisplayValue('seeded from plain text')).toBeInTheDocument();
  });

  it('does not reset when the caller echoes back the array it just emitted', async () => {
    const user = userEvent.setup();
    let emitted: EditorBlock[] | undefined;

    const { rerender } = render(
      <SlashBlockEditor onChange={(blocks) => { emitted = blocks; }} />
    );

    await user.type(screen.getByPlaceholderText("Type '/' for commands"), 'draft');
    // Mirrors a parent storing onChange's array in state and passing it back.
    rerender(<SlashBlockEditor initialBlocks={emitted} onChange={(blocks) => { emitted = blocks; }} />);

    expect(screen.getByDisplayValue('draft')).toBeInTheDocument();
  });
});
