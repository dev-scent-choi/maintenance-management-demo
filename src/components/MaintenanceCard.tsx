import React from 'react';
import { Clock, AlertCircle, CheckCircle2, XCircle, Calendar, User, Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { getLocaleFromLanguage } from '../utils/formatters';
import type { MaintenanceRecord } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MaintenanceCardProps {
  record: MaintenanceRecord;
}

const MaintenanceCard: React.FC<MaintenanceCardProps> = ({ record }) => {
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);
  const themeColors = themeConfigs[theme];
  const locale = getLocaleFromLanguage(language);
  const t = useLanguage();

  const getStatusConfig = (status: MaintenanceRecord['status']) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, bg: '#FEF3C7', color: '#92400E', label: t('statusWaiting') };
      case 'in-progress':
        return { icon: AlertCircle, bg: '#DBEAFE', color: '#1E40AF', label: t('statusProcessing') };
      case 'completed':
        return { icon: CheckCircle2, bg: '#D1FAE5', color: '#065F46', label: t('statusCompleted') };
      case 'urgent':
        return { icon: XCircle, bg: '#FEE2E2', color: '#991B1B', label: t('statusUrgent') };
      case 'on-hold':
        return { icon: XCircle, bg: '#E3E2E0', color: '#787774', label: t('statusOnHold') };
    }
  };

  const getPriorityConfig = (priority: MaintenanceRecord['priority']) => {
    switch (priority) {
      case 'low':
        return { color: '#6B7280', label: t('priorityLow') };
      case 'medium':
        return { color: '#3B82F6', label: t('priorityMedium') };
      case 'high':
        return { color: '#F59E0B', label: t('priorityHigh') };
      case 'urgent':
        return { color: '#EF4444', label: t('priorityUrgent') };
    }
  };

  const statusConfig = getStatusConfig(record.status);
  const priorityConfig = getPriorityConfig(record.priority);
  const StatusIcon = statusConfig.icon;

  return (
    <div
      onClick={() => navigate(`/maintenance/${record.id}`)}
      className="p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      style={{
        backgroundColor: themeColors.surface,
        borderColor: themeColors.border,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1 line-clamp-2" style={{ color: themeColors.text }}>
            {record.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Badge */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
            >
              <StatusIcon size={12} />
              {statusConfig.label}
            </span>

            {/* Priority Badge */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${priorityConfig.color}20`, color: priorityConfig.color }}
            >
              {priorityConfig.label}
            </span>
          </div>
        </div>
        <ChevronRight size={20} style={{ color: themeColors.textSecondary }} className="flex-shrink-0 ml-2" />
      </div>

      {/* Company & Assignee */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <Building2 size={14} style={{ color: themeColors.textSecondary }} className="flex-shrink-0" />
          <span className="text-sm truncate" style={{ color: themeColors.text }}>
            {record.companyName}
          </span>
        </div>

        {record.assignedToName && (
          <div className="flex items-center gap-2">
            <User size={14} style={{ color: themeColors.textSecondary }} className="flex-shrink-0" />
            <span className="text-sm truncate" style={{ color: themeColors.text }}>
              {record.assignedToName}
            </span>
          </div>
        )}
      </div>

      {/* Dates */}
      {(record.startDate || record.expectedCompletionDate) && (
        <div className="flex items-center gap-2 text-xs" style={{ color: themeColors.textSecondary }}>
          <Calendar size={12} className="flex-shrink-0" />
          <span>
            {record.startDate && new Date(record.startDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            {record.startDate && record.expectedCompletionDate && ' ~ '}
            {record.expectedCompletionDate && new Date(record.expectedCompletionDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Files Badge */}
      {record.files && record.files.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: themeColors.border }}>
          <div className="inline-flex items-center gap-1 text-xs" style={{ color: themeColors.textSecondary }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{t('attachmentCount', { count: record.files.length })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceCard;
