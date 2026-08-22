import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Unlink } from 'lucide-react';
import { LOGO_PATHS } from '@/features/integrations/logoPaths';
import { cn } from '@/lib/utils';
import type { GoogleSheetsLinkStatus, SheetTab } from '@/services/googleSheets.service';
import {
  usePreviewGoogleSheetTabs,
  useLinkGoogleSheet,
  useUnlinkGoogleSheet,
} from '@/hooks/useGoogleSheets';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  linkStatus: GoogleSheetsLinkStatus | undefined;
  // Called instead of onClose after a sheet is successfully linked, so the
  // caller can hand straight off to the Pull review rather than just closing.
  // Optional — without it, linking falls back to a plain close.
  onLinked?: () => void;
}

function GoogleSheetsLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={LOGO_PATHS.googleSheets} />
    </svg>
  );
}

export default function BOMGoogleSheetsLinkDialog({ open, onClose, projectId, linkStatus, onLinked }: Props) {
  const [url, setUrl] = useState('');
  const [tabs, setTabs] = useState<SheetTab[] | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('');

  const previewTabs = usePreviewGoogleSheetTabs(projectId);
  const linkSheet = useLinkGoogleSheet(projectId);
  const unlinkSheet = useUnlinkGoogleSheet(projectId);

  const isLinked = !!linkStatus?.linked;

  const resetLinkForm = () => {
    setUrl('');
    setTabs(null);
    setSelectedTab('');
  };

  const handleClose = () => {
    resetLinkForm();
    onClose();
  };

  const handleFindTabs = async () => {
    if (!url.trim()) return;
    const result = await previewTabs.mutateAsync(url.trim());
    setTabs(result.tabs);
    setSelectedTab(result.tabs[0]?.title ?? '');
  };

  const handleLink = async () => {
    if (!selectedTab) return;
    await linkSheet.mutateAsync({ spreadsheetUrl: url.trim(), sheetTabName: selectedTab });
    resetLinkForm();
    // Linking only records which sheet this BOM mirrors — the sheet's rows
    // still have to be reconciled in. Hand straight off to the Pull review
    // so the first sync happens as part of setting the link up, instead of
    // leaving the user on an unchanged BOM to find Pull in the menu. Still a
    // preview: nothing writes until they confirm there. A relink to a
    // different sheet takes the same path, since the new sheet's rows need
    // reconciling just as much.
    if (onLinked) onLinked();
    else onClose();
  };

  const handleUnlink = async () => {
    await unlinkSheet.mutateAsync();
    resetLinkForm();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[540px] w-[95vw] rounded-2xl p-6 shadow-2xl border border-border bg-card">
        <DialogHeader className="text-left space-y-0 pr-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-600 mt-0.5">
              <GoogleSheetsLogo className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Link a Google Sheet
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 leading-normal">
                One sheet syncs with this project's BOM. Linking opens the Pull review right away — nothing syncs automatically, and nothing writes until you confirm.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 pb-1">
          {linkStatus?.email && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              Connected as <span className="font-semibold text-foreground">{linkStatus.email}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gs-url" className="text-xs font-semibold text-foreground">
              Google Sheets link
            </Label>
            <div className="flex items-center gap-2 w-full">
              <Input
                id="gs-url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-10 text-xs sm:text-sm rounded-xl flex-1 min-w-0 border-border/80 bg-background"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFindTabs}
                disabled={!url.trim() || previewTabs.isPending}
                className="h-10 px-4 shrink-0 font-medium text-xs rounded-xl border-border/80 hover:bg-muted"
              >
                {previewTabs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Find tabs
              </Button>
            </div>
          </div>

          {tabs && tabs.length > 0 && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <Label className="text-xs font-semibold text-foreground">
                Which tab is your BOM?
              </Label>
              <RadioGroup value={selectedTab} onValueChange={setSelectedTab} className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {tabs.map((tab) => (
                  <label
                    key={tab.sheetId}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition-all",
                      selectedTab === tab.title
                        ? "border-primary/50 bg-primary/5 text-foreground shadow-2xs font-medium"
                        : "border-border/70 bg-card hover:bg-muted/30 text-foreground"
                    )}
                  >
                    <RadioGroupItem value={tab.title} id={`tab-${tab.sheetId}`} />
                    <span className="text-xs sm:text-sm font-medium flex-1">
                      {tab.title}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {isLinked && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-muted-foreground truncate mr-2">
                Currently linked to tab "{linkStatus?.sheetTabName || 'BOM Export'}"
              </span>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={unlinkSheet.isPending}
                className="text-xs text-destructive hover:text-destructive/80 hover:underline flex items-center gap-1.5 shrink-0 cursor-pointer font-medium"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="h-9 px-4 text-xs font-medium rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleLink}
            disabled={!selectedTab || linkSheet.isPending}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            {linkSheet.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Link this sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
