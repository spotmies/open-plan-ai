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

const issueSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  destination: z.string().min(1, 'Destination is required').max(500),
  reasonCode: z.string().min(1, 'Reason is required').max(200),
});

type IssueFormData = z.infer<typeof issueSchema>;

export interface IssueStockInput {
  partId: string;
  location: string;
  quantity: number;
  reference: string;
  reasonCode: string;
}

interface IssueStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  record: StockRecord | null;
  onIssue: (input: IssueStockInput) => void;
}

export function IssueStockDialog({ isOpen, onClose, orgId, record, onIssue }: IssueStockDialogProps) {
  const isMobile = useIsMobile();
  const { data: knownLocations = [] } = useLocations(orgId);

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: { quantity: 1, destination: '', reasonCode: '' },
  });

  useEffect(() => {
    if (isOpen) form.reset({ quantity: 1, destination: '', reasonCode: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record?.id]);

  if (!record) return null;
  const available = availableOf(record);

  const handleSubmit = (data: IssueFormData) => {
    if (data.quantity > available) {
      form.setError('quantity', { message: `Only ${available} available to issue` });
      return;
    }
    onIssue({
      partId: record.partId,
      location: record.location,
      quantity: data.quantity,
      reference: data.destination.trim(),
      reasonCode: data.reasonCode.trim(),
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
            <DialogTitle>Issue stock</DialogTitle>
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

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Quantity <span className="text-destructive" aria-hidden="true">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={available} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destination"
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
                  name="reasonCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Reason <span className="text-destructive" aria-hidden="true">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Consumed on bench build" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={available <= 0}>Issue stock</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
