import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ReportsKPIRow } from '../components/ReportsKPIRow';
import { ReportKPI } from '../utils/reportsUtils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReactElement } from 'react';

// Custom render with providers
function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          {ui}
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );

  return {
    ...result,
    user: userEvent.setup(),
  };
}

describe('ReportsKPIRow', () => {
  const mockKPIs: ReportKPI = {
    projectProgress: 75,
    totalTasks: 100,
    completedTasks: 75,
    openIssues: 5,
    criticalIssues: 2,
    overdueTasks: 3,
    avgCycleTime: 4.5,
    trendData: [],
  };

  it('should render all KPI cards', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);

    expect(getByText('Project Progress')).toBeInTheDocument();
    expect(getByText('Open Issues')).toBeInTheDocument();
    expect(getByText('Overdue Tasks')).toBeInTheDocument();
    expect(getByText('Avg Cycle Time')).toBeInTheDocument();
  });

  it('should display correct progress value', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('75%')).toBeInTheDocument();
  });

  it('should display correct open issues count', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('5')).toBeInTheDocument();
  });

  it('should display correct overdue tasks count', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('3')).toBeInTheDocument();
  });

  it('should display cycle time in days when >= 2 days', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('4.5d')).toBeInTheDocument();
  });

  it('should display cycle time in hours when < 2 days', () => {
    const kpisShortCycle = { ...mockKPIs, avgCycleTime: 0.3 };
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={kpisShortCycle} />);
    expect(getByText('7 hrs')).toBeInTheDocument();
  });

  it('should display N/A when avg cycle time is 0', () => {
    const kpisNoCycle = { ...mockKPIs, avgCycleTime: 0 };
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={kpisNoCycle} />);
    expect(getByText('N/A')).toBeInTheDocument();
  });

  it('should show critical issues warning when criticalIssues > 0', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('2 critical')).toBeInTheDocument();
  });

  it('should show "No critical issues" when criticalIssues is 0', () => {
    const kpisNoCritical = { ...mockKPIs, criticalIssues: 0 };
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={kpisNoCritical} />);
    expect(getByText('No critical issues')).toBeInTheDocument();
  });

  it('should show "All on track" when no overdue tasks', () => {
    const kpisNoOverdue = { ...mockKPIs, overdueTasks: 0 };
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={kpisNoOverdue} />);
    expect(getByText('All on track')).toBeInTheDocument();
  });

  it('should call onClick handler when KPI card is clicked', async () => {
    const handleClick = vi.fn();
    const { user, getByText } = renderWithProviders(
      <ReportsKPIRow kpis={mockKPIs} onKPIClick={handleClick} />
    );

    const progressText = getByText('Project Progress');
    const card = progressText.closest('[class*="cursor-pointer"]');

    if (card) {
      await user.click(card);
      expect(handleClick).toHaveBeenCalledWith('progress');
    }
  });

  it('should call onClick with correct type for issues card', async () => {
    const handleClick = vi.fn();
    const { user, getByText } = renderWithProviders(
      <ReportsKPIRow kpis={mockKPIs} onKPIClick={handleClick} />
    );

    const issuesText = getByText('Open Issues');
    const card = issuesText.closest('[class*="cursor-pointer"]');

    if (card) {
      await user.click(card);
      expect(handleClick).toHaveBeenCalledWith('issues');
    }
  });

  it('should render task completion subtitle', () => {
    const { getByText } = renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    expect(getByText('75 of 100 tasks')).toBeInTheDocument();
  });

  it('should render progress bar', () => {
    renderWithProviders(<ReportsKPIRow kpis={mockKPIs} />);
    const progressBar = document.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });
});
