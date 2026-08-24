import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
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
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { Boxes, Camera, Check, ChevronsUpDown, ImagePlus, Minus, Pencil, Plus, ShoppingCart, Upload, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCreatePart, useUpdatePart } from '@/hooks/useParts';
import { useLocations } from '@/hooks/useLocations';
import { type ApiPartResponse, type BOMCategory, getCategoryMeta } from './bomData';
import { LocationCombobox, CategoryCombobox, type StockLocation, type StockRecord } from './inventoryData';
import type { PlaceOrderInput } from './PlaceOrderDialog';

interface PickerPart {
  partId: string;
  pn: string;
  name: string;
  location: string;
  onHand: number;
  cat?: BOMCategory;
  projects: string[];
}

const adjustSchema = z.object({
  partId: z.string().min(1, 'Select a part'),
  location: z.string().min(1, 'Select a location'),
  category: z.string().min(1, 'Select a category'),
  stockStatus: z.enum(['in_stock', 'place_order']),
  direction: z.enum(['add', 'remove']),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reasonCode: z.string().optional(),
  expectedDate: z.string().optional(),
  note: z.string().max(300, 'Note must be less than 300 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  orderNote: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  purpose: z.string().max(500, 'Purpose must be less than 500 characters').optional(),
}).superRefine((data, ctx) => {
  if (data.stockStatus === 'place_order' && !data.expectedDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected date is required', path: ['expectedDate'] });
  }
});

type AdjustFormData = z.infer<typeof adjustSchema>;

export interface AdjustQuantityInput {
  partId: string;
  pn?: string;
  name?: string;
  cat?: BOMCategory;
  location: StockLocation;
  direction: 'add' | 'remove';
  quantity: number;
  reasonCode: string;
  note?: string;
  description?: string;
  lotNumber?: string;
  serialNumber?: string;
  image?: File;
}

interface AdjustQuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  stock: StockRecord[];
  parts: ApiPartResponse[];
  onAdjust: (input: AdjustQuantityInput) => void;
  /** Handles the "place order" branch when the user reports the stock isn't on hand. */
  onPlaceOrder: (input: PlaceOrderInput) => void;
  /** Preselect a part (e.g. opened from that part's detail sheet) instead of starting on the picker. */
  initialPartId?: string;
  /** Project name(s) each part is used in, keyed by partId — helps disambiguate similarly-named parts in the picker. */
  partProjects?: Map<string, string[]>;
}

const emptyNewPart = { partNumber: '', name: '', description: '', category: '' as BOMCategory | '', manufacturer: '', mpn: '', unit: 'EA' };

