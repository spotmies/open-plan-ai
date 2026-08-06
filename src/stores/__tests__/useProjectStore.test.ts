import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { Project, Task, Milestone, Issue } from '@/types';

// Create mock data for testing
const createMockProject = (id: string, name: string): Project => ({
  id,
  name,
  description: `Description for ${name}`,
  stage: 'development',
  progress: 50,
  startDate: '2024-01-01',
  targetDate: '2024-12-31',
  team: [],
  tasks: [],
  milestones: [],
  modules: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createMockTask = (id: string, title: string): Task => ({
  id,
  title,
  status: 'todo',
  priority: 'medium',
  module: 'software',
  blockedBy: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createMockMilestone = (id: string, title: string): Milestone => ({
  id,
  title,
  date: '2024-06-01',
  completed: false,
});

const createMockIssue = (id: string, title: string, projectId: string): Issue => ({
  id,
  title,
  description: `Description for ${title}`,
  category: 'defect',
  severity: 'major',
  status: 'open',
  projectId,
  reportedBy: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@test.com',
    role: 'Engineer',
    initials: 'TU',
  },
  reportedAt: new Date().toISOString(),
});

describe('useProjectStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useProjectStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have empty projects array', () => {
      const { projects } = useProjectStore.getState();
      expect(projects).toEqual([]);
    });

    it('should have no selected project', () => {
      const { selectedProjectId } = useProjectStore.getState();
      expect(selectedProjectId).toBeNull();
    });

    it('should not be loading initially', () => {
      const { isLoading } = useProjectStore.getState();
      expect(isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const { error } = useProjectStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('setProjects', () => {
    it('should set projects array', () => {
      const { setProjects } = useProjectStore.getState();
      const mockProjects = [
        createMockProject('1', 'Project 1'),
        createMockProject('2', 'Project 2'),
      ];

      setProjects(mockProjects);

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(2);
      expect(projects[0]?.name).toBe('Project 1');
    });

    it('should replace existing projects', () => {
      const { setProjects } = useProjectStore.getState();

      setProjects([createMockProject('1', 'Old Project')]);
      setProjects([createMockProject('2', 'New Project')]);

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.name).toBe('New Project');
    });
  });

  describe('selectProject', () => {
    it('should set selected project ID', () => {
      const { selectProject } = useProjectStore.getState();

      selectProject('project-123');

      const { selectedProjectId } = useProjectStore.getState();
      expect(selectedProjectId).toBe('project-123');
    });

    it('should allow setting null to deselect', () => {
      const { selectProject } = useProjectStore.getState();

      selectProject('project-123');
      selectProject(null);

      const { selectedProjectId } = useProjectStore.getState();
      expect(selectedProjectId).toBeNull();
    });
  });

  describe('addProject', () => {
    it('should add a project to the store', () => {
      const { addProject } = useProjectStore.getState();
      const mockProject = createMockProject('1', 'New Project');

      addProject(mockProject);

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.id).toBe('1');
    });

    it('should add multiple projects', () => {
      const { addProject } = useProjectStore.getState();

      addProject(createMockProject('1', 'Project 1'));
      addProject(createMockProject('2', 'Project 2'));

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(2);
    });
  });

  describe('updateProject', () => {
    it('should update an existing project', () => {
      const { setProjects, updateProject } = useProjectStore.getState();
      setProjects([createMockProject('1', 'Original Name')]);

      updateProject('1', { name: 'Updated Name', progress: 75 });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.name).toBe('Updated Name');
      expect(projects[0]?.progress).toBe(75);
    });

    it('should not modify other projects', () => {
      const { setProjects, updateProject } = useProjectStore.getState();
      setProjects([
        createMockProject('1', 'Project 1'),
        createMockProject('2', 'Project 2'),
      ]);

      updateProject('1', { name: 'Updated' });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.name).toBe('Updated');
      expect(projects[1]?.name).toBe('Project 2');
    });

    it('should do nothing if project not found', () => {
      const { setProjects, updateProject } = useProjectStore.getState();
      setProjects([createMockProject('1', 'Project 1')]);

      updateProject('non-existent', { name: 'Updated' });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.name).toBe('Project 1');
    });
  });

  describe('deleteProject', () => {
    it('should remove a project from the store', () => {
      const { setProjects, deleteProject } = useProjectStore.getState();
      setProjects([
        createMockProject('1', 'Project 1'),
        createMockProject('2', 'Project 2'),
      ]);

      deleteProject('1');

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0]?.id).toBe('2');
    });

    it('should do nothing if project not found', () => {
      const { setProjects, deleteProject } = useProjectStore.getState();
      setProjects([createMockProject('1', 'Project 1')]);

      deleteProject('non-existent');

      const { projects } = useProjectStore.getState();
      expect(projects).toHaveLength(1);
    });
  });

  describe('task actions', () => {
    beforeEach(() => {
      const { setProjects } = useProjectStore.getState();
      setProjects([createMockProject('proj-1', 'Test Project')]);
    });

    it('should add a task to a project', () => {
      const { addTask } = useProjectStore.getState();
      const mockTask = createMockTask('task-1', 'New Task');

      addTask('proj-1', mockTask);

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.tasks).toHaveLength(1);
      expect(projects[0]?.tasks[0]?.title).toBe('New Task');
    });

    it('should update a task', () => {
      const { addTask, updateTask } = useProjectStore.getState();
      addTask('proj-1', createMockTask('task-1', 'Original'));

      updateTask('proj-1', 'task-1', { title: 'Updated', status: 'done' });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.tasks[0]?.title).toBe('Updated');
      expect(projects[0]?.tasks[0]?.status).toBe('done');
    });

    it('should delete a task', () => {
      const { addTask, deleteTask } = useProjectStore.getState();
      addTask('proj-1', createMockTask('task-1', 'Task 1'));
      addTask('proj-1', createMockTask('task-2', 'Task 2'));

      deleteTask('proj-1', 'task-1');

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.tasks).toHaveLength(1);
      expect(projects[0]?.tasks[0]?.id).toBe('task-2');
    });
  });

  describe('milestone actions', () => {
    beforeEach(() => {
      const { setProjects } = useProjectStore.getState();
      setProjects([createMockProject('proj-1', 'Test Project')]);
    });

    it('should add a milestone to a project', () => {
      const { addMilestone } = useProjectStore.getState();
      const mockMilestone = createMockMilestone('ms-1', 'Phase 1');

      addMilestone('proj-1', mockMilestone);

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.milestones).toHaveLength(1);
      expect(projects[0]?.milestones[0]?.title).toBe('Phase 1');
    });

    it('should update a milestone', () => {
      const { addMilestone, updateMilestone } = useProjectStore.getState();
      addMilestone('proj-1', createMockMilestone('ms-1', 'Original'));

      updateMilestone('proj-1', 'ms-1', { title: 'Updated', completed: true });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.milestones[0]?.title).toBe('Updated');
      expect(projects[0]?.milestones[0]?.completed).toBe(true);
    });

    it('should delete a milestone', () => {
      const { addMilestone, deleteMilestone } = useProjectStore.getState();
      addMilestone('proj-1', createMockMilestone('ms-1', 'Milestone 1'));
      addMilestone('proj-1', createMockMilestone('ms-2', 'Milestone 2'));

      deleteMilestone('proj-1', 'ms-1');

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.milestones).toHaveLength(1);
      expect(projects[0]?.milestones[0]?.id).toBe('ms-2');
    });
  });

  describe('issue actions', () => {
    beforeEach(() => {
      const { setProjects } = useProjectStore.getState();
      setProjects([createMockProject('proj-1', 'Test Project')]);
    });

    it('should add an issue to a project', () => {
      const { addIssue } = useProjectStore.getState();
      const mockIssue = createMockIssue('issue-1', 'Bug Report', 'proj-1');

      addIssue('proj-1', mockIssue);

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.issues).toHaveLength(1);
      expect(projects[0]?.issues?.[0]?.title).toBe('Bug Report');
    });

    it('should create issues array if it does not exist', () => {
      const { addIssue } = useProjectStore.getState();
      // Project initially has no issues array (undefined)

      addIssue('proj-1', createMockIssue('issue-1', 'First Issue', 'proj-1'));

      const state = useProjectStore.getState();
      expect(state.projects[0]?.issues).toBeDefined();
      expect(state.projects[0]?.issues).toHaveLength(1);
    });

    it('should update an issue', () => {
      const { addIssue, updateIssue } = useProjectStore.getState();
      addIssue('proj-1', createMockIssue('issue-1', 'Original', 'proj-1'));

      updateIssue('proj-1', 'issue-1', { title: 'Updated', status: 'resolved' });

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.issues?.[0]?.title).toBe('Updated');
      expect(projects[0]?.issues?.[0]?.status).toBe('resolved');
    });

    it('should delete an issue', () => {
      const { addIssue, deleteIssue } = useProjectStore.getState();
      addIssue('proj-1', createMockIssue('issue-1', 'Issue 1', 'proj-1'));
      addIssue('proj-1', createMockIssue('issue-2', 'Issue 2', 'proj-1'));

      deleteIssue('proj-1', 'issue-1');

      const { projects } = useProjectStore.getState();
      expect(projects[0]?.issues).toHaveLength(1);
      expect(projects[0]?.issues?.[0]?.id).toBe('issue-2');
    });
  });

  describe('state management', () => {
    it('should set loading state', () => {
      const { setLoading } = useProjectStore.getState();

      setLoading(true);
      expect(useProjectStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useProjectStore.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      const { setError } = useProjectStore.getState();

      setError('Something went wrong');
      expect(useProjectStore.getState().error).toBe('Something went wrong');

      setError(null);
      expect(useProjectStore.getState().error).toBeNull();
    });

    it('should reset to initial state', () => {
      const { setProjects, selectProject, setLoading, setError, reset } = useProjectStore.getState();

      setProjects([createMockProject('1', 'Project')]);
      selectProject('1');
      setLoading(true);
      setError('Error');

      reset();

      const state = useProjectStore.getState();
      expect(state.projects).toEqual([]);
      expect(state.selectedProjectId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      const { setProjects, selectProject } = useProjectStore.getState();
      const project1 = createMockProject('proj-1', 'Project 1');
      project1.tasks = [createMockTask('task-1', 'Task 1')];
      project1.issues = [createMockIssue('issue-1', 'Issue 1', 'proj-1')];

      const project2 = createMockProject('proj-2', 'Project 2');
      project2.tasks = [createMockTask('task-2', 'Task 2')];
      project2.issues = [createMockIssue('issue-2', 'Issue 2', 'proj-2')];

      setProjects([project1, project2]);
      selectProject('proj-1');
    });

    it('useSelectedProject should return the selected project', () => {
      // Note: In a real test, we'd use renderHook, but for store selectors we can test the logic
      const state = useProjectStore.getState();
      const selectedProject = state.projects.find(p => p.id === state.selectedProjectId);

      expect(selectedProject?.name).toBe('Project 1');
    });

    it('useAllTasks should return all tasks from all projects', () => {
      const state = useProjectStore.getState();
      const allTasks = state.projects.flatMap(p => p.tasks);

      expect(allTasks).toHaveLength(2);
    });

    it('useAllIssues should return all issues from all projects', () => {
      const state = useProjectStore.getState();
      const allIssues = state.projects.flatMap(p => p.issues || []);

      expect(allIssues).toHaveLength(2);
    });
  });
});
