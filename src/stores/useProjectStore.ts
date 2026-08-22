import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Project, Task, Milestone, Issue } from '@/types';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (projectId: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  
  // Task actions
  addTask: (projectId: string, task: Task) => void;
  updateTask: (projectId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  
  // Milestone actions
  addMilestone: (projectId: string, milestone: Milestone) => void;
  updateMilestone: (projectId: string, milestoneId: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (projectId: string, milestoneId: string) => void;
  
  // Issue actions
  addIssue: (projectId: string, issue: Issue) => void;
  updateIssue: (projectId: string, issueId: string, updates: Partial<Issue>) => void;
  deleteIssue: (projectId: string, issueId: string) => void;
  
  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  projects: [],
  selectedProjectId: null,
  isLoading: false,
  error: null,
};

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        
        setProjects: (projects) => set({ projects }),
        
        selectProject: (projectId) => set({ selectedProjectId: projectId }),
        
        addProject: (project) => set((state) => {
          state.projects.push(project);
        }),
        
        updateProject: (projectId, updates) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project) {
            Object.assign(project, updates);
          }
        }),
        
        deleteProject: (projectId) => set((state) => {
          state.projects = state.projects.filter(p => p.id !== projectId);
        }),
        
        // Task actions
        // `tasks`/`milestones` are absent on projects loaded via the org-level
        // list/detail endpoints (only useProjectDetail's merged fetch populates
        // them) — always default to [] rather than assuming the array exists.
        addTask: (projectId, task) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project) {
            if (!project.tasks) {
              project.tasks = [];
            }
            project.tasks.push(task);
          }
        }),

        updateTask: (projectId, taskId, updates) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.tasks) {
            const task = project.tasks.find(t => t.id === taskId);
            if (task) {
              Object.assign(task, updates);
            }
          }
        }),

        deleteTask: (projectId, taskId) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.tasks) {
            project.tasks = project.tasks.filter(t => t.id !== taskId);
          }
        }),

        // Milestone actions
        addMilestone: (projectId, milestone) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project) {
            if (!project.milestones) {
              project.milestones = [];
            }
            project.milestones.push(milestone);
          }
        }),

        updateMilestone: (projectId, milestoneId, updates) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.milestones) {
            const milestone = project.milestones.find(m => m.id === milestoneId);
            if (milestone) {
              Object.assign(milestone, updates);
            }
          }
        }),

        deleteMilestone: (projectId, milestoneId) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.milestones) {
            project.milestones = project.milestones.filter(m => m.id !== milestoneId);
          }
        }),
        
        // Issue actions
        addIssue: (projectId, issue) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project) {
            if (!project.issues) {
              project.issues = [];
            }
            project.issues.push(issue);
          }
        }),
        
        updateIssue: (projectId, issueId, updates) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.issues) {
            const issue = project.issues.find(i => i.id === issueId);
            if (issue) {
              Object.assign(issue, updates);
            }
          }
        }),
        
        deleteIssue: (projectId, issueId) => set((state) => {
          const project = state.projects.find(p => p.id === projectId);
          if (project?.issues) {
            project.issues = project.issues.filter(i => i.id !== issueId);
          }
        }),
        
        // State management
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        reset: () => set(initialState),
      })),
      {
        name: 'project-store',
        // Only persist the selected project ID.
        // React Query owns all server data (projects, tasks, milestones, issues)
        // and keeps it fresh. Persisting the full tree to localStorage causes
        // stale-data bugs and blocks the main thread on large datasets.
        partialize: (state) => ({
          selectedProjectId: state.selectedProjectId,
        }),
      }
    ),
    { name: 'ProjectStore' }
  )
);

// Selectors for optimized component subscriptions
export const useSelectedProject = () => 
  useProjectStore((state) => 
    state.projects.find(p => p.id === state.selectedProjectId)
  );

export const useProjectById = (projectId: string) =>
  useProjectStore((state) => 
    state.projects.find(p => p.id === projectId)
  );

export const useAllTasks = () =>
  useProjectStore((state) =>
    state.projects.flatMap(p => p.tasks || [])
  );

export const useAllIssues = () =>
  useProjectStore((state) => 
    state.projects.flatMap(p => p.issues || [])
  );
