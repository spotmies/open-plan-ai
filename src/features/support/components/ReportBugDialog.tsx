import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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

  const form = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: { title: '', description: '' },
  });

  const resetAndClose = () => {
    form.reset();
    setFiles([]);
    setFileError(null);
    onClose();
  };

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const nextFiles = [...files, ...Array.from(selected)];
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
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
                htmlFor="bug-report-attachments"
                className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer text-muted-foreground hover:bg-muted/50 transition-colors w-fit"
              >
                <Paperclip className="h-4 w-4" />
                Choose files
                <input
                  id="bug-report-attachments"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_ATTACHMENTS} files, 10MB each, 25MB total.
              </p>
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded-md px-3 py-1.5"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
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
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
