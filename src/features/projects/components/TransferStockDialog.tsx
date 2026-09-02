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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocations } from '@/hooks/useLocations';
import { availableOf, LocationCombobox, type StockRecord } from './inventoryData';

const transferSchema = z
  .object({
    toLocation: z.string().min(1, 'Select a destination location'),
    note: z.string().max(500, 'Note must be less than 500 characters').optional(),
  });

type TransferFormData = z.infer<typeof transferSchema>;

export interface TransferStockInput {
  partId: string;
  fromLocation: string;
  toLocation: string;
  note?: string;
}

interface TransferStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  record: StockRecord | null;
  onTransfer: (input: TransferStockInput) => void;
}

export function TransferStockDialog({ isOpen, onClose, orgId, record, onTransfer }: TransferStockDialogProps) {
  const isMobile = useIsMobile();
  const { data: knownLocations = [] } = useLocations(orgId);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { toLocation: '', note: '' },
  });

  useEffect(() => {
    if (isOpen) form.reset({ toLocation: '', note: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record?.id]);

  if (!record) return null;
  const available = availableOf(record);

  const handleSubmit = (data: TransferFormData) => {
    if (available <= 0) return;
    if (data.toLocation === record.location) {
      form.setError('toLocation', { message: 'Destination must differ from the current location' });
      return;
    }
    // A transfer moves the whole available quantity at the source — the user picks a
    // destination, not an amount. The backend recomputes and moves the exact available qty.
    onTransfer({
      partId: record.partId,
      fromLocation: record.location,
      toLocation: data.toLocation,
      note: data.note?.trim() || undefined,
    });
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
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>Transfer stock</DialogTitle>
            <DialogDescription className="truncate">
              {record.pn} — {record.name} · from {record.location}
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
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {available > 0 ? (
                    <>
                      Relocates this part from <span className="font-medium text-foreground">{record.location}</span> to the
                      destination below. Its <span className="font-medium text-foreground">whole stock row</span> moves —
                      on&#8209;hand{(record.allocated > 0 || (record.quarantineQty ?? 0) > 0) && <>, allocated and quarantined</>}{' '}
                      units all travel with it, and the part keeps a single stock location.
                    </>
                  ) : (
                    <>No available stock at <span className="font-medium text-foreground">{record.location}</span> to transfer.</>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="toLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Destination location <span className="text-destructive" aria-hidden="true">*</span>
                      </FormLabel>
                      <FormControl>
                        <LocationCombobox value={field.value} onChange={field.onChange} knownLocations={knownLocations} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Note <span className="normal-case font-normal">optional</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional note..." className="min-h-[70px] resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={available <= 0}>Transfer stock</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
