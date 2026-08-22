import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveFileUrl } from '@/utils/fileUrl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Module, ModuleType, TeamMember } from '@/types';
import { formatModuleType, getModuleColor } from '../utils/projectUtils';

interface AddModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (module: Omit<Module, 'id' | 'createdAt'>) => Promise<boolean>;
  teamMembers: TeamMember[];
  existingModuleNames?: string[];
}

const moduleTypes: ModuleType[] = [
  'hardware', 'software', 'firmware', 'testing', 'design',
  'procurement', 'manufacturing', 'qa', 'logistics', 'enclosure', 'pcb', 'power'
];

const createModuleSchema = (existingModuleNames: string[]) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Module name is required')
      .refine(
        (val) => !existingModuleNames.some((n) => n.toLowerCase() === val.toLowerCase()),
        'A module with this name already exists'
      ),
    type: z.enum(moduleTypes as [ModuleType, ...ModuleType[]]),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    ownerId: z.string().optional(),
  });

type ModuleFormData = z.infer<ReturnType<typeof createModuleSchema>>;

export function AddModuleDialog({
  isOpen,
  onClose,
  onAdd,
  teamMembers,
  existingModuleNames = [],
}: AddModuleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const moduleSchema = useMemo(() => createModuleSchema(existingModuleNames), [existingModuleNames]);

  const form = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      name: '',
      type: 'hardware',
      description: '',
      ownerId: '',
    },
  });

  const handleSubmit = async (data: ModuleFormData) => {
    const owner = teamMembers.find((m) => m.id === data.ownerId);

    setIsSubmitting(true);
    const success = await onAdd({
      name: data.name.trim(),
      type: data.type,
      description: data.description?.trim() || undefined,
      owner,
      color: getModuleColor(data.type),
      progress: 0,
      status: 'active',
    });
    setIsSubmitting(false);

    if (!success) return;

    resetAndClose();
  };

  const resetAndClose = () => {
    form.reset();
    onClose();
  };

  const attemptClose = () => {
    if (form.formState.isDirty) {
      setShowDiscardConfirm(true);
    } else {
      resetAndClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && attemptClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Module</DialogTitle>
          <DialogDescription>
            Create a new module to organize tasks by system component.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Power Management" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {moduleTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getModuleColor(t) }}
                            />
                            {formatModuleType(t)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this module's purpose..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an owner (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={resolveFileUrl(member.avatar) ?? member.avatar} alt={member.name} />
                              <AvatarFallback className="text-[9px]">
                                {member.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name}</span>
                            <span className="text-muted-foreground text-xs">({member.role})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={attemptClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Module'}
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
