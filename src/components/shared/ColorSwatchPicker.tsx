import { useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (value: string) => void;
}

/** Full hue/saturation spectrum color picker with a hex input — pick any color, not just presets. */
export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm hover:bg-accent/50"
        >
          <span className="w-4 h-4 rounded-full shrink-0 border border-border" style={{ backgroundColor: value }} />
          <span className="font-mono uppercase text-muted-foreground">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <HexColorPicker color={value} onChange={onChange} />
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            className="w-full h-8 px-2 rounded-md border border-input bg-transparent text-sm font-mono uppercase outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
