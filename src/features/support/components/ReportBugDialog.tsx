import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, X, Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import {
  MAX_ATTACHMENTS,
  submitBugReport,
  validateAttachments,
} from '@/features/support/services/bugReport.service';
import { logger } from '@/services/monitoring/logger';

const bugReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(150, 'Title must be less than 150 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must be less than 2000 characters'),
});

type BugReportFormData = z.infer<typeof bugReportSchema>;

interface ReportBugDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportBugDialog({ isOpen, onClose }: ReportBugDialogProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const form = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: { title: '', description: '' },
  });

  const resetAndClose = () => {
    form.reset();
    setFiles([]);
    setFileError(null);
    setIsDraggingOver(false);
    onClose();
  };

  const handleFilesSelected = (selected: File[]) => {
    if (selected.length === 0) return;
    const nextFiles = [...files, ...selected];
    const error = validateAttachments(nextFiles);
    if (error) {
      setFileError(error);
      return;
    }
    setFileError(null);
    setFiles(nextFiles);
  };

  const removeFile = (index: number) => {
    setFileError(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
    handleFilesSelected(droppedFiles);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFilesSelected(pastedFiles);
    }
  };

  const handleSubmit = async (data: BugReportFormData) => {
    setIsSubmitting(true);
    try {
      await submitBugReport({
        title: data.title,
        description: data.description,
        customer: { name: user?.name ?? 'Unknown user', email: user?.email ?? 'unknown@openplanai.com' },
        pageUrl: window.location.href,
        files,
      });
      toast.success('Thanks! Your bug report has been submitted.');
      resetAndClose();
    } catch (err) {
      logger.error('Failed to submit bug report', { error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to submit bug report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && resetAndClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} onPaste={handlePaste} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title of the Issue *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a descriptive title for the bug" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the bug in detail..."
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Attachments</FormLabel>
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2',
                  isDraggingOver
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground'
                )}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.txt,.log"
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <div className="p-2.5 rounded-full bg-muted text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-primary font-semibold hover:underline">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Up to {MAX_ATTACHMENTS} files (10MB each, 25MB total). You can also paste images (Ctrl/Cmd+V).
                  </p>
                </div>
              </label>

              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              {files.length > 0 && (
                <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1 pt-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 text-sm bg-muted/50 border rounded-md px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium text-xs">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({(file.size / 1024).toFixed(0)}KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-sm transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove {file.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
