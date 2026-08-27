import { useEffect, useState } from 'react';
import { Truck, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { BuildLine } from './inventoryData';

// Same math as the BOM Line table's "Shortfall" column (inventoryData.tsx computeCoverage /
// buildFromDef): required net of what's already allocated, on hand, and on order.
function qtyToOrder(l: BuildLine): number {
  return Math.max(0, l.required - l.allocated - l.available - l.onOrder);
}

interface GenerateShortageOrdersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  buildName: string;
  lines: BuildLine[];
  onConfirm: (partIds: string[]) => void;
  isSubmitting?: boolean;
}

export function GenerateShortageOrdersDialog({
  isOpen, onClose, buildName, lines, onConfirm, isSubmitting,
}: GenerateShortageOrdersDialogProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Every shorted line starts checked — the dialog is for excluding parts you don't want to
  // order yet, not for opting in from a blank slate.
  useEffect(() => {
    if (isOpen) setSelected(new Set(lines.map((l) => l.partId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggle = (partId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId); else next.add(partId);
      return next;
    });
  };

  const allSelected = selected.size === lines.length && lines.length > 0;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.partId)));

  const handleSubmit = () => {
    if (selected.size === 0) return;
    onConfirm([...selected]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0'
            : 'max-w-lg max-h-[85vh]'
        )}
      >
        <DialogHeader className="px-4 sm:px-6 py-4 pr-10 border-b shrink-0 flex-row items-start gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="h-4 w-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>Generate shortage → Procurement</DialogTitle>
            <DialogDescription className="truncate">
              Choose which shorted part(s) on {buildName} to order now
            </DialogDescription>
          </div>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Select all
            </label>
            <span className="text-xs text-muted-foreground">{selected.size} of {lines.length} selected</span>
          </div>

          <div className="divide-y">
            {lines.map((l) => {
              const qty = qtyToOrder(l);
              const checked = selected.has(l.partId);
              return (
                <label
                  key={l.partId}
                  className="flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(l.partId)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{l.pn}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-destructive">{qty} {l.uom}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">to order</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-4 border-t shrink-0">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="button" className="flex-1" disabled={selected.size === 0 || isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Ordering…' : `Order ${selected.size} part${selected.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