export function AdjustQuantityDialog({ isOpen, onClose, orgId, stock, parts, onAdjust, onPlaceOrder, initialPartId, partProjects }: AdjustQuantityDialogProps) {
  const isMobile = useIsMobile();
  const [selectedRecord, setSelectedRecord] = useState<PickerPart | null>(null);
  const [partPickerOpen, setPartPickerOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [newPart, setNewPart] = useState(emptyNewPart);
  const [createdPart, setCreatedPart] = useState<{ id: string; partNumber: string; name: string; category: BOMCategory } | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const createPart = useCreatePart(orgId);
  const updatePart = useUpdatePart();
  const { data: knownLocations = [] } = useLocations(orgId);

  // Include every part, not just parts that already have a stock row — a part only referenced
  // from a BOM (never received) still needs to be selectable when starting a new transaction.
  const pickerParts = useMemo<PickerPart[]>(() => {
    const stockPartIds = new Set(stock.map(r => r.partId));
    const fromStock: PickerPart[] = stock.map(r => ({ partId: r.partId, pn: r.pn, name: r.name, location: r.location, onHand: r.onHand, cat: r.cat, projects: partProjects?.get(r.partId) ?? [] }));
    const fromPartsOnly: PickerPart[] = parts
      .filter(p => !stockPartIds.has(p.id))
      .map(p => ({ partId: p.id, pn: p.partNumber, name: p.name, location: '', onHand: 0, cat: p.category, projects: partProjects?.get(p.id) ?? [] }));
    return [...fromStock, ...fromPartsOnly];
  }, [stock, parts, partProjects]);

  // Custom categories already in use (created via "Add new part") — mirrors InventoryView's
  // allCategories so they're selectable here too, not just filterable on the inventory page.
  const extraCategories = useMemo(
    () => Array.from(new Set(parts.map(p => p.category))),
    [parts]
  );

  const form = useForm<AdjustFormData>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      partId: '',
      location: '',
      category: '',
      stockStatus: 'in_stock',
      direction: 'add',
      quantity: 1,
      reasonCode: '',
      expectedDate: '',
      note: '',
      description: '',
      orderNote: '',
      purpose: '',
    },
  });

  const stockStatus = form.watch('stockStatus');

  useEffect(() => {
    if (isOpen && initialPartId) {
      const match = pickerParts.find(r => r.partId === initialPartId);
      if (match) {
        setSelectedRecord(match);
        form.setValue('partId', match.partId, { shouldValidate: true });
        form.setValue('location', match.location, { shouldValidate: true });
        form.setValue('category', match.cat ?? '', { shouldValidate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPartId]);

  const isFormDirty = form.formState.isDirty || showAddPart || !!image;

  const applyImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setImage(file);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    applyImageFile(file);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    applyImageFile(file);
  };

  const handleCloseCamera = () => {
    setCameraStream((prev) => {
      prev?.getTracks().forEach((track) => track.stop());
      return null;
    });
  };

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
    } catch {
      toast.error('Camera access was denied or unavailable');
    }
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      applyImageFile(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      handleCloseCamera();
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // The camera light must turn off the moment the dialog closes, not just when the user
  // explicitly cancels the preview — otherwise the stream keeps running in the background.
  useEffect(() => {
    if (!isOpen) handleCloseCamera();
  }, [isOpen]);

  useEffect(() => {
    return () => {
      handleCloseCamera();
    };
  }, []);

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAndClose = () => {
    form.reset();
    setSelectedRecord(null);
    setShowAddPart(false);
    setNewPart(emptyNewPart);
    setCreatedPart(null);
    handleRemoveImage();
    handleCloseCamera();
    onClose();
  };

  const attemptClose = () => {
    if (isFormDirty) {
      setShowDiscardConfirm(true);
    } else {
      resetAndClose();
    }
  };

  const handleCreatePart = async () => {
    if (!newPart.partNumber.trim() || !newPart.name.trim() || !newPart.category) {
      toast.error('Part number, name, and category are required');
      return;
    }
    try {
      const created = await createPart.mutateAsync({
        partNumber: newPart.partNumber.trim(),
        name: newPart.name.trim(),
        description: newPart.description.trim() || newPart.name.trim(),
        category: newPart.category,
        manufacturer: newPart.manufacturer.trim() || undefined,
        mpn: newPart.mpn.trim() || undefined,
        unit: newPart.unit || 'EA',
      });
      setSelectedRecord(null);
      setCreatedPart({ id: created.id, partNumber: created.partNumber, name: created.name, category: created.category });
      form.setValue('partId', created.id, { shouldDirty: true, shouldValidate: true });
      form.setValue('category', created.category, { shouldDirty: true, shouldValidate: true });
      setShowAddPart(false);
      setNewPart(emptyNewPart);
      toast.success(`Part ${created.partNumber} created`);
    } catch {
      toast.error('Failed to create part');
    }
  };

  const handleSubmit = async (data: AdjustFormData) => {
    const part = selectedRecord
      ? { partId: selectedRecord.partId, pn: selectedRecord.pn, name: selectedRecord.name, cat: selectedRecord.cat }
      : createdPart
        ? { partId: createdPart.id, pn: createdPart.partNumber, name: createdPart.name, cat: createdPart.category }
        : null;

    if (!part) {
      toast.error('Select a part to adjust');
      return;
    }

    // Category defaults from the selected part but is editable here — if the user changed it,
    // that's a recategorization of the part itself (there's no per-transaction category column).
    if (selectedRecord && data.category && data.category !== part.cat) {
      try {
        await updatePart.mutateAsync({ partId: part.partId, dto: { category: data.category as BOMCategory } });
      } catch {
        toast.error("Transaction saved, but couldn't update the part's category");
      }
    }
    const cat = (data.category || part.cat) as BOMCategory | undefined;

    if (data.stockStatus === 'place_order') {
      onPlaceOrder({
        partId: part.partId,
        pn: part.pn,
        name: part.name,
        cat,
        quantity: data.quantity,
        expectedDate: data.expectedDate as string,
        location: data.location,
        supplierRef: data.note?.trim() || undefined,
        note: data.orderNote?.trim() || undefined,
        description: data.description?.trim() || undefined,
        purpose: data.purpose?.trim() || undefined,
      });
    } else {
      onAdjust({
        partId: part.partId,
        ...(selectedRecord ? {} : { pn: part.pn, name: part.name, cat }),
        location: data.location as StockLocation,
        direction: data.direction,
        quantity: data.quantity,
        reasonCode: data.reasonCode as string,
        note: data.note?.trim() || undefined,
        description: data.description?.trim() || undefined,
        image: image ?? undefined,
      });
    }
    resetAndClose();
  };

  // Required fields (Reason code / Expected date) can sit below the fold in a scrolled dialog —
  // without this, a blocked submit looks like the button did nothing.
  const handleInvalid = (errors: FieldErrors<AdjustFormData>) => {
    const firstMessage = Object.values(errors)[0]?.message;
    toast.error(typeof firstMessage === 'string' ? firstMessage : 'Fill in all required fields before submitting');
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
            {stockStatus === 'place_order' ? <ShoppingCart className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </div>
          <div className="text-left flex-1 min-w-0">
            <DialogTitle>{initialPartId ? 'Adjust quantity' : 'New transaction'}</DialogTitle>
            <DialogDescription>
              {stockStatus === 'place_order' ? 'Creates a tracked purchase order' : 'Writes one immutable ledger entry'}
            </DialogDescription>
          </div>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, handleInvalid)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="p-4 sm:p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="partId"
                  render={() => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Part <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                        {!showAddPart && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => setShowAddPart(true)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add new part
                          </Button>
                        )}
                      </div>

                      {!showAddPart ? (
                        <Popover open={partPickerOpen} onOpenChange={setPartPickerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !selectedRecord && !createdPart && 'text-muted-foreground'
                                )}
                              >
                                {selectedRecord
                                  ? `${selectedRecord.pn} — ${selectedRecord.name}`
                                  : createdPart
                                    ? `${createdPart.partNumber} — ${createdPart.name}`
                                    : 'Select a part...'}
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search parts..." />
                              <CommandList>
                                <CommandEmpty>No parts found.</CommandEmpty>
                                <CommandGroup>
                                  {pickerParts.map((r) => (
                                    <CommandItem
                                      key={r.partId}
                                      value={`${r.pn} ${r.name}`}
                                      onSelect={() => {
                                        setSelectedRecord(r);
                                        setCreatedPart(null);
                                        form.setValue('partId', r.partId, { shouldDirty: true, shouldValidate: true });
                                        form.setValue('location', r.location, { shouldDirty: true, shouldValidate: true });
                                        form.setValue('category', r.cat ?? '', { shouldDirty: true, shouldValidate: true });
                                        setPartPickerOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          selectedRecord?.partId === r.partId ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      <div className="flex flex-col min-w-0 gap-0.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-sm truncate">{r.pn} — {r.name}</span>
                                          {r.projects.length > 0 && (
                                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[120px]">
                                              {r.projects.join(', ')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                          {r.cat && (
                                            <span className="flex items-center gap-1 shrink-0">
                                              <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ background: getCategoryMeta(r.cat).tint }}
                                              />
                                              <span className="text-xs text-muted-foreground">{getCategoryMeta(r.cat).label}</span>
                                            </span>
                                          )}
                                          <span className="text-xs text-muted-foreground truncate">
                                            {r.cat && '· '}{r.location ? `${r.location} · On hand ${r.onHand}` : 'Not yet stocked'}
                                          </span>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">New part</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => { setShowAddPart(false); setNewPart(emptyNewPart); }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Part Number *</Label>
                              <Input
                                value={newPart.partNumber}
                                onChange={(e) => setNewPart(prev => ({ ...prev, partNumber: e.target.value }))}
                                placeholder="e.g. EV-PWR-099"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Name *</Label>
                              <Input
                                value={newPart.name}
                                onChange={(e) => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Part name"
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs">Category *</Label>
                              <CategoryCombobox
                                value={newPart.category}
                                onChange={(v) => setNewPart(prev => ({ ...prev, category: v as BOMCategory | '' }))}
                                extraCategories={extraCategories}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Unit</Label>
                              <Input
                                value={newPart.unit}
                                onChange={(e) => setNewPart(prev => ({ ...prev, unit: e.target.value }))}
                                placeholder="EA"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Manufacturer</Label>
                              <Input
                                value={newPart.manufacturer}
                                onChange={(e) => setNewPart(prev => ({ ...prev, manufacturer: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">MPN</Label>
                              <Input
                                value={newPart.mpn}
                                onChange={(e) => setNewPart(prev => ({ ...prev, mpn: e.target.value }))}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            disabled={createPart.isPending}
                            onClick={handleCreatePart}
                          >
                            {createPart.isPending ? 'Creating...' : 'Create & select part'}
                          </Button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!showAddPart && (
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                        <FormControl>
                          <CategoryCombobox value={field.value} onChange={field.onChange} placeholder="Select a part first..." extraCategories={extraCategories} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Defaults to the part&apos;s category — change it here to recategorize the part.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                      <FormControl>
                        <LocationCombobox value={field.value} onChange={field.onChange} knownLocations={knownLocations} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stockStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock status</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={(v) => v && field.onChange(v)}
                          className="justify-start gap-2"
                        >
                          <ToggleGroupItem
                            value="in_stock"
                            variant="outline"
                            className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                          >
                            <Boxes className="h-3.5 w-3.5" /> Have stock
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="place_order"
                            variant="outline"
                            className="gap-1.5 flex-1 border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> Need to order
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {stockStatus === 'place_order'
                          ? "Don't have it on hand — place a purchase order instead."
                          : 'Already have this part in hand — log the ledger entry directly.'}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {stockStatus === 'in_stock' ? (
                  <div className="grid grid-cols-1 gap-4">
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
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      name="expectedDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expected date <span className="text-destructive" aria-hidden="true">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {stockStatus === 'place_order' ? 'Supplier / PO ref' : 'Note'} <span className="normal-case font-normal">optional</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={stockStatus === 'place_order' ? 'PO-…' : 'Optional note...'}
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {stockStatus === 'place_order' && (
                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Purpose <span className="normal-case font-normal">optional</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Why is this being ordered?"
                            className="min-h-[70px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {stockStatus === 'place_order' && (
                  <FormField
                    control={form.control}
                    name="orderNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Notes <span className="normal-case font-normal">optional</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Optional notes..."
                            className="min-h-[70px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Description <span className="normal-case font-normal">optional</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description..."
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Image <span className="normal-case font-normal">optional</span>
                  </Label>
                  {cameraStream ? (
                    <div className="space-y-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full max-w-xs rounded-md border bg-black aspect-video object-cover"
                      />
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" onClick={handleCapturePhoto}>
                          <Camera className="h-3.5 w-3.5 mr-1.5" />
                          Capture
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={handleCloseCamera}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : imagePreviewUrl ? (
                    <div className="relative w-fit">
                      <img
                        src={imagePreviewUrl}
                        alt="Attached"
                        className="h-24 w-24 rounded-md object-cover border"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={handleImageDrop}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
                        isDraggingImage ? 'border-primary bg-primary/5' : 'border-input'
                      )}
                    >
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drag & drop an image here</p>
                      <div className="flex items-center gap-2 mt-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors">
                          <Upload className="h-3.5 w-3.5" />
                          Browse files
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelect}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleOpenCamera}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Take photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0 px-4 sm:px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" className="flex-1" onClick={attemptClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={!selectedRecord && !createdPart}>
                {stockStatus === 'place_order' ? 'Place order' : 'Save transaction'}
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
