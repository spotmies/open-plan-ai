import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Clock, ShoppingCart, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocations } from '@/hooks/useLocations';
import { type ApiPartResponse, type BOMCategory } from './bomData';
import { LocationHierarchyPicker, LockedLocationField } from './inventoryData';

const orderSchema = z.object({
  partId: z.string().min(1, 'Select a part'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  expectedDate: z.string().optional(),
  leadTime: z.coerce.number().int().min(1, 'Lead time must be at least 1 day'),
  supplierRef: z.string().max(60, 'Reference must be less than 60 characters').optional(),
  unitCost: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  location: z.string().min(1, 'Select a destination location'),
  purpose: z.string().max(500, 'Purpose must be less than 500 characters').optional(),
  orderStatus: z.enum(['planned', 'open']),
});

type OrderFormData = z.infer<typeof orderSchema>;

export interface PlaceOrderInput {
  partId: string;
  pn: string;
  name: string;
  cat: BOMCategory;
  quantity: number;
  expectedDate?: string;
  leadTime?: number;
  supplierRef?: string;
  unitCost?: number;
  location: string;
  locationNodeId?: string | null;
  note?: string;
  description?: string;
  purpose?: string;
  lotNumber?: string;
  serialNumber?: string;
  /** 'planned' (want to order — not yet submitted to a supplier) or 'open' (already
   * ordered). Defaults to 'open' server-side when omitted. */
  status?: 'planned' | 'open';
}

interface PlaceOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  parts: ApiPartResponse[];
  onPlaceOrder: (input: PlaceOrderInput) => void;
  /** Preselect a part (e.g. opened from that part's detail sheet) instead of starting on the picker. */
  initialPartId?: string;
  /** partId → the part's canonical stock location. When the selected part has one, the
   * destination is locked to it (a part only ever lives in one location — Transfer moves it). */
  canonicalLocationByPartId?: Map<string, string>;
}

export function PlaceOrderDialog({ isOpen, onClose, orgId, parts, onPlaceOrder, initialPartId, canonicalLocationByPartId }: PlaceOrderDialogProps) {
  const isMobile = useIsMobile();
  const [selectedPart, setSelectedPart] = useState<ApiPartResponse | null>(null);
  const [partPickerOpen, setPartPickerOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { data: locations = [] } = useLocations(orgId);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      partId: '',
      quantity: 1,
      expectedDate: '',
      leadTime: 1,
      supplierRef: '',
      unitCost: '',
      location: '',
      purpose: '',
      orderStatus: 'open',
    },
  });

  useEffect(() => {
    if (isOpen && initialPartId) {
      const match = parts.find(p => p.id === initialPartId);
      if (match) {
        setSelectedPart(match);
        form.setValue('partId', match.id, { shouldValidate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPartId]);

  const orderStatus = form.watch('orderStatus');
  const isFormDirty = form.formState.isDirty;

  // A part that already has stock (or a prior order) is pinned to its canonical location —
  // Order can't send it somewhere new. Only a never-stocked, never-ordered part is free to pick.
  const lockedLocation = selectedPart ? canonicalLocationByPartId?.get(selectedPart.id) : undefined;

  useEffect(() => {
    if (lockedLocation) form.setValue('location', lockedLocation, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedLocation]);

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

  const handleSubmit = (data: OrderFormData) => {
    if (!selectedPart) {
      toast.error('Select a part to order');
      return;
    }
    const finalLocation = lockedLocation ?? data.location;
    onPlaceOrder({
      partId: selectedPart.id,
      pn: selectedPart.partNumber,
      name: selectedPart.name,
      cat: selectedPart.category,
      quantity: data.quantity,
      expectedDate: data.expectedDate?.trim() || undefined,
      leadTime: data.leadTime,
      supplierRef: data.supplierRef?.trim() || undefined,
      unitCost: data.unitCost === '' || data.unitCost === undefined ? undefined : Number(data.unitCost),
      location: finalLocation,
      locationNodeId: locations.find((l) => l.path === finalLocation)?.id ?? null,
      purpose: data.purpose?.trim() || undefined,
      status: data.orderStatus,
    });
    resetAndClose();
    toast.success(
      data.orderStatus === 'planned'
        ? `Flagged ${data.quantity} × ${selectedPart.partNumber} as needed to order`
        : `Order placed for ${data.quantity} × ${selectedPart.partNumber}`
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && attemptClose()}>
      <DialogContent
        hideClose
        className={cn(
          'p-0 flex flex-col gap-0 overflow-hidden',
          isMobile
            ? 'inset-0 left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 data-[state=open]:!slide-in-from-left-0 data-[state=open]:!slide-in-from-top-0 data-[state=closed]:!slide-out-to-left-0 data-[state=closed]:!slide-out-to-top-0'
            : 'max-w-3xl max-h-[90vh]'
        )}
      >
        <DialogHeader className="px-4 sm:px-6 py-4 pr-10 border-b shrink-0 flex-row items-start gap-3 space-y-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>Place order</DialogTitle>
            <DialogDescription>Creates a new open order tracked against this part</DialogDescription>
          </div>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 items-start">
                <FormField
                  control={form.control}
                  name="partId"
                  render={() => (
                    <FormItem className="sm:col-span-2">
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
                              <CommandEmpty>No parts found.</CommandEmpty>
                              <CommandGroup>
                                {parts.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.partNumber} ${p.name} ${p.mpn ?? ''} ${p.manufacturer ?? ''}`}
                                    onSelect={() => {
                                      setSelectedPart(p);
                                      form.setValue('partId', p.id, { shouldDirty: true, shouldValidate: true });
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
                  name="orderStatus"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order status</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="justify-start gap-2"
                        >
                          <ToggleGroupItem
                            value="open"
                            variant="outline"
                            className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> Already ordered
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="planned"
                            variant="outline"
                            className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                          >
                            <Clock className="h-3.5 w-3.5" /> Want to order
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {field.value === 'planned'
                          ? "Not submitted to a supplier yet — won't count toward on-order totals until marked ordered."
                          : 'Already submitted to a supplier — counts toward on-order/incoming totals.'}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="leadTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lead time <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={1} placeholder="Days" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expectedDate"
                    render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1">
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expected date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Destination location <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                      {lockedLocation ? (
                        <LockedLocationField location={lockedLocation} />
                      ) : (
                        <FormControl>
                          <LocationHierarchyPicker value={field.value} onChange={field.onChange} orgId={orgId} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="supplierRef"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier / PO ref</FormLabel>
                        <FormControl>
                          <Input placeholder="PO-…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit cost</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purpose</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Why is this being ordered?"
                          className="min-h-[56px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-3.5 border-t shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={attemptClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!selectedPart}>
                {orderStatus === 'planned' ? 'Flag as needed' : 'Place order'}
              </Button>
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
