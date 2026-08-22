import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useECODetail } from '@/hooks/useECOs';
import { ECOListItem, fromApiEcoDetail } from './ecoData';
import { ECOListView } from './ECOListView';
import { ECODetailView } from './ECODetailView';
import { ECOWizard } from './ECOWizard';

type WizardState = { ecoId: string | null; isRework?: boolean } | null;

export function ECOView({
  projectId,
  projectName,
  newTrigger,
  onNewConsumed,
  openEcoId = null,
  onOpenEcoIdChange,
}: {
  projectId: string;
  projectName?: string;
  newTrigger?: boolean;
  onNewConsumed?: () => void;
  openEcoId?: string | null;
  onOpenEcoIdChange?: (id: string | null) => void;
}) {
  const [wizard, setWizard] = useState<WizardState>(null);

  useEffect(() => {
    if (newTrigger) {
      setWizard({ ecoId: null });
      onNewConsumed?.();
    }
  }, [newTrigger]);

  // Resolves openEcoId (from the URL) into a full ECOListItem by fetching that ECO
  // directly — works regardless of which page it's on, and on a direct deep link / refresh.
  const { data: detailRaw, isLoading: detailLoading } = useECODetail(projectId, openEcoId ?? undefined);
  const detail = detailRaw ? fromApiEcoDetail(detailRaw) : null;
  const resolvedEco: ECOListItem | null = detail ? { ...detail, parts: detail.parts.length } : null;

  const setOpenEco = (eco: ECOListItem | null) => onOpenEcoIdChange?.(eco ? eco.id : null);

  return (
    <>
      {openEcoId ? (
        resolvedEco ? (
          <ECODetailView
            eco={resolvedEco}
            projectId={projectId}
            projectName={projectName}
            onBack={() => setOpenEco(null)}
            onEdit={eco => setWizard({ ecoId: eco.id, isRework: eco.status === 'REWORK' })}
          />
        ) : detailLoading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-center px-4">
            <p className="text-sm text-muted-foreground">This engineering change could not be found.</p>
            <Button variant="outline" size="sm" onClick={() => setOpenEco(null)}>
              Back to Eng. Changes
            </Button>
          </div>
        )
      ) : (
        <ECOListView
          projectId={projectId}
          onOpen={eco => setOpenEco(eco)}
          onNewEco={() => setWizard({ ecoId: null })}
        />
      )}
      {wizard !== null && (
        <ECOWizard
          projectId={projectId}
          ecoId={wizard.ecoId ?? undefined}
          isRework={wizard.isRework}
          onClose={(result) => {
            setWizard(null);
            if (result?.ecoId) onOpenEcoIdChange?.(result.ecoId);
          }}
        />
      )}
    </>
  );
}
