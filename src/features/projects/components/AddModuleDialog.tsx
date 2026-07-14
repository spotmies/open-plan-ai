import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveFileUrl } from '@/utils/fileUrl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Module, ModuleType, TeamMember } from '@/types';
import { formatModuleType, getModuleColor } from '../utils/projectUtils';
import { cn } from '@/lib/utils';


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


export function AddModuleDialog({
  isOpen,
  onClose,
  onAdd,
  teamMembers,
  existingModuleNames = [],
}: AddModuleDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ModuleType>('hardware');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeChange = (newType: ModuleType) => {
    setType(newType);
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Module name is required';
    } else if (existingModuleNames.some(n => n.toLowerCase() === name.trim().toLowerCase())) {
      newErrors.name = 'A module with this name already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const owner = teamMembers.find(m => m.id === ownerId);

    setIsSubmitting(true);
    const success = await onAdd({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      owner,
      color: getModuleColor(type),
      progress: 0,
      status: 'active',
    });
    setIsSubmitting(false);

    if (!success) return;

    // Reset form
    setName('');
    setType('hardware');
    setDescription('');
    setOwnerId('');
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    setName('');
    setType('hardware');
    setDescription('');
    setOwnerId('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Module</DialogTitle>
          <DialogDescription>
            Create a new module to organize tasks by system component.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Module Name */}
          <div className="space-y-2">
            <Label htmlFor="module-name">
              Module Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="module-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({});
              }}
              placeholder="e.g., Power Management"
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Module Type */}
          <div className="space-y-2">
            <Label>
              Module Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as ModuleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this module's purpose..."
              rows={3}
            />
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an owner (optional)" />
              </SelectTrigger>
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
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Module'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
