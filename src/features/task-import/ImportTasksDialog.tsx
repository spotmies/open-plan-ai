/**
 * ImportTasksDialog — upload a file, watch the background AI job parse and
 * map it onto the task schema, then resolve any flagged rows in a chat with
 * the AI before committing. Purpose-built (not the full cross-entity
 * Assistant panel) per the confirmed design — see the task-import feature
 * plan. Three internal stages: upload -> chat (review + resolve) -> result.
 */
import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Paperclip, Send, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { taskImportService } from './services/taskImport.service';
import { useTaskImportFlow } from './hooks/useTaskImportFlow';
import { ImportProposalCard } from './components/ImportProposalCard';
import { isSupportedImportFile, SUPPORTED_IMPORT_FILE_LABEL, type ImportProposalPreview, type CommitImportResult } from './taskImportData';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

type Stage = 'upload' | 'chat' | 'result';

export function ImportTasksDialog({ open, onClose, projectId }: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const flow = useTaskImportFlow(projectId, jobId);

  function reset() {
    setStage('upload');
    setJobId(null);
    setUploadError(null);
    setDraft('');
    setResult(null);
    setCommitError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    if (!isSupportedImportFile(file)) {
      setUploadError(`Unsupported file type. Use ${SUPPORTED_IMPORT_FILE_LABEL}.`);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const job = await taskImportService.startImport(projectId, file);
      setJobId(job.jobId);
      setStage('chat');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await flow.sendMessage(draft.trim());
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  async function handleAttach(file: File) {
    setSending(true);
    try {
      await flow.uploadAttachment(file);
    } finally {
      setSending(false);
    }
  }

  async function handleCommit(proposalId: string) {
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await flow.commit(proposalId);
      setResult(res);
      setStage('result');
    } catch (err) {
      // A double-click (or a retry after a slow first request already
      // landed) hits the "no longer pending" guard — that means the import
      // already succeeded, so re-check the job status instead of showing a
      // scary error for something that actually worked.
      const latestStatus = await taskImportService.getStatus(projectId, jobId!).catch(() => null);
      if (latestStatus?.status === 'completed') {
        setStage('result');
        setResult(null); // exact created/skipped counts aren't recoverable from status alone, but the board already reflects the real outcome
      } else {
        setCommitError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      }
    } finally {
      setCommitting(false);
    }
  }

  const job = flow.job;
  // The latest proposal for this conversation, whatever its current status —
  // not filtered to 'pending' only. ImportProposalCard itself renders the
  // right thing for every status (editable review, importing spinner,
  // success, failure), so once a proposal is committed it keeps showing
  // here as a persistent "Import successful" confirmation instead of
  // silently vanishing the moment its status stops being 'pending'.
  // proposals[0] is the newest — the backend returns them ordered by
  // createdAt descending (see proposals.repository.ts's listByConversation).
  const latestProposal = flow.conversation?.proposals[0] ?? null;
  const messages = flow.conversation?.messages.filter((m) => m.role === 'user' || m.role === 'assistant') ?? [];
  const isProcessing = job && !['awaiting_review', 'completed', 'failed'].includes(job.status);
  const isFailed = job?.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg">Import Tasks</DialogTitle>
          <DialogDescription className="text-sm">
            {stage === 'upload' && `Upload a file and AI will map it to tasks — ${SUPPORTED_IMPORT_FILE_LABEL}.`}
            {stage === 'chat' && !isFailed && (
              <span className="flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{job?.sourceFileName}</span>
              </span>
            )}
            {stage === 'chat' && isFailed && 'This file couldn’t be imported'}
            {stage === 'result' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 px-6 py-5">
          {stage === 'upload' && (
            <div className="flex-1 flex flex-col gap-4">
              <div
                className={cn(
                  'flex-1 min-h-[240px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors px-6',
                  dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
              >
                <div className={cn('h-14 w-14 rounded-full flex items-center justify-center', dragging ? 'bg-primary/10' : 'bg-muted')}>
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-medium">
                    {uploading ? 'Uploading…' : (
                      <>Drop a file here, or <span className="text-primary">browse</span></>
                    )}
                  </p>
                  {!uploading && (
                    <p className="text-xs text-muted-foreground">{SUPPORTED_IMPORT_FILE_LABEL}</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Works best with a Title column (or a document that clearly describes action items). Non-task files — BOMs, change logs, invoices — will be rejected automatically.
              </p>
            </div>
          )}

          {stage === 'chat' && isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Reading {job?.sourceFileName}…</p>
            </div>
          )}

          {stage === 'chat' && isFailed && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <p className="text-sm font-medium">Couldn't import this file</p>
                <p className="text-sm text-muted-foreground">{job?.errorSummary ?? 'Something went wrong while reading this file.'}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Try a different file
              </Button>
            </div>
          )}

          {stage === 'chat' && !isProcessing && !isFailed && (
            <div className="flex-1 flex flex-col min-h-0 gap-4">
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'text-sm rounded-xl px-3.5 py-2.5 max-w-[85%] leading-relaxed',
                      m.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted',
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {latestProposal && (
                  <ImportProposalCard
                    preview={latestProposal.preview as ImportProposalPreview}
                    status={latestProposal.status}
                    result={latestProposal.result as CommitImportResult | null}
                    committing={committing}
                    onCommit={() => handleCommit(latestProposal.id)}
                  />
                )}
                {(flow.liveError || commitError) && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{commitError ?? flow.liveError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2 pt-4 border-t">
                <input
                  ref={attachInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAttach(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={sending}
                  title="Attach another file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask the AI to fix a row, or explain what to change…"
                  className="min-h-[40px] max-h-[120px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button size="icon" className="shrink-0 h-10 w-10" onClick={handleSend} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {stage === 'result' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-medium">
                  {result ? `${result.created} task${result.created === 1 ? '' : 's'} imported` : 'Import complete'}
                </p>
                {result && result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {result.skipped} row{result.skipped === 1 ? ' was' : 's were'} skipped — they still had unresolved issues.
                  </p>
                )}
              </div>
              <Button onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
