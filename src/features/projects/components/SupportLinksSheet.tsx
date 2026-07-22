import { LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SupportLinksManager } from './SupportLinksManager';

/**
 * Entry point for the Issues tab toolbar: a "Support Links" button that opens a
 * slide-over for managing public customer-support intake links. Uses a Sheet
 * (not a Dialog) so the manager's own create/edit Dialog can open on top without
 * dialog-in-dialog nesting issues.
 */
export function SupportLinksSheet({
  projectId,
  iconOnly = false,
}: {
  projectId: string;
  iconOnly?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            aria-label="Support API"
            className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 active:opacity-90 transition-opacity"
          >
            <LifeBuoy className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 shrink-0 px-2 md:px-3">
            <LifeBuoy className="h-4 w-4" />
            <span className="hidden md:inline">Support API</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Customer Support API
          </SheetTitle>
          <SheetDescription>
            Generate API keys so your systems can create issues via the intake API.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <SupportLinksManager projectId={projectId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
