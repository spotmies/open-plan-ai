import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarViewMode } from '@/types';
import { formatDateRangeLabel } from '../utils/calendarUtils';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  actions?: React.ReactNode;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  actions,
}) => {
  const dateLabel =
    viewMode === 'month' ? format(currentDate, 'yyyy') : formatDateRangeLabel(currentDate, viewMode);
  const todayButtonLabel =
    viewMode === 'month' ? format(currentDate, 'MMMM') : viewMode === 'week' ? 'This Week' : 'Today';

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: Title and date navigation */}
      <div className="flex items-center gap-4">


        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onNavigatePrevious} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onNavigateToday} className="h-8">
            {todayButtonLabel}
          </Button>
          <Button variant="outline" size="icon" onClick={onNavigateNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm font-medium text-foreground min-w-[200px]">
          {dateLabel}
        </span>
      </div>

      {/* Right: View mode toggle and Actions */}
      <div className="flex items-center gap-2">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as CalendarViewMode)}>
          <TabsList className="h-9">
            <TabsTrigger value="month" className="text-xs px-3">
              Month
            </TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3">
              Week
            </TabsTrigger>
            <TabsTrigger value="day" className="text-xs px-3">
              Day
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {actions}
      </div>
    </div>
  );
};
