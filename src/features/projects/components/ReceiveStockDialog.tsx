import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Download, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocations } from '@/hooks/useLocations';
import { type ApiPartResponse, type BOMCategory } from './bomData';
import { LocationCombobox, formatShortDate, type StockLocation, type OrderRecord } from './inventoryData';

const NO_ORDER_SENTINEL = '__no_order__';

const receiveSchema = z.object({
  partId: z.string().min(1, 'Select a part'),
  location: z.string().min(1, 'Select a destination location'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reference: z.string().max(60, 'Reference must be less than 60 characters').optional(),
  quarantine: z.boolean(),
  note: z.string().max(300, 'Note must be less than 300 characters').optional(),
  orderId: z.string().optional(),
  trackBy: z.enum(['lot', 'serial']),
  lotNumber: z.string().max(60, 'Lot number must be less than 60 characters').optional(),
  serialNumbers: z.array(z.string().max(60, 'Serial number must be less than 60 characters')).optional(),
}).superRefine((data, ctx) => {
  if (data.trackBy === 'serial') {
    (data.serialNumbers ?? []).forEach((sn, index) => {
      if (!sn.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a serial number for every unit', path: ['serialNumbers', index] });
      }
    });
  }
});

type ReceiveFormData = z.infer<typeof receiveSchema>;

export interface ReceiveStockInput {
  partId: string;
  pn: string;
  name: string;
  cat: BOMCategory;
  location: StockLocation;
  quantity: number;
  reference?: string;
  quarantine: boolean;
  note?: string;
  orderId?: string;
  lotNumber?: string;
  serialNumber?: string;
}

interface ReceiveStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  parts: ApiPartResponse[];
  orders: OrderRecord[];
  onReceive: (input: ReceiveStockInput) => void;
  /** Preselect a part (e.g. opened from that part's detail sheet) instead of starting on the picker. */
  initialPartId?: string;
}

