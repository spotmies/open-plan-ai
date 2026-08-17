import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ToolStatusEntry } from '../hooks/useAssistantConversation';

const TOOL_PHASES: Record<string, string> = {
  query_project_data: 'Scanning your project…',
  search_project_files: 'Searching your files…',
  read_project_file: 'Reading your file…',
  present_card: 'Crafting your answer…',
};

// Shown before any tool call has landed yet, or in the gap between two —
// there's no real event to key off of there, so it just cycles on a timer.
const IDLE_PHASES = ['Thinking…', 'Reading your request…', 'Putting it together…'];

export function AssistantStatusLine({ toolStatus }: { toolStatus: ToolStatusEntry[] }) {
  const [idleIndex, setIdleIndex] = useState(0);
  const activeTool = [...toolStatus].reverse().find((entry) => !entry.done);

  useEffect(() => {
    if (activeTool) return;
    const interval = setInterval(() => setIdleIndex((i) => (i + 1) % IDLE_PHASES.length), 1600);
    return () => clearInterval(interval);
  }, [activeTool]);

  const label = activeTool ? TOOL_PHASES[activeTool.tool] ?? 'Working on it…' : IDLE_PHASES[idleIndex];

  return (
    <div className="flex items-center gap-1.5 pl-9 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
