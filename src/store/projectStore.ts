import { create } from 'zustand';
import type { Project, Task, Issue, Timeline, ChecklistItem, TaskComment, ProjectDocument } from '../types';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { uploadWithProgress } from '../utils/uploadWithProgress';
import toast from 'react-hot-toast';

interface ProjectState {
  projects: Project[];
  tasks: Record<string, Task[]>; // projectId -> tasks
  issues: Issue[];
  timelines: Record<string, Timeline[]>; // projectId -> timelines
  isLoading: boolean;

  // 현재 선택
  currentProjectId: string | null;
  currentView: 'board' | 'list' | 'timeline' | 'calendar';

  // 프로젝트 관리
  setCurrentProject: (projectId: string | null) => void;
  setCurrentView: (view: 'board' | 'list' | 'timeline' | 'calendar') => void;
  fetchProjects: () => Promise<void>;
  fetchProjectTasks: (projectId: string) => Promise<void>;
  fetchProjectIssues: (projectId: string) => Promise<void>;
  fetchProjectTimeline: (projectId: string) => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  updateProjectProgress: (projectId: string) => Promise<void>;

  // 태스크 관리
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string, silent?: boolean) => Promise<void>;
  moveTask: (taskId: string, newStatus: Task['status']) => Promise<void>;
  assignTask: (taskId: string, assigneeId: string) => Promise<void>;
  addChecklistItem: (taskId: string, text: string) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  addTaskComment: (taskId: string, content: string) => Promise<void>;

  // 이슈 관리
  addIssue: (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateIssue: (issueId: string, updates: Partial<Issue>) => Promise<void>;
  deleteIssue: (issueId: string, silent?: boolean) => Promise<void>;
  resolveIssue: (issueId: string) => Promise<void>;
  closeIssue: (issueId: string) => Promise<void>;

  // 타임라인 관리
  addTimeline: (timeline: Omit<Timeline, 'id' | 'createdAt'>) => void;
  updateTimeline: (timelineId: string, updates: Partial<Timeline>) => void;
  deleteTimeline: (timelineId: string) => void;

  // 마일스톤 관리 (백엔드 연동)
  milestones: Record<string, Timeline[]>; // projectId -> milestones
  fetchProjectMilestones: (projectId: string) => Promise<void>;
  addMilestone: (projectId: string, data: { title: string; date: string; status: Timeline['status']; description?: string }) => Promise<void>;
  updateMilestone: (milestoneId: string, data: Partial<{ title: string; date: string; status: string; description: string }>) => Promise<void>;
  deleteMilestone: (milestoneId: string, projectId: string) => Promise<void>;

  // 문서 관리
  fetchProjectDocuments: (projectId: string) => Promise<ProjectDocument[]>;
  uploadProjectDocument: (projectId: string, file: File, folderName?: string | null, onProgress?: (pct: number) => void) => Promise<ProjectDocument>;
  deleteProjectDocument: (projectId: string, documentId: string) => Promise<void>;
  renameProjectDocument: (projectId: string, documentId: string, newName: string) => Promise<ProjectDocument>;
  fetchProjectFolders: (projectId: string) => Promise<string[]>;
  createProjectFolder: (projectId: string, folderName: string) => Promise<void>;
  renameProjectFolder: (projectId: string, oldName: string, newName: string) => Promise<void>;
  deleteProjectFolder: (projectId: string, folderName: string) => Promise<void>;

  // 통계 및 유틸리티
  getProjectStats: (projectId: string) => {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    openIssues: number;
    overdueItems: number;
  };
  getTasksByStatus: (projectId: string, status: Task['status']) => Task[];
  getOverdueTasks: (projectId: string) => Task[];
}