export function ReceiveStockDialog({ isOpen, onClose, orgId, parts, orders, onReceive, initialPartId }: ReceiveStockDialogProps) {
  const isMobile = useIsMobile();
  const [selectedPart, setSelectedPart] = useState<ApiPartResponse | null>(null);
  const [partPickerOpen, setPartPickerOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { data: knownLocations = [] } = useLocations(orgId);

  // Receiving is a PO-fulfillment action — only parts with a remaining balance on an open
  // order are eligible to receive against here.
  const partsWithOpenOrders = useMemo(() => {
    const orderedPartIds = new Set(orders.filter(o => o.remainingQty > 0).map(o => o.partId));
    return parts.filter(p => orderedPartIds.has(p.id));
  }, [parts, orders]);

  const form = useForm<ReceiveFormData>({
    resolver: zodResolver(receiveSchema),
    defaultValues: {
      partId: '',
      location: '',
      quantity: 1,
      reference: '',
      quarantine: false,
      note: '',
      orderId: '',
      trackBy: 'lot',
      lotNumber: '',
      serialNumbers: [''],
    },
  });

  const { fields: serialFields, append: appendSerials, remove: removeSerials } = useFieldArray({
    control: form.control,
    name: 'serialNumbers',
  });

  const trackBy = form.watch('trackBy');

  const openOrdersForPart = selectedPart
    ? orders
        .filter(o => o.partId === selectedPart.id && o.remainingQty > 0)
        .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    : [];

  const watchedOrderId = form.watch('orderId');
  const watchedQuantity = form.watch('quantity');

  const selectedOrder = watchedOrderId && watchedOrderId !== NO_ORDER_SENTINEL
    ? openOrdersForPart.find(o => o.id === watchedOrderId)
    : undefined;
  const totalOnOrderForPart = openOrdersForPart.reduce((sum, o) => sum + o.remainingQty, 0);
  const maxQuantity = selectedOrder ? selectedOrder.remainingQty : totalOnOrderForPart || undefined;

  // Keep one serial-number input per unit — grows/shrinks as quantity changes while serial tracking is active.
  useEffect(() => {
    if (trackBy !== 'serial') return;
    const targetLength = Math.min(Math.max(Math.trunc(Number(watchedQuantity)) || 1, 1), 200);
    const diff = targetLength - serialFields.length;
    if (diff > 0) {
      appendSerials(Array.from({ length: diff }, () => ''));
    } else if (diff < 0) {
      removeSerials(Array.from({ length: -diff }, (_, i) => serialFields.length - 1 - i));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackBy, watchedQuantity]);

  useEffect(() => {
    // Default to the soonest-due open order (and its location) so a part with a single order
    // — the common case — needs no extra picking, while multi-order parts still get a sane default.
    if (openOrdersForPart.length > 0 && !form.getValues('orderId')) {
      const defaultOrder = openOrdersForPart[0];
      form.setValue('orderId', defaultOrder.id);
      form.setValue('location', defaultOrder.location ?? form.getValues('location'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPart, openOrdersForPart.length]);

  useEffect(() => {
    if (maxQuantity != null && watchedQuantity > maxQuantity) {
      form.setError('quantity', { type: 'max', message: `Cannot exceed the on-order quantity (${maxQuantity})` });
    } else if (form.formState.errors.quantity?.type === 'max') {
      form.clearErrors('quantity');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxQuantity, watchedQuantity]);

  useEffect(() => {
    if (isOpen && initialPartId) {
      const match = partsWithOpenOrders.find(p => p.id === initialPartId);
      if (match) {
        setSelectedPart(match);
        form.setValue('partId', match.id, { shouldValidate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPartId]);

  const isFormDirty = form.formState.isDirty;

  const resetAndClose = () => {
    form.reset();
    setSelectedPart(null);
    onClose();
  };

  const attemptClose = () => {
    if (isFormDirty) {
      setShowDiscardConfirm(true);
    } else {
      resetAndClose();
    }
  };

  const handleSubmit = (data: ReceiveFormData) => {
    if (!selectedPart) {
      toast.error('Select a part to receive');
      return;
    }
    if (maxQuantity != null && data.quantity > maxQuantity) {
      toast.error(`Quantity cannot exceed the on-order amount (${maxQuantity})`);
      return;
    }
    onReceive({
      partId: selectedPart.id,
      pn: selectedPart.partNumber,
      name: selectedPart.name,
      cat: selectedPart.category,
      location: data.location as StockLocation,
      quantity: data.quantity,
      reference: data.reference?.trim() || undefined,
      quarantine: data.quarantine,
      note: data.note?.trim() || undefined,
      orderId: data.orderId && data.orderId !== NO_ORDER_SENTINEL ? data.orderId : undefined,
      lotNumber: data.trackBy === 'lot' ? (data.lotNumber?.trim() || undefined) : undefined,
      serialNumber: data.trackBy === 'serial'
        ? (data.serialNumbers ?? []).map(s => s.trim()).filter(Boolean).join(', ') || undefined
        : undefined,
    });
    resetAndClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && attemptClose()}>
      <DialogContent
        hideClose
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0'
            : 'max-w-lg max-h-[90vh]'
        )}
      >
        <DialogHeader className="px-4 sm:px-6 py-4 pr-10 border-b shrink-0 flex-row items-start gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="h-4 w-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>Writes one immutable ledger entry</DialogDescription>
          </div>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="p-4 sm:p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="partId"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Part <span className="text-destructive" aria-hidden="true">*</span></FormLabel>

                      <Popover open={partPickerOpen} onOpenChange={setPartPickerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between font-normal',
                                !selectedPart && 'text-muted-foreground'
                              )}
                            >
                              {selectedPart ? `${selectedPart.partNumber} — ${selectedPart.name}` : 'Select a part...'}
                              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search parts, MPN, manufacturer..." />
                            <CommandList>
                              <CommandEmpty>No parts on order.</CommandEmpty>
                              <CommandGroup>
                                {partsWithOpenOrders.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.partNumber} ${p.name} ${p.mpn ?? ''} ${p.manufacturer ?? ''}`}
                                    onSelect={() => {
                                      setSelectedPart(p);
                                      form.setValue('partId', p.id, { shouldDirty: true, shouldValidate: true });
                                      form.setValue('orderId', '');
                                      setPartPickerOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedPart?.id === p.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm truncate">{p.partNumber} — {p.name}</span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {p.manufacturer || '—'}{p.mpn ? ` · ${p.mpn}` : ''}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Destination location <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                      <FormControl>
                        <LocationCombobox value={field.value} onChange={field.onChange} knownLocations={knownLocations} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedPart && openOrdersForPart.length > 0 && (
                  <FormField
                    control={form.control}
                    name="orderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apply to order <span className="normal-case font-normal">optional</span></FormLabel>
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v !== NO_ORDER_SENTINEL) {
                              const order = openOrdersForPart.find(o => o.id === v);
                              if (order) {
                                form.setValue('quantity', order.remainingQty, { shouldDirty: true });
                                form.setValue('location', order.location, { shouldDirty: true });
                              }
                            }
                          }}
                          value={field.value || NO_ORDER_SENTINEL}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="None — not tied to an order" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NO_ORDER_SENTINEL}>None — not tied to an order</SelectItem>
                            {openOrdersForPart.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.remainingQty} remaining · due {formatShortDate(o.expectedDate)}{o.supplierRef ? ` · ${o.supplierRef}` : ''}
                              </SelectItem>
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
                        {maxQuantity != null && (
                          <span className="normal-case font-normal"> — {maxQuantity} on order</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={maxQuantity} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="trackBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Track by</FormLabel>
                        <FormControl>
                          <ToggleGroup
                            type="single"
                            value={field.value}
                            onValueChange={(v) => v && field.onChange(v)}
                            className="justify-start gap-2"
                          >
                            <ToggleGroupItem
                              value="lot"
                              variant="outline"
                              className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                            >
                              Lot number
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="serial"
                              variant="outline"
                              className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                            >
                              Serial number
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {field.value === 'serial'
                            ? 'One serial number is required per unit — the inputs below track the quantity above.'
                            : 'One lot number covers the entire quantity.'}
                        </p>
                      </FormItem>
                    )}
                  />

                  {trackBy === 'lot' ? (
                    <FormField
                      control={form.control}
                      name="lotNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lot number <span className="normal-case font-normal">optional</span></FormLabel>
                          <FormControl>
                            <Input placeholder="LOT-…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="space-y-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Serial numbers <span className="text-destructive" aria-hidden="true">*</span>
                      </FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {serialFields.map((serialField, index) => (
                          <FormField
                            key={serialField.id}
                            control={form.control}
                            name={`serialNumbers.${index}` as const}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input placeholder={`SN-… (unit ${index + 1})`} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference <span className="normal-case font-normal">(expected receipt / PO)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="ER-…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quarantine"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">Route to quarantine / inspection</FormLabel>
                        <p className="text-xs text-muted-foreground">Held out of available stock until inspected.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note <span className="normal-case font-normal">optional</span></FormLabel>
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
              <Button type="button" variant="outline" className="flex-1" onClick={attemptClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!selectedPart}>Receive</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      <ConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirm={resetAndClose}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="destructive"
      />
    </Dialog>
  );
}
