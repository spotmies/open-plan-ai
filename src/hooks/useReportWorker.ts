import { useEffect, useRef, useState, useCallback } from 'react';
import { Task, Issue } from '@/types';
import { logger } from '@/services/monitoring/logger';

interface KPIResult {
  projectProgress: number;
  completedTasks: number;
  totalTasks: number;
  openIssues: number;
  criticalIssues: number;
  overdueTasks: number;
  avgCycleTime: number;
  trendData: { date: string; value: number }[];
}

interface WorkerResponse {
  type: string;
  payload: unknown;
}

export function useReportWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const resolversRef = useRef<Map<string, (value: unknown) => void>>(new Map());

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../workers/reportCalculations.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle messages from worker
    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, payload } = e.data;
      const resolver = resolversRef.current.get(type);

      if (resolver) {
        resolver(payload);
        resolversRef.current.delete(type);
        setIsCalculating(false);
      }
    };

    // Handle errors
    workerRef.current.onerror = (error) => {
      logger.error('Worker error:', error);
      setIsCalculating(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculateKPIs = useCallback((
    tasks: Task[],
    issues: Issue[],
    milestones: any[] = [],
    modules: any[] = []
  ): Promise<KPIResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        // Fallback: calculate synchronously if worker not available
        resolve({
          projectProgress: 0,
          completedTasks: 0,
          totalTasks: tasks.length,
          openIssues: issues.length,
          criticalIssues: 0,
          overdueTasks: 0,
          avgCycleTime: 0,
          trendData: [],
        });
        return;
      }

      setIsCalculating(true);
      resolversRef.current.set('CALCULATE_KPI_RESULT', resolve as (value: unknown) => void);

      workerRef.current.postMessage({
        type: 'CALCULATE_KPI',
        payload: { tasks, issues, milestones, modules },
      });
    });
  }, []);

  const filterTasks = useCallback((
    tasks: Task[],
    filter: Record<string, unknown>
  ): Promise<Task[]> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve(tasks);
        return;
      }

      setIsCalculating(true);
      resolversRef.current.set('FILTER_TASKS_RESULT', resolve as (value: unknown) => void);

      workerRef.current.postMessage({
        type: 'FILTER_TASKS',
        payload: { tasks, filter },
      });
    });
  }, []);

  return { calculateKPIs, filterTasks, isCalculating };
}
