import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronRight, AlertCircle, Calendar,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import type { Task } from '../types';
import TaskCreateModal from './TaskCreateModal';

const getMemberAvatarUrl = (memberId: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

const ProjectBoard: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { token } = useAuthStore();
  const { tasks, fetchProjectTasks, moveTask, deleteTask } = useProjectStore();

  const subtleBg = theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const cardStyle = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
  };

  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);

  const projectTasks: Task[] = projectId ? tasks[projectId] || [] : [];

  useEffect(() => {
    const loadData = async () => {
      if (!projectId || !token) { setIsLoading(false); return; }
      try {
        await fetchProjectTasks(projectId);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProjectName(data.name || '');
        }
      } catch (error) {
        console.error('Error loading board data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [projectId, token, fetchProjectTasks]);

  const columns: { status: Task['status']; label: string; color: string; headerBg: string }[] = [
    { status: 'todo', label: t('todoStatus'), color: '#6B7280', headerBg: 'rgba(107, 114, 128, 0.1)' },
    { status: 'in_progress', label: t('inProgressStatus'), color: '#3B82F6', headerBg: 'rgba(59, 130, 246, 0.1)' },
    { status: 'review', label: t('reviewStatus'), color: '#F59E0B', headerBg: 'rgba(245, 158, 11, 0.1)' },
    { status: 'done', label: t('doneStatus'), color: '#10B981', headerBg: 'rgba(16, 185, 129, 0.1)' },
  ];

  const getNextStatus = (current: Task['status']): Task['status'] | null => {
    switch (current) {
      case 'todo': return 'in_progress';
      case 'in_progress': return 'review';
      case 'review': return 'done';
      default: return null;
    }
  };

  const getPrevStatus = (current: Task['status']): Task['status'] | null => {
    switch (current) {
      case 'in_progress': return 'todo';
      case 'review': return 'in_progress';
      case 'done': return 'review';
      default: return null;
    }
  };

  const getNextLabel = (current: Task['status']) => {
    switch (current) {
      case 'todo': return t('moveToInProgress');
      case 'in_progress': return t('moveToReview');
      case 'review': return t('moveToDone');
      default: return '';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#EF4444';
      case 'high': return '#F97316';
      case 'medium': return '#EAB308';
      default: return '#94A3B8';
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleMoveTask = async (taskId: string, newStatus: Task['status']) => {
    try {
      await moveTask(taskId, newStatus);
    } catch (error) {
      console.error('Error moving task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: themeColors.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
            style={{
              backgroundColor: subtleBg,
              color: themeColors.textSecondary,
              border: `1px solid ${themeColors.border}`,
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
              {t('projectBoard')}
            </h1>
            {projectName && (
              <p className="text-xs" style={{ color: themeColors.textSecondary }}>{projectName}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowTaskModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`, color: theme === 'yellow' ? '#333333' : '#ffffff' }}
        >
          <Plus size={14} /> {t('addTask')}
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-4 gap-3 min-h-0 overflow-hidden">
        {columns.map((col) => {
          const columnTasks = projectTasks
            .filter((task) => task.status === col.status)
            .sort((a, b) => {
              const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
              return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
            });

          return (
            <div key={col.status} className="flex flex-col rounded-xl overflow-hidden" style={cardStyle}>
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: col.headerBg }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-bold" style={{ color: col.color }}>{col.label}</span>
                </div>
                <span
                  className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${col.color}20`, color: col.color }}
                >
                  {columnTasks.length}
                </span>
              </div>

              {/* Column body */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                    const nextStatus = getNextStatus(task.status);
                    const prevStatus = getPrevStatus(task.status);

                    return (
                      <div
                        key={task.id}
                        className="rounded-lg p-3 group transition-all"
                        style={{
                          backgroundColor: subtleBg,
                          border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.3)' : 'transparent'}`,
                        }}
                      >
                        {/* Priority bar + title */}
                        <div className="flex items-start gap-2">
                          <div
                            className="w-[3px] h-5 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: getPriorityColor(task.priority) }}
                          />
                          <p className="text-sm font-medium line-clamp-2 flex-1" style={{ color: themeColors.text }}>
                            {(task.description || task.title).replace(/<[^>]*>/g, '').trim()}
                          </p>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {task.dueDate && (
                            <span
                              className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                              style={{
                                color: isOverdue ? '#EF4444' : themeColors.textSecondary,
                                backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                              }}
                            >
                              {isOverdue ? <AlertCircle size={9} /> : <Calendar size={9} />}
                              {formatDate(task.dueDate)}
                            </span>
                          )}
                          {task.assigneeId && (
                            <img
                              src={getMemberAvatarUrl(task.assigneeId)}
                              alt=""
                              className="w-5 h-5 rounded-full ml-auto"
                            />
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {prevStatus && (
                            <button
                              onClick={() => handleMoveTask(task.id, prevStatus)}
                              className="text-xs px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-0.5"
                              style={{ color: themeColors.textSecondary, backgroundColor: subtleBg }}
                            >
                              <ChevronRight size={9} className="rotate-180" />
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              onClick={() => handleMoveTask(task.id, nextStatus)}
                              className="text-xs px-1.5 py-0.5 rounded font-medium transition-colors flex items-center gap-0.5"
                              style={{ color: col.color, backgroundColor: `${col.color}10` }}
                            >
                              {getNextLabel(task.status)} <ChevronRight size={9} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirmId(task.id)}
                            className="text-xs px-1.5 py-0.5 rounded font-medium transition-colors ml-auto"
                            style={{ color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.06)' }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-20">
                    <p className="text-xs" style={{ color: themeColors.textSecondary, opacity: 0.5 }}>
                      {t('noTasks')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmId(null)}>
          <div
            className="rounded-xl shadow-2xl max-w-sm w-full p-5"
            style={{ ...cardStyle, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <AlertCircle size={20} style={{ color: '#EF4444' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('delete')}</h3>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('deleteTaskConfirm')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteTask(deleteConfirmId)}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-white text-sm transition-all bg-red-500 hover:bg-red-600"
              >
                {t('delete')}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-3 py-2 rounded-lg font-semibold text-sm"
                style={{ backgroundColor: subtleBg, color: themeColors.text }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectId && (
        <TaskCreateModal
          isOpen={showTaskModal}
          projectId={projectId}
          onClose={() => setShowTaskModal(false)}
          onSaved={() => fetchProjectTasks(projectId)}
        />
      )}
    </div>
  );
};

export default ProjectBoard;