import { API_BASE_URL as _API_BASE } from '../config';
const API_BASE_URL = `${_API_BASE}/projects`;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  tasks: {},
  issues: [],
  timelines: {},
  milestones: {},
  isLoading: false,
  currentProjectId: null,
  currentView: 'board',

  setCurrentProject: (projectId) => set({ currentProjectId: projectId }),

  setCurrentView: (view) => set({ currentView: view }),

  // ==================== Project DB Integration ====================

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(API_BASE_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch projects');

      const data = await response.json();
      const convertedProjects: Project[] = data.map((proj: any) => ({
        id: proj.id.toString(),
        name: proj.name,
        description: proj.description || '',
        status: (() => {
          const s = proj.status?.toLowerCase();
          if (s === 'active') return 'in_progress';
          if (s === 'hold') return 'on_hold';
          return (s || 'planning') as Project['status'];
        })(),
        startDate: proj.startDate ? new Date(proj.startDate) : undefined,
        dueDate: proj.endDate ? new Date(proj.endDate) : undefined,
        progress: proj.progress,
        companyId: proj.companyId?.toString(),
        companyName: proj.companyName,
        managerName: proj.managerName || undefined,
        ownerId: proj.managerId.toString(),
        memberIds: proj.members?.map((id: number) => id.toString()) || [],
        createdAt: new Date(proj.createdAt),
        updatedAt: new Date(proj.updatedAt),
      }));

      set({ projects: convertedProjects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('프로젝트 목록을 불러오는데 실패했습니다.');
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProjectTasks: async (projectId: string) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/${projectId}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = await response.json();
      const convertedTasks: Task[] = data.map((task: any) => ({
        id: task.id.toString(),
        projectId: task.projectId.toString(),
        title: task.title,
        description: task.description || '',
        status: task.status.toLowerCase() as Task['status'],
        priority: task.priority.toLowerCase() as Task['priority'],
        assigneeId: task.assigneeId?.toString(),
        reporterId: task.reporterId.toString(),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        estimatedHours: task.estimatedHours,
        actualHours: task.actualHours,
        weight: task.weight, // 가중치 추가
        tags: task.labels || [],
        checklistItems: [], // Will be loaded separately if needed
        attachments: task.attachments?.map((attachment: any) => ({
          id: attachment.id.toString(),
          name: attachment.fileName || attachment.name || 'file',
          url: attachment.filePath || attachment.url || '',
          type: attachment.fileType || attachment.type || 'file',
          size: attachment.fileSize || attachment.size || 0,
          uploadedBy: attachment.uploadedBy?.toString() || task.reporterId.toString(),
          uploadedAt: attachment.uploadedAt ? new Date(attachment.uploadedAt) : new Date(task.createdAt)
        })) || [],
        comments: [], // Will be loaded separately if needed
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      }));


      set((state) => ({
        tasks: { ...state.tasks, [projectId]: convertedTasks }
      }));
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  },

  fetchProjectIssues: async (projectId: string) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/${projectId}/issues`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch issues');

      const data = await response.json();
      const convertedIssues: Issue[] = data.map((issue: any) => ({
        id: issue.id.toString(),
        projectId: issue.projectId.toString(),
        title: issue.title,
        description: issue.description || '',
        type: issue.type.toLowerCase() as Issue['type'],
        status: issue.status.toLowerCase() as Issue['status'],
        priority: issue.severity.toLowerCase() as Issue['priority'],
        severity: issue.severity.toLowerCase() as Issue['severity'],
        assigneeId: issue.assigneeId?.toString(),
        reporterId: issue.reporterId.toString(),
        dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
        labels: [],
        resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt) : undefined,
        closedAt: issue.closedAt ? new Date(issue.closedAt) : undefined,
        attachments: issue.attachments?.map((url: string, idx: number) => ({
          id: `${issue.id}-${idx}`,
          name: url.split('/').pop() || 'file',
          url,
          type: 'file',
          size: 0,
          uploadedBy: issue.reporterId.toString(),
          uploadedAt: new Date(issue.createdAt)
        })) || [],
        comments: [],
        createdAt: new Date(issue.createdAt),
        updatedAt: new Date(issue.updatedAt),
      }));

      set({ issues: convertedIssues });
    } catch (error) {
      console.error('Error fetching issues:', error);
    }
  },

  fetchProjectTimeline: async (projectId: string) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/${projectId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch timeline');

      const data = await response.json();
      const convertedTimeline: Timeline[] = data.map((tl: any) => ({
        id: tl.id.toString(),
        projectId: tl.projectId.toString(),
        title: tl.title,
        description: tl.description,
        type: 'event' as Timeline['type'], // Backend has different types
        date: new Date(tl.createdAt),
        status: 'completed' as Timeline['status'],
        relatedTaskIds: tl.relatedId ? [tl.relatedId.toString()] : [],
        createdBy: tl.actorId.toString(),
        createdAt: new Date(tl.createdAt),
      }));

      set((state) => {
        // Preserve locally-added milestones (id starts with 'timeline-')
        const existing = state.timelines[projectId] || [];
        const localMilestones = existing.filter((t) => String(t.id).startsWith('timeline-'));
        return {
          timelines: { ...state.timelines, [projectId]: [...localMilestones, ...convertedTimeline] },
        };
      });
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  },

  addProject: async (projectData) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectData.name,
          description: projectData.description,
          status: projectData.status === 'in_progress' ? 'ACTIVE' : projectData.status.toUpperCase(),
          companyId: projectData.companyId ? parseInt(projectData.companyId) : null,
          managerId: projectData.ownerId || user.id,
          members: projectData.memberIds,
          startDate: projectData.startDate instanceof Date ? projectData.startDate.toISOString().split('T')[0] : (projectData.startDate || null),
          endDate: projectData.dueDate instanceof Date ? projectData.dueDate.toISOString().split('T')[0] : (projectData.dueDate || null),
        })
      });

      if (!response.ok) throw new Error('Failed to create project');

      const data = await response.json();
      const newProject: Project = {
        id: data.id.toString(),
        name: data.name,
        description: data.description || '',
        status: (data.status.toLowerCase() === 'active' ? 'in_progress' : data.status.toLowerCase()) as Project['status'],
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.endDate ? new Date(data.endDate) : undefined,
        progress: data.progress,
        companyId: data.companyId?.toString(),
        companyName: data.companyName,
        ownerId: data.managerId.toString(),
        memberIds: data.members?.filter((id: string | null) => id != null) || [],
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };

      set((state) => ({
        projects: [...state.projects, newProject],
        tasks: { ...state.tasks, [newProject.id]: [] },
        timelines: { ...state.timelines, [newProject.id]: [] },
        issues: [],
      }));

      toast.success('프로젝트가 생성되었습니다.');
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('프로젝트 생성에 실패했습니다.');
    }
  },

  updateProject: async (projectId, updates) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          status: updates.status === 'in_progress' ? 'ACTIVE' : updates.status?.toUpperCase(),
          companyId: updates.companyId ? parseInt(updates.companyId) : null,
          managerId: updates.ownerId || null,
          members: updates.memberIds,
          startDate: updates.startDate instanceof Date ? updates.startDate.toISOString().split('T')[0] : (updates.startDate || null),
          endDate: updates.dueDate instanceof Date ? updates.dueDate.toISOString().split('T')[0] : (updates.dueDate || null),
        })
      });

      if (!response.ok) throw new Error('Failed to update project');

      const data = await response.json();
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? {
            ...p,
            name: data.name,
            description: data.description || '',
            status: (data.status.toLowerCase() === 'active' ? 'in_progress' : data.status.toLowerCase()) as Project['status'],
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            dueDate: data.endDate ? new Date(data.endDate) : undefined,
            progress: data.progress,
            companyId: data.companyId?.toString(),
            companyName: data.companyName,
            ownerId: data.managerId || p.ownerId,
            managerName: data.managerName || p.managerName,
            memberIds: data.members?.filter((id: string | null) => id != null) || [],
            updatedAt: new Date(data.updatedAt),
          } : p
        ),
      }));

      toast.success('프로젝트가 업데이트되었습니다.');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('프로젝트 업데이트에 실패했습니다.');
    }
  },

  deleteProject: async (projectId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to delete project');

      set((state) => {
        const newTasks = { ...state.tasks };
        delete newTasks[projectId];

        const newTimelines = { ...state.timelines };
        delete newTimelines[projectId];

        return {
          projects: state.projects.filter((p) => p.id !== projectId),
          tasks: newTasks,
          timelines: newTimelines,
          issues: state.issues.filter((i) => i.projectId !== projectId),
          currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
        };
      });

      toast.success('프로젝트가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('프로젝트 삭제에 실패했습니다.');
    }
  },

  // ==================== Task DB Integration ====================

  addTask: async (taskData) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: parseInt(taskData.projectId),
          title: taskData.title,
          description: taskData.description,
          status: taskData.status.toUpperCase(),
          priority: taskData.priority.toUpperCase(),
          assigneeId: taskData.assigneeId || null,
          labels: taskData.tags,
          dueDate: taskData.dueDate instanceof Date ? taskData.dueDate.toISOString().split('T')[0] : (taskData.dueDate || null),
          estimatedHours: taskData.estimatedHours,
        })
      });

      if (!response.ok) throw new Error('Failed to create task');

      const data = await response.json();
      const newTask: Task = {
        id: data.id.toString(),
        projectId: data.projectId.toString(),
        title: data.title,
        description: data.description || '',
        status: data.status.toLowerCase() as Task['status'],
        priority: data.priority.toLowerCase() as Task['priority'],
        assigneeId: data.assigneeId?.toString(),
        reporterId: data.reporterId.toString(),
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        estimatedHours: data.estimatedHours,
        actualHours: data.actualHours,
        tags: data.labels || [],
        checklistItems: [],
        attachments: [],
        comments: [],
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };

      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskData.projectId]: [...(state.tasks[taskData.projectId] || []), newTask],
        },
      }));

      // Update project progress
      await get().updateProjectProgress(taskData.projectId);

      const { addNotification } = useNotificationStore.getState();

      // 담당자에게 알림
      if (newTask.assigneeId && newTask.assigneeId !== user.id) {
        addNotification({
          type: 'task_assigned',
          title: '새 작업이 할당되었습니다',
          message: `"${newTask.title}" 작업이 할당되었습니다.`,
          relatedResourceType: 'task',
          relatedResourceId: newTask.id,
          userId: newTask.assigneeId,
          isRead: false,
          priority: 'normal',
        });
      }

      // 프로젝트 전체 멤버에게 알림 (본인, 담당자 제외)
      const project = get().projects.find((p) => p.id === newTask.projectId);
      if (project) {
        project.memberIds.forEach((memberId) => {
          if (memberId !== user.id && memberId !== newTask.assigneeId) {
            addNotification({
              type: 'task_assigned',
              title: '프로젝트에 새 작업이 추가되었습니다',
              message: `[${project.name}] "${newTask.title}" 작업이 추가되었습니다.`,
              relatedResourceType: 'task',
              relatedResourceId: newTask.id,
              userId: memberId,
              isRead: false,
              priority: 'low',
            });
          }
        });
      }

      toast.success('작업이 생성되었습니다.');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('작업 생성에 실패했습니다.');
    }
  },

  updateTask: async (taskId, updates) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: updates.title,
          description: updates.description,
          status: updates.status === 'review' ? 'IN_REVIEW' : updates.status?.toUpperCase(),
          priority: updates.priority?.toUpperCase(),
          ...('assigneeId' in updates ? { assigneeId: updates.assigneeId || null } : {}),
          dueDate: updates.dueDate
            ? (updates.dueDate instanceof Date
                ? updates.dueDate.toISOString().split('T')[0]
                : String(updates.dueDate).split('T')[0])
            : null,
          estimatedHours: updates.estimatedHours,
          actualHours: updates.actualHours,
          ...('weight' in updates ? { weight: updates.weight } : {}),
          completedAt: updates.status === 'done' ? new Date().toISOString() : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update task');

      const data = await response.json();
      set((state) => {
        const newTasks = { ...state.tasks };
        Object.keys(newTasks).forEach((projectId) => {
          newTasks[projectId] = newTasks[projectId].map((t) =>
            t.id === taskId ? {
              ...t,
              title: data.title,
              description: data.description || '',
              status: data.status.toLowerCase() as Task['status'],
              priority: data.priority.toLowerCase() as Task['priority'],
              assigneeId: data.assigneeId?.toString(),
              dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
              completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
              estimatedHours: data.estimatedHours,
              actualHours: data.actualHours,
              weight: data.weight !== undefined ? data.weight : (updates.weight !== undefined ? updates.weight : t.weight),
              updatedAt: new Date(data.updatedAt),
            } : t
          );
        });
        return { tasks: newTasks };
      });

      // Update project progress
      const task = Object.values(get().tasks).flat().find((t) => t.id === taskId);
      if (task) {
        await get().updateProjectProgress(task.projectId);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('작업 업데이트에 실패했습니다.');
    }
  },

  deleteTask: async (taskId, silent = false) => {
    const task = Object.values(get().tasks).flat().find((t) => t.id === taskId);

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to delete task');

      set((state) => {
        const newTasks = { ...state.tasks };
        Object.keys(newTasks).forEach((projectId) => {
          newTasks[projectId] = newTasks[projectId].filter((t) => t.id !== taskId);
        });
        return { tasks: newTasks };
      });

      if (task) {
        await get().updateProjectProgress(task.projectId);
      }

      if (!silent) toast.success('작업이 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('작업 삭제에 실패했습니다.');
    }
  },

  moveTask: async (taskId, newStatus) => {
    await get().updateTask(taskId, { status: newStatus });

    if (newStatus === 'done') {
      toast.success('작업이 완료되었습니다!');
    }
  },

  assignTask: async (taskId, assigneeId) => {
    const user = useAuthStore.getState().user;

    await get().updateTask(taskId, { assigneeId });

    if (user && assigneeId !== user.id) {
      const task = Object.values(get().tasks).flat().find((t) => t.id === taskId);

      if (task) {
        useNotificationStore.getState().addNotification({
          type: 'task_assigned',
          title: '작업이 할당되었습니다',
          message: `"${task.title}" 작업이 할당되었습니다.`,
          relatedResourceType: 'task',
          relatedResourceId: taskId,
          userId: assigneeId,
          isRead: false,
          priority: 'normal',
        });
      }
    }
  },

  addChecklistItem: async (taskId, text) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Failed to add checklist item');

      const data = await response.json();
      const newItem: ChecklistItem = {
        id: data.id.toString(),
        text: data.text,
        completed: data.completed,
        completedBy: data.completedBy?.toString(),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      };

      set((state) => {
        const newTasks = { ...state.tasks };
        Object.keys(newTasks).forEach((projectId) => {
          newTasks[projectId] = newTasks[projectId].map((t) =>
            t.id === taskId
              ? { ...t, checklistItems: [...t.checklistItems, newItem] }
              : t
          );
        });
        return { tasks: newTasks };
      });
    } catch (error) {
      console.error('Error adding checklist item:', error);
    }
  },

  toggleChecklistItem: async (taskId, itemId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/checklist/${itemId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to toggle checklist item');

      const data = await response.json();
      set((state) => {
        const newTasks = { ...state.tasks };
        Object.keys(newTasks).forEach((projectId) => {
          newTasks[projectId] = newTasks[projectId].map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  checklistItems: t.checklistItems.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          completed: data.completed,
                          completedBy: data.completedBy?.toString(),
                          completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
                        }
                      : item
                  ),
                }
              : t
          );
        });
        return { tasks: newTasks };
      });
    } catch (error) {
      console.error('Error toggling checklist item:', error);
    }
  },

  addTaskComment: async (taskId, content) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) throw new Error('Failed to add comment');

      const data = await response.json();
      const newComment: TaskComment = {
        id: data.id.toString(),
        taskId: data.taskId.toString(),
        content: data.content,
        authorId: data.authorId.toString(),
        authorName: data.authorName,
        createdAt: new Date(data.createdAt),
      };

      set((state) => {
        const newTasks = { ...state.tasks };
        Object.keys(newTasks).forEach((projectId) => {
          newTasks[projectId] = newTasks[projectId].map((t) =>
            t.id === taskId
              ? { ...t, comments: [...t.comments, newComment] }
              : t
          );
        });
        return { tasks: newTasks };
      });
    } catch (error) {
      console.error('Error adding task comment:', error);
    }
  },

  // ==================== Issue DB Integration ====================

  addIssue: async (issueData) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: issueData.projectId ? parseInt(issueData.projectId) : null,
          title: issueData.title,
          description: issueData.description,
          type: issueData.type.toUpperCase(),
          severity: (issueData.severity || 'major').toUpperCase(),
          assigneeId: issueData.assigneeId || null,
          dueDate: issueData.dueDate instanceof Date ? issueData.dueDate.toISOString().split('T')[0] : (issueData.dueDate || null),
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[addIssue] server error', response.status, errText);
        throw new Error('Failed to create issue');
      }

      const data = await response.json();
      const newIssue: Issue = {
        id: data.id.toString(),
        projectId: data.projectId?.toString(),
        title: data.title,
        description: data.description || '',
        type: data.type.toLowerCase() as Issue['type'],
        status: 'open',
        priority: data.severity.toLowerCase() as Issue['priority'],
        severity: data.severity.toLowerCase() as Issue['severity'],
        assigneeId: data.assigneeId?.toString(),
        reporterId: data.reporterId.toString(),
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        labels: [],
        attachments: [],
        comments: [],
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };

      set((state) => ({
        issues: [...state.issues, newIssue],
      }));

      const { addNotification: addNotif } = useNotificationStore.getState();

      // 담당자에게 알림
      if (newIssue.assigneeId && newIssue.assigneeId !== user.id) {
        addNotif({
          type: 'system',
          title: '새 이슈가 할당되었습니다',
          message: `[${newIssue.type.toUpperCase()}] ${newIssue.title}`,
          relatedResourceType: 'project',
          relatedResourceId: newIssue.id,
          userId: newIssue.assigneeId,
          isRead: false,
          priority: 'normal',
        });
      }

      // 프로젝트 전체 멤버에게 알림 (본인, 담당자 제외)
      const issueProject = get().projects.find((p) => p.id === newIssue.projectId);
      if (issueProject) {
        issueProject.memberIds.forEach((memberId) => {
          if (memberId !== user.id && memberId !== newIssue.assigneeId) {
            addNotif({
              type: 'system',
              title: '프로젝트에 새 이슈가 등록되었습니다',
              message: `[${issueProject.name}] [${newIssue.type.toUpperCase()}] ${newIssue.title}`,
              relatedResourceType: 'project',
              relatedResourceId: newIssue.projectId,
              userId: memberId,
              isRead: false,
              priority: newIssue.severity === 'critical' || newIssue.severity === 'blocker' ? 'high' : 'normal',
            });
          }
        });
      }

      toast.success('작업이 추가되었습니다.');
    } catch (error) {
      console.error('Error creating issue:', error);
      toast.error('작업 추가에 실패했습니다.');
    }
  },

  updateIssue: async (issueId, updates) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: updates.title,
          description: updates.description,
          type: updates.type?.toUpperCase(),
          status: updates.status?.toUpperCase(),
          priority: updates.priority?.toUpperCase(),
          severity: updates.severity?.toUpperCase(),
          ...('assigneeId' in updates ? { assigneeId: updates.assigneeId || null } : {}),
          dueDate: updates.dueDate
            ? (updates.dueDate instanceof Date
                ? updates.dueDate.toISOString().split('T')[0]
                : String(updates.dueDate).split('T')[0])
            : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update issue');

      const data = await response.json();
      set((state) => ({
        issues: state.issues.map((i) =>
          i.id === issueId ? {
            ...i,
            title: data.title,
            description: data.description || '',
            type: data.type?.toLowerCase() as Issue['type'],
            status: data.status.toLowerCase() as Issue['status'],
            severity: (data.severity?.toLowerCase() ?? updates.severity) as Issue['severity'],
            priority: (data.severity?.toLowerCase() ?? updates.severity) as Issue['priority'],
            assigneeId: data.assigneeId?.toString(),
            // 백엔드 응답에 dueDate 없을 경우 요청값(updates.dueDate)으로 낙관적 업데이트
            dueDate: data.dueDate ? new Date(data.dueDate) : updates.dueDate,
            updatedAt: new Date(data.updatedAt),
          } : i
        ),
      }));

      // status 변경 시 진행률 갱신
      if (updates.status !== undefined) {
        const projectId = get().issues.find(i => i.id === issueId)?.projectId
          ?? data.projectId?.toString();
        if (projectId) await get().updateProjectProgress(projectId);
      }
    } catch (error) {
      console.error('Error updating issue:', error);
      toast.error('이슈 업데이트에 실패했습니다.');
    }
  },

  deleteIssue: async (issueId, silent = false) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/issues/${issueId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to delete issue');

      set((state) => ({
        issues: state.issues.filter((i) => i.id !== issueId),
      }));

      if (!silent) toast.success('이슈가 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting issue:', error);
      toast.error('이슈 삭제에 실패했습니다.');
    }
  },

  resolveIssue: async (issueId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/issues/${issueId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to resolve issue');

      const data = await response.json();
      set((state) => ({
        issues: state.issues.map((i) =>
          i.id === issueId ? {
            ...i,
            status: 'resolved',
            resolvedAt: new Date(data.resolvedAt),
            updatedAt: new Date(data.updatedAt),
          } : i
        ),
      }));

      toast.success('이슈가 해결되었습니다.');
    } catch (error) {
      console.error('Error resolving issue:', error);
      toast.error('이슈 해결에 실패했습니다.');
    }
  },

  closeIssue: async (issueId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/issues/${issueId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) throw new Error('Failed to close issue');

      const data = await response.json();
      set((state) => ({
        issues: state.issues.map((i) =>
          i.id === issueId ? {
            ...i,
            status: 'closed',
            closedAt: new Date(data.closedAt),
            updatedAt: new Date(data.updatedAt),
          } : i
        ),
      }));

      toast.success('이슈가 종료되었습니다.');
    } catch (error) {
      console.error('Error closing issue:', error);
      toast.error('이슈 종료에 실패했습니다.');
    }
  },

  // ==================== Timeline (Local Only) ====================

  addTimeline: (timelineData) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const newTimeline: Timeline = {
      ...timelineData,
      id: `timeline-${Date.now()}`,
      createdAt: new Date(),
    };

    set((state) => ({
      timelines: {
        ...state.timelines,
        [timelineData.projectId]: [
          ...(state.timelines[timelineData.projectId] || []),
          newTimeline,
        ],
      },
    }));

    // 프로젝트 전체 멤버에게 알림 (본인 제외)
    const timelineProject = get().projects.find((p) => p.id === timelineData.projectId);
    if (timelineProject && user) {
      const { addNotification } = useNotificationStore.getState();
      timelineProject.memberIds.forEach((memberId) => {
        if (memberId !== user.id) {
          addNotification({
            type: 'system',
            title: '프로젝트 마일스톤이 추가되었습니다',
            message: `[${timelineProject.name}] "${newTimeline.title}" 일정이 추가되었습니다.`,
            relatedResourceType: 'project',
            relatedResourceId: timelineData.projectId,
            userId: memberId,
            isRead: false,
            priority: 'low',
          });
        }
      });
    }

    toast.success('타임라인 이벤트가 추가되었습니다.');
  },

  updateTimeline: (timelineId, updates) => {
    set((state) => {
      const newTimelines = { ...state.timelines };
      Object.keys(newTimelines).forEach((projectId) => {
        newTimelines[projectId] = newTimelines[projectId].map((t) =>
          t.id === timelineId ? { ...t, ...updates } : t
        );
      });
      return { timelines: newTimelines };
    });
  },

  deleteTimeline: (timelineId) => {
    set((state) => {
      const newTimelines = { ...state.timelines };
      Object.keys(newTimelines).forEach((projectId) => {
        newTimelines[projectId] = newTimelines[projectId].filter((t) => t.id !== timelineId);
      });
      return { timelines: newTimelines };
    });

    toast.success('타임라인 이벤트가 삭제되었습니다.');
  },

  // ==================== Milestone (Backend) ====================

  fetchProjectMilestones: async (projectId) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE_URL}/${projectId}/milestones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const converted: Timeline[] = data.map((m: any) => ({
        id: m.id.toString(),
        projectId: m.projectId.toString(),
        title: m.title,
        description: m.description,
        type: 'milestone' as Timeline['type'],
        date: m.milestoneDate ? new Date(m.milestoneDate) : new Date(m.createdAt),
        status: (m.milestoneStatus || 'upcoming') as Timeline['status'],
        relatedTaskIds: [],
        createdBy: m.actorId,
        actorName: m.actorName,
        createdAt: new Date(m.createdAt),
      }));
      set((state) => ({ milestones: { ...state.milestones, [projectId]: converted } }));
    } catch (e) {
      console.error('fetchProjectMilestones error:', e);
    }
  },

  addMilestone: async (projectId, data) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE_URL}/${projectId}/milestones`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add milestone');
      await res.json();
      // 저장 후 DB에서 전체 목록 재조회 (로컬 상태 수동 관리 대신)
      await get().fetchProjectMilestones(projectId);
      toast.success('마일스톤이 추가되었습니다.');
    } catch (e) {
      console.error('addMilestone error:', e);
      toast.error('마일스톤 추가에 실패했습니다.');
    }
  },

  updateMilestone: async (milestoneId, data) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE_URL}/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      const m = await res.json();
      // projectId를 응답에서 꺼내 재조회
      await get().fetchProjectMilestones(m.projectId.toString());
      toast.success('마일스톤이 수정되었습니다.');
    } catch (e) {
      console.error('updateMilestone error:', e);
      toast.error('마일스톤 수정에 실패했습니다.');
    }
  },

  deleteMilestone: async (milestoneId, projectId) => {
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE_URL}/milestones/${milestoneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete milestone');
      await get().fetchProjectMilestones(projectId);
      toast.success('마일스톤이 삭제되었습니다.');
    } catch (e) {
      console.error('deleteMilestone error:', e);
      toast.error('마일스톤 삭제에 실패했습니다.');
    }
  },

  // ==================== Stats & Utilities ====================

  getProjectStats: (projectId) => {
    const state = get();
    const tasks = state.tasks[projectId] || [];
    const issues = state.issues.filter((i) => i.projectId === projectId);

    const now = new Date();
    const overdueItems = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
    ).length;

    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === 'done').length,
      inProgressTasks: tasks.filter((t) => t.status === 'in_progress').length,
      openIssues: issues.filter((i) => i.status === 'open').length,
      overdueItems,
    };
  },

  getTasksByStatus: (projectId, status) => {
    const tasks = get().tasks[projectId] || [];
    return tasks.filter((t) => t.status === status);
  },

  getOverdueTasks: (projectId) => {
    const tasks = get().tasks[projectId] || [];
    const now = new Date();
    return tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
    );
  },

  // 프로젝트 진행률 업데이트 (작업 완료율 기반 자동 계산)
  updateProjectProgress: async (projectId: string) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      toast.error('인증 토큰이 없습니다.');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/progress`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to update project progress');

      // 프로젝트 목록 새로고침하여 업데이트된 진행률 가져오기
      await get().fetchProjects();

      toast.success('진행률이 업데이트되었습니다.');
    } catch (error) {
      console.error('Error updating project progress:', error);
      toast.error('진행률 업데이트에 실패했습니다.');
    }
  },

  // ==================== Project Document Management ====================

  fetchProjectDocuments: async (projectId) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE_URL}/${projectId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((doc: any) => ({
        id: doc.id.toString(),
        projectId,
        name: doc.fileName || doc.name || 'file',
        url: doc.fileUrl || doc.url || '',
        type: doc.fileType || doc.type || '',
        size: doc.fileSize || doc.size || 0,
        folderName: doc.folderName || null,
        uploadedBy: doc.uploadedBy?.toString() || '',
        uploadedByName: doc.uploadedByName || '',
        uploadedAt: new Date(doc.uploadedAt || doc.createdAt),
      })) as ProjectDocument[];
    } catch {
      return [];
    }
  },

  uploadProjectDocument: async (projectId, file, folderName, onProgress) => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('인증 토큰이 없습니다.');
    const formData = new FormData();
    formData.append('file', file);
    if (folderName) formData.append('folder', folderName);
    const doc = await uploadWithProgress(
      `${API_BASE_URL}/${projectId}/documents`,
      formData,
      token,
      onProgress,
    );
    return {
      id: doc.id.toString(),
      projectId,
      name: doc.fileName || doc.name || file.name,
      url: doc.fileUrl || doc.url || '',
      type: doc.fileType || doc.type || file.type,
      size: doc.fileSize || doc.size || file.size,
      folderName: doc.folderName || null,
      uploadedBy: doc.uploadedBy?.toString() || '',
      uploadedByName: doc.uploadedByName || '',
      uploadedAt: new Date(doc.uploadedAt || doc.createdAt || Date.now()),
    } as ProjectDocument;
  },

  deleteProjectDocument: async (projectId, documentId) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/${projectId}/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('파일 삭제에 실패했습니다.');
  },

  renameProjectDocument: async (projectId, documentId, newName) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/${projectId}/documents/${documentId}/rename`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) throw new Error('파일 이름 변경에 실패했습니다.');
    const doc = await response.json();
    return {
      id: doc.id.toString(), projectId,
      name: doc.fileName || doc.name || newName,
      url: doc.fileUrl || doc.url || '',
      type: doc.fileType || doc.type || '',
      size: doc.fileSize || doc.size || 0,
      folderName: doc.folderName || null,
      uploadedBy: doc.uploadedBy?.toString() || '',
      uploadedByName: doc.uploadedByName || '',
      uploadedAt: new Date(doc.uploadedAt || doc.createdAt || Date.now()),
    } as ProjectDocument;
  },

  fetchProjectFolders: async (projectId) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE_URL}/${projectId}/folders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map((f: any) => f.name || f) : [];
    } catch {
      return [];
    }
  },

  createProjectFolder: async (projectId, folderName) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/${projectId}/folders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName }),
    });
    if (!response.ok) throw new Error('폴더 생성에 실패했습니다.');
  },

  renameProjectFolder: async (projectId, oldName, newName) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/${projectId}/folders/rename`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
    if (!response.ok) throw new Error('폴더 이름 변경에 실패했습니다.');
  },

  deleteProjectFolder: async (projectId, folderName) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${API_BASE_URL}/${projectId}/folders?name=${encodeURIComponent(folderName)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('폴더 삭제에 실패했습니다.');
  },
}));
