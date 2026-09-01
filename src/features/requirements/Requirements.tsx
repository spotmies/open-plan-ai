import { useEffect } from 'react';
import { ListChecks } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayoutSkeleton } from '@/components/layout/AppLayoutSkeleton';
import RequirementsView from '../projects/components/RequirementsView';

export default function Requirements() {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  useEffect(() => {
    document.title = 'Requirements | Open Plan AI';
    return () => { document.title = 'Open Plan AI'; };
  }, []);

  if (orgLoading) return <AppLayoutSkeleton variant="default" />;

  if (!currentOrganization) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Requirements</h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No organization selected.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 md:-mx-6 -mb-6">
        <RequirementsView />
      </div>
    </div>
  );
}
