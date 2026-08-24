import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { ClipboardCheck, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { availableOf, type StockRecord, type BuildDef } from './inventoryData';

const allocateSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  buildId: z.string().min(1, 'Select a build'),
});

type AllocateFormData = z.infer<typeof allocateSchema>;

export interface AllocateStockInput {
  buildId: string;
  quantity: number;
}

export interface AllocatableBuildEntry {
  build: BuildDef;
  required: number;
  allocated: number;
}

interface AllocateStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  record: StockRecord | null;
  builds: AllocatableBuildEntry[];
  onAllocate: (input: AllocateStockInput) => void;
}

export function AllocateStockDialog({ isOpen, onClose, record, builds, onAllocate }: AllocateStockDialogProps) {
  const isMobile = useIsMobile();
  const allocatableBuilds = builds.filter((e) => e.build.status !== 'kitted');

  const form = useForm<AllocateFormData>({
    resolver: zodResolver(allocateSchema),
    defaultValues: { quantity: 1, buildId: '' },
  });

  useEffect(() => {
    if (isOpen) form.reset({ quantity: 1, buildId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record?.id]);

  const available = record ? availableOf(record) : 0;

  const selectedBuildId = form.watch('buildId');
  const selectedEntry = allocatableBuilds.find((e) => e.build.id === selectedBuildId);
  // Quantity always mirrors the build's outstanding requirement (capped by what's actually
  // free at this location) — it isn't a free-typed number, so there's no way to over- or
  // under-allocate relative to what the build still needs.
  const outstandingForSelected = selectedEntry ? Math.max(0, selectedEntry.required - selectedEntry.allocated) : 0;
  const defaultQuantity = Math.min(outstandingForSelected, available);

  useEffect(() => {
    if (selectedBuildId) form.setValue('quantity', Math.max(0, defaultQuantity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuildId, defaultQuantity]);

  if (!record) return null;

  const handleSubmit = (data: AllocateFormData) => {
    if (data.quantity > available) {
      form.setError('quantity', { message: `Only ${available} available to allocate` });
      return;
    }
    onAllocate({ buildId: data.buildId, quantity: data.quantity });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0'
            : 'max-w-md max-h-[90vh]'
        )}
      >
        <DialogHeader className="px-4 sm:px-6 py-4 pr-10 border-b shrink-0 flex-row items-start gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>Allocate stock</DialogTitle>
            <DialogDescription className="truncate">
              {record.pn} — {record.name} · {record.location}
            </DialogDescription>
          </div>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="p-4 sm:p-6 space-y-5">
                <p className="text-xs text-muted-foreground">
                  Available at {record.location}: <span className="font-medium text-foreground">{available}</span>
                </p>

                {allocatableBuilds.length === 0 ? (
                  <p className="text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
                    No open builds to allocate against. Create a build first from the Builds tab.
                  </p>
                ) : (
                  <FormField
                    control={form.control}
                    name="buildId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Build <span className="text-destructive" aria-hidden="true">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a build..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allocatableBuilds.map((e) => (
                              <SelectItem key={e.build.id} value={e.build.id}>{e.build.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Quantity <span className="text-destructive" aria-hidden="true">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" readOnly disabled {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {selectedEntry
                          ? `Set to the build's outstanding requirement (capped by what's available here).`
                          : 'Select a build to set the quantity.'}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={available <= 0 || allocatableBuilds.length === 0 || !selectedBuildId || defaultQuantity <= 0}
              >
                Allocate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
