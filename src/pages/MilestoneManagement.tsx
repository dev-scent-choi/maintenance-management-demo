import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Edit, Trash2, Check,
  CheckCircle2, Timer, Circle, AlertCircle, Flag,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import type { Timeline } from '../types';
import MilestoneSidePanel from './MilestoneSidePanel';

const MilestoneManagement: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { milestones, fetchProjectMilestones, addMilestone, updateMilestone, deleteMilestone } = useProjectStore();

  const subtleBg = theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const cardStyle = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMilestone, setPanelMilestone] = useState<Timeline | null>(null);

  const projectTimelines: Timeline[] = projectId ? milestones[projectId] || [] : [];
  const sortedTimelines = [...projectTimelines].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const completedCount = sortedTimelines.filter(tl => tl.status === 'completed').length;
  const totalCount = sortedTimelines.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (projectId) {
      fetchProjectMilestones(projectId);
    }
  }, [projectId, fetchProjectMilestones]);

  const openPanel = (milestone?: Timeline) => {
    setPanelMilestone(milestone || null);
    setPanelOpen(true);
  };

  const handlePanelSave = async (data: { title: string; date: string; status: Timeline['status']; description: string }) => {
    if (!projectId) return;
    if (panelMilestone) {
      await updateMilestone(panelMilestone.id, {
        title: data.title,
        date: data.date,
        status: data.status,
        description: data.description || undefined,
      });
    } else {
      await addMilestone(projectId, {
        title: data.title,
        date: data.date,
        status: data.status,
        description: data.description || undefined,
      });
    }
  };

  const handlePanelDelete = async () => {
    if (!panelMilestone || !projectId) return;
    await deleteMilestone(panelMilestone.id, projectId);
  };

  const handleToggleComplete = async (tl: Timeline) => {
    const newStatus = tl.status === 'completed' ? 'upcoming' : 'completed';
    await updateMilestone(tl.id, { status: newStatus });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const isOverdue = (date: Date | string, status: string) => {
    if (status === 'completed') return false;
    return new Date(date) < new Date();
  };

  const getStatusConfig = (status: string, date: Date | string) => {
    if (status === 'completed') return { icon: CheckCircle2, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', label: t('milestoneCompleted') };
    if (status === 'in_progress') return { icon: Timer, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', label: t('milestoneInProgress') };
    if (status === 'missed' || isOverdue(date, status)) return { icon: AlertCircle, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', label: t('milestoneDelayed') };
    return { icon: Circle, color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)', label: t('milestoneUpcoming') };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t('milestoneCompleted');
      case 'in_progress': return t('milestoneInProgress');
      case 'missed': return t('milestoneDelayed');
      default: return t('milestoneUpcoming');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
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
              {t('milestoneManagement')}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textSecondary }}>
              {t('milestoneProgress')}
            </p>
          </div>
        </div>
        <button
          onClick={() => openPanel()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-white text-xs transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
        >
          <Plus size={14} /> {t('addMilestone')}
        </button>
      </div>

      {/* Progress Summary */}
      {totalCount > 0 && (
        <div className="rounded-xl p-4" style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flag size={16} style={{ color: themeColors.primary }} />
              <span className="text-sm font-semibold" style={{ color: themeColors.text }}>
                {t('milestoneProgress')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: '#10B981' }}>
                {completedCount}/{totalCount} {t('milestoneAchieved')}
              </span>
              <span className="text-lg font-bold" style={{ color: themeColors.primary }}>
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: subtleBg }}>
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${themeColors.primary}, #10B981)`,
              }}
            />
            {/* Checkpoint markers on progress bar */}
            {sortedTimelines.map((_, idx) => {
              const position = ((idx + 1) / totalCount) * 100;
              const tl = sortedTimelines[idx];
              const isDone = tl.status === 'completed';
              return (
                <div
                  key={tl.id}
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition-all"
                  style={{
                    left: `calc(${position}% - 5px)`,
                    backgroundColor: isDone ? '#10B981' : themeColors.surface,
                    borderColor: isDone ? '#10B981' : themeColors.border,
                  }}
                />
              );
            })}
          </div>

          {/* Milestone mini labels */}
          <div className="flex justify-between mt-2">
            <span className="text-[10px]" style={{ color: themeColors.textSecondary }}>
              {t('start')}
            </span>
            <span className="text-[10px]" style={{ color: themeColors.textSecondary }}>
              {t('milestoneRemaining')}: {totalCount - completedCount}
            </span>
          </div>
        </div>
      )}

      {/* Checkpoint List */}
      <div className="rounded-xl p-4" style={cardStyle}>
        {sortedTimelines.length > 0 ? (
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[15px] top-4 bottom-4 w-[2px]"
              style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            />

            {sortedTimelines.map((tl, idx) => {
              const statusConfig = getStatusConfig(tl.status, tl.date);
              const overdue = isOverdue(tl.date, tl.status);

              return (
                <div key={tl.id} className="flex gap-3 py-2.5 relative group">
                  {/* Checkpoint circle */}
                  <button
                    onClick={() => handleToggleComplete(tl)}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all hover:scale-110"
                    style={{
                      backgroundColor: statusConfig.bg,
                      border: `2px solid ${statusConfig.color}`,
                    }}
                    title={tl.status === 'completed' ? t('milestoneUpcoming') : t('milestoneCompleted')}
                  >
                    {tl.status === 'completed' ? (
                      <Check size={14} style={{ color: statusConfig.color }} strokeWidth={3} />
                    ) : tl.status === 'in_progress' ? (
                      <Timer size={14} style={{ color: statusConfig.color }} />
                    ) : overdue ? (
                      <AlertCircle size={14} style={{ color: statusConfig.color }} />
                    ) : (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig.color, opacity: 0.4 }} />
                    )}
                  </button>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 p-3 rounded-lg transition-all"
                    style={{
                      backgroundColor: tl.status === 'in_progress' ? `${statusConfig.color}08` : subtleBg,
                      border: tl.status === 'in_progress' ? `1px solid ${statusConfig.color}30` : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{
                            color: tl.status === 'completed' ? themeColors.textSecondary : themeColors.text,
                            textDecoration: tl.status === 'completed' ? 'line-through' : 'none',
                          }}
                        >
                          {tl.title}
                        </span>
                        {tl.status === 'in_progress' && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 animate-pulse"
                            style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                          >
                            {statusConfig.label}
                          </span>
                        )}
                        {overdue && tl.status !== 'completed' && tl.status !== 'in_progress' && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                          >
                            {t('milestoneDelayed')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => openPanel(tl)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: themeColors.textSecondary }}
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => openPanel(tl)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: overdue ? '#EF4444' : themeColors.textSecondary }}
                      >
                        {formatDate(tl.date)}
                      </span>
                      {tl.description && (
                        <>
                          <span className="text-[10px]" style={{ color: themeColors.textSecondary }}>·</span>
                          <span className="text-xs line-clamp-1" style={{ color: themeColors.textSecondary }}>
                            {tl.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Flag size={32} className="mx-auto mb-3" style={{ color: themeColors.textSecondary, opacity: 0.3 }} />
            <p className="text-sm" style={{ color: themeColors.textSecondary }}>{t('noMilestones')}</p>
            <button
              onClick={() => openPanel()}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-white text-xs mx-auto transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
            >
              <Plus size={14} /> {t('addMilestone')}
            </button>
          </div>
        )}
      </div>

      <MilestoneSidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSave={handlePanelSave}
        onDelete={panelMilestone ? handlePanelDelete : undefined}
        milestone={panelMilestone}
      />
    </div>
  );
};

export default MilestoneManagement;
