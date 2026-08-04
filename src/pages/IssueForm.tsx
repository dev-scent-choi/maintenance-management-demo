import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Shield, Bug, Lightbulb, Zap, HelpCircle, AlertCircle, Calendar, UserCircle, Tag } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  department?: string;
}

const IssueForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId, issueId } = useParams<{ id: string; issueId?: string }>();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { user, token } = useAuthStore();
  const { addIssue, updateIssue, issues, fetchProjectIssues } = useProjectStore();

  const isEditMode = !!issueId;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'bug' as 'bug' | 'feature' | 'improvement' | 'question' | 'other',
    severity: 'major' as 'minor' | 'major' | 'critical' | 'blocker',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    assigneeId: '',
    dueDate: '',
    labels: '',
  });

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const subtleBg = theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBg = theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
  const sectionBg = theme !== 'light' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)';
  const optionStyle = { backgroundColor: themeColors.surface, color: themeColors.text };
  const inputStyle = {
    backgroundColor: inputBg,
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
  };

  // Load existing issue for edit mode
  useEffect(() => {
    if (isEditMode && projectId) {
      fetchProjectIssues(projectId);
    }
  }, [isEditMode, projectId, fetchProjectIssues]);

  useEffect(() => {
    if (isEditMode && issueId) {
      const existingIssue = issues.find((i) => i.id === issueId);
      if (existingIssue) {
        setFormData({
          title: existingIssue.title,
          description: existingIssue.description || '',
          type: existingIssue.type as 'feature' | 'improvement' | 'bug' | 'question' | 'other',
          severity: existingIssue.severity || 'major',
          priority: existingIssue.priority,
          assigneeId: existingIssue.assigneeId || '',
          dueDate: existingIssue.dueDate
            ? new Date(existingIssue.dueDate).toISOString().split('T')[0]
            : '',
          labels: existingIssue.labels?.join(', ') || '',
        });
      }
    }
  }, [isEditMode, issueId, issues]);

  // Fetch project members
  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!projectId || !token) return;
      try {
        const projectRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const memberIds = [projectData.managerId, ...(projectData.members || [])];
          const usersRes = await fetch(import.meta.env.VITE_API_URL + '/users', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const members = usersData
              .filter((u: any) => memberIds.includes(u.id))
              .map((u: any) => ({
                id: u.id.toString(),
                name: u.name,
                email: u.email,
                department: u.department,
              }));
            setProjectMembers(members);
          }
        }
      } catch (error) {
        console.error('Error fetching project members:', error);
      }
    };
    fetchProjectMembers();
  }, [projectId, token]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert(t('issueTitle') + t('isRequired'));
      return;
    }
    if (!projectId) return;

    try {
      const labelsArray = formData.labels
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (isEditMode && issueId) {
        await updateIssue(issueId, {
          title: formData.title,
          description: formData.description,
          type: formData.type,
          severity: formData.severity,
          priority: formData.priority,
          assigneeId: formData.assigneeId || undefined,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          labels: labelsArray,
        });
      } else {
        await addIssue({
          projectId,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          status: 'open',
          severity: formData.severity,
          priority: formData.priority,
          assigneeId: formData.assigneeId || undefined,
          reporterId: user?.id || '',
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          labels: labelsArray,
          attachments: [],
          comments: [],
        });
      }
      navigate(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error saving issue:', error);
      alert(t('saveFailed'));
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return Bug;
      case 'feature': return Lightbulb;
      case 'improvement': return Zap;
      case 'question': return HelpCircle;
      default: return AlertCircle;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bug': return '#EF4444';
      case 'feature': return '#8B5CF6';
      case 'improvement': return '#3B82F6';
      case 'question': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const TypeIcon = getTypeIcon(formData.type);

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
          <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
            {isEditMode ? t('editIssue') : t('createIssue')}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!formData.title.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-white text-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
          >
            <Save size={14} />
            {isEditMode ? t('save') : t('createIssue')}
          </button>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all"
            style={{
              backgroundColor: subtleBg,
              color: themeColors.text,
              border: `1px solid ${themeColors.border}`,
            }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      {/* Main content - 2 columns */}
      <div
        className="flex-1 rounded-xl overflow-hidden flex"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        {/* Left: Form */}
        <div className="flex-1 overflow-y-auto p-6" style={{ borderRight: `1px solid ${themeColors.border}` }}>
          <div className="space-y-6">
            {/* Basic Info Section */}
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: sectionBg,
                border: `1px solid ${themeColors.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-5 pb-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                <Shield size={18} style={{ color: themeColors.primary }} />
                <h3 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('issueBasicInfo')}</h3>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                    {t('issueTitle')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('issueTitle')}
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                    {t('issueDescription')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('issueDescription')}
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all resize-none"
                    style={inputStyle}
                  />
                </div>

                {/* Type & Severity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                      <TypeIcon size={14} style={{ color: getTypeColor(formData.type) }} />
                      {t('issueType')}
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                      style={inputStyle}
                    >
                      <option value="bug" style={optionStyle}>{t('issueTypeBug')}</option>
                      <option value="feature" style={optionStyle}>{t('issueTypeFeature')}</option>
                      <option value="improvement" style={optionStyle}>{t('issueTypeImprovement')}</option>
                      <option value="other" style={optionStyle}>{t('issueTypeOther')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                      <AlertCircle size={14} />
                      {t('issueSeverity')}
                    </label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                      style={inputStyle}
                    >
                      <option value="minor" style={optionStyle}>{t('severityMinor')}</option>
                      <option value="major" style={optionStyle}>{t('severityMajor')}</option>
                      <option value="critical" style={optionStyle}>{t('severityCritical')}</option>
                      <option value="blocker" style={optionStyle}>{t('severityBlocker')}</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                    <Shield size={14} />
                    {t('issuePriority')}
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  >
                    <option value="low" style={optionStyle}>{t('low')}</option>
                    <option value="medium" style={optionStyle}>{t('medium')}</option>
                    <option value="high" style={optionStyle}>{t('high')}</option>
                    <option value="critical" style={optionStyle}>{t('severityCritical')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Properties sidebar */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="p-5 border-b flex items-center gap-2" style={{ borderColor: themeColors.border }}>
            <Tag size={18} style={{ color: themeColors.primary }} />
            <h3 className="text-sm font-bold" style={{ color: themeColors.text }}>{t('issueProperties')}</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                <UserCircle size={14} />
                {t('issueAssignee')}
              </label>
              <select
                value={formData.assigneeId}
                onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                style={inputStyle}
              >
                <option value="" style={optionStyle}>-</option>
                {projectMembers.map((member) => (
                  <option key={member.id} value={member.id} style={optionStyle}>
                    {member.name} {member.department ? `(${member.department})` : `(${member.email})`}
                  </option>
                ))}
              </select>
              {formData.assigneeId && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: inputBg }}>
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.assigneeId}&backgroundColor=b6e3f4,c0aede,d1d4f9`}
                    alt="Assignee"
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <p className="text-xs font-medium" style={{ color: themeColors.text }}>
                      {projectMembers.find((m) => m.id === formData.assigneeId)?.name}
                    </p>
                    <p className="text-[10px]" style={{ color: themeColors.textSecondary }}>
                      {projectMembers.find((m) => m.id === formData.assigneeId)?.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                <Calendar size={14} />
                {t('issueDueDate')}
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                onClick={(e) => {
                  const input = e.currentTarget;
                  if (input.showPicker) input.showPicker();
                }}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer"
                style={inputStyle}
              />
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: themeColors.text }}>
                <Tag size={14} />
                {t('issueLabels')}
              </label>
              <input
                type="text"
                value={formData.labels}
                onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                placeholder={t('labelsPlaceholder')}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
                style={inputStyle}
              />
              {formData.labels && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.labels
                    .split(',')
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0)
                    .map((label, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}
                      >
                        {label}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Type preview */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: subtleBg }}>
              <p className="text-[10px] mb-2" style={{ color: themeColors.textSecondary }}>{t('issueType')}</p>
              <div className="flex items-center gap-2">
                <TypeIcon size={16} style={{ color: getTypeColor(formData.type) }} />
                <span className="text-xs font-semibold" style={{ color: getTypeColor(formData.type) }}>
                  {formData.type === 'bug' ? t('issueTypeBug') :
                   formData.type === 'feature' ? t('issueTypeFeature') :
                   formData.type === 'improvement' ? t('issueTypeImprovement') :
                   t('issueTypeOther')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueForm;
