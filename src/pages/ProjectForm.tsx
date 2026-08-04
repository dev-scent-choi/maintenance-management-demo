import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, X, Save,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { useSettingsStore } from '../store/settingsStore';
import { useLanguage } from '../contexts/LanguageContext';
import { themeConfigs } from '../utils/themeConfig';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Project } from '../types';

const ProjectForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuthStore();
  const { addLog } = useAuditLogStore();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';
  const { addProject, updateProject } = useProjectStore();

  const getPrimaryBg = (alpha: number) => {
    const primary = themeColors.primary;
    if (primary.startsWith('#')) {
      return `${primary}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    }
    return primary.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  };

  const isEditMode = Boolean(id);

  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'planning' as Project['status'],
    companyId: '',
    startDate: '',
    dueDate: '',
    managerId: '',
    memberIds: [] as string[],
  });

  const statusOptions = [
    { value: "planning", label: t('planning') },
    { value: "in_progress", label: t('inProgressProject') },
    { value: "on_hold", label: t('onHold') },
    { value: "completed", label: t('completed') },
    { value: "cancelled", label: t('cancelled') }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setIsLoading(false); return; }
      try {
        const usersResponse = await fetch(import.meta.env.VITE_API_URL + '/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (usersResponse.ok) { const allUsers = await usersResponse.json(); setUsers(allUsers.filter((u: any) => u.active !== false)); }

        const companiesResponse = await fetch(import.meta.env.VITE_API_URL + '/companies', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (companiesResponse.ok) setCompanies(await companiesResponse.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id || !token) return;
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setFormData({
            name: data.name || '',
            description: data.description || '',
            status: (data.status?.toLowerCase() === 'active' ? 'in_progress' : data.status?.toLowerCase() || 'planning') as Project['status'],
            companyId: data.companyId?.toString() || '',
            startDate: data.startDate ? data.startDate.split('T')[0] : '',
            dueDate: data.endDate ? data.endDate.split('T')[0] : '',
            managerId: data.managerId?.toString() || '',
            memberIds: data.members?.map((m: number) => m.toString()).filter((m: string) => m !== data.managerId?.toString()) || [],
          });
        } else {
          alert(t('failedToLoadProject'));
          navigate('/projects');
        }
      } catch (error) {
        alert(t('failedToLoadProject'));
        navigate('/projects');
      }
    };
    if (isEditMode) fetchProject();
  }, [id, token, isEditMode, navigate]);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;
    if (!formData.name.trim() || !user || !token) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        const managerId = formData.managerId ? parseInt(formData.managerId) : parseInt(user.id);
        const requestBody = {
          name: formData.name,
          description: formData.description,
          status: formData.status === 'in_progress' ? 'ACTIVE' : formData.status.toUpperCase(),
          companyId: formData.companyId ? parseInt(formData.companyId) : null,
          startDate: formData.startDate || null,
          endDate: formData.dueDate || null,
          managerId,
          members: [managerId, ...formData.memberIds.map(id => parseInt(id)).filter(id => id !== managerId)],
        };

        const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const updatedProject = await response.json();
          addLog({ userId: user?.id, userName: user?.name, action: 'update', resourceType: 'project', resourceId: id, resourceName: formData.name, details: `프로젝트 정보가 수정되었습니다: ${formData.name}` });
          updateProject(id, {
            name: updatedProject.name,
            description: updatedProject.description,
            status: updatedProject.status.toLowerCase(),
            companyId: updatedProject.companyId?.toString(),
            companyName: companies.find(c => c.id === updatedProject.companyId)?.name,
            memberIds: updatedProject.members?.map((m: number) => m.toString()) || [],
            startDate: updatedProject.startDate ? new Date(updatedProject.startDate) : undefined,
            dueDate: updatedProject.endDate ? new Date(updatedProject.endDate) : undefined,
          });
          alert(t('projectUpdated'));
          navigate(`/projects/${id}`);
        } else {
          alert(t('projectUpdateFailed'));
        }
      } else {
        const ownerId = formData.managerId || user.id;
        await addProject({
          name: formData.name,
          description: formData.description,
          status: formData.status,
          companyId: formData.companyId,
          ownerId,
          memberIds: [ownerId, ...formData.memberIds.filter(id => id !== ownerId)],
          startDate: formData.startDate ? new Date(formData.startDate) : undefined,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          progress: 0,
        });
        addLog({ userId: user?.id, userName: user?.name, action: 'create', resourceType: 'project', resourceName: formData.name, details: `새 프로젝트가 등록되었습니다: ${formData.name}` });
        navigate('/projects');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(t('projectSaveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
  };

  const optionStyle = {
    backgroundColor: theme !== 'light' ? '#1f2937' : 'white',
    color: theme !== 'light' ? '#fff' : '#000'
  };

  if (isLoading) return <LoadingSpinner message={t('loading')} />;

  // 선택된 PM 정보
  const selectedPM = users.find(u => u.id.toString() === formData.managerId);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="w-8 h-8 flex items-center justify-center rounded transition-opacity hover:opacity-60"
            style={{ color: themeColors.textSecondary }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>
            {isEditMode ? t('editProject') : t('newProject')}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.name || !formData.startDate || isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
          >
            <Save size={15} />
            {isSubmitting ? t('processing') : (isEditMode ? t('save') : t('register'))}
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
            style={{
              backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              color: themeColors.text,
              border: `1px solid ${themeColors.border}`,
              borderRadius: '4px',
            }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex gap-3 overflow-hidden">

        {/* Left: 기본정보 + 팀 구성 */}
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">

          {/* 기본 정보 카드 */}
          <div className="rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2.5">
                <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('basicInfo')}</h2>
              </div>
            </div>
            <div className="p-3 space-y-3">
              {/* 프로젝트명 */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('projectName')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('projectNamePlaceholder')}
                  required
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                />
              </div>
              {/* 설명 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('projectDescriptionPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all resize-none"
                  style={inputStyle}
                />
              </div>
              {/* 업체 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('company')}
                </label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                >
                  <option value="" style={optionStyle}>
                    {companies.length === 0 ? t('noCompaniesAvailable') : t('selectCompanyOptional')}
                  </option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id} style={optionStyle}>{company.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 팀 구성 카드 */}
          <div className="rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2.5">
                <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('teamStructure')}</h2>
              </div>
            </div>
            <div className="p-3 space-y-3">
              {/* 프로젝트 매니저 */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('projectManager')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => {
                    const newManagerId = e.target.value;
                    setFormData({ ...formData, managerId: newManagerId, memberIds: formData.memberIds.filter(id => id !== newManagerId) });
                  }}
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                  style={inputStyle}
                >
                  <option value="" style={optionStyle}>{t('selectManager')}</option>
                  {users.map(member => (
                    <option key={member.id} value={member.id.toString()} style={optionStyle}>
                      {member.name} ({member.department || member.email})
                    </option>
                  ))}
                </select>
                {selectedPM && (
                  <div className="flex items-center gap-2.5 mt-2 p-2.5 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#3B82F6' }}>
                      {selectedPM.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: themeColors.text }}>{selectedPM.name}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: '#3B82F6' }}>PM</span>
                      </div>
                      <p className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{selectedPM.department || selectedPM.email}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* 팀원 선택 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>{t('selectTeamMember')}</label>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: themeColors.textSecondary }}>
                    {formData.memberIds.length}{t('people')} {t('selected')}
                  </span>
                </div>
                {formData.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded" style={{ backgroundColor: theme !== 'light' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)' }}>
                    {formData.memberIds.map((memberId) => {
                      const member = users.find(u => u.id.toString() === memberId);
                      if (!member) return null;
                      return (
                        <span key={memberId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#22c55e' }}>
                          {member.name}
                          <button type="button" onClick={() => setFormData({ ...formData, memberIds: formData.memberIds.filter(id => id !== memberId) })} className="hover:opacity-70"><X size={12} /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto p-1">
                  {users.filter(u => u.id.toString() !== formData.managerId).length === 0 ? (
                    <div className="col-span-2 text-center py-6 text-sm" style={{ color: themeColors.textSecondary }}>
                      {formData.managerId ? t('noOtherUsers') : t('noUsersAvailable')}
                    </div>
                  ) : users.filter(u => u.id.toString() !== formData.managerId).map((member) => {
                    const memberId = member.id.toString();
                    const isSelected = formData.memberIds.includes(memberId);
                    return (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 p-2.5 rounded cursor-pointer transition-all"
                        style={{
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          border: `2px solid ${isSelected ? '#22c55e' : 'transparent'}`,
                        }}
                      >
                        <input type="checkbox" checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setFormData({ ...formData, memberIds: [...formData.memberIds, memberId] });
                            else setFormData({ ...formData, memberIds: formData.memberIds.filter(id => id !== memberId) });
                          }}
                          className="hidden"
                        />
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                          alt={member.name}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                          style={{ border: `2px solid ${isSelected ? '#22c55e' : 'transparent'}` }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: isSelected ? '#22c55e' : themeColors.text }}>{member.name}</p>
                          <p className="text-xs truncate" style={{ color: themeColors.textSecondary }}>{member.department || member.email}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#22c55e' }}>
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right: 일정 + 상태 */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* 일정 카드 */}
          <div className="rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2.5">
                <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{t('schedule')}</h3>
              </div>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('startDate')} <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  required
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ ...inputStyle, colorScheme: theme !== 'light' ? 'dark' : 'light' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: themeColors.textSecondary }}>
                  {t('dueDate')}
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  className="w-full px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{ ...inputStyle, colorScheme: theme !== 'light' ? 'dark' : 'light' }}
                />
              </div>
            </div>
          </div>

          {/* 상태 카드 */}
          <div className="rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2.5">
                <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
                <h3 className="text-base font-bold" style={{ color: themeColors.text }}>{t('status')}</h3>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {statusOptions.map((opt) => {
                const isSelected = formData.status === opt.value;
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 px-4 py-2.5 rounded cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected ? themeColors.primary : theme !== 'light' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isSelected ? themeColors.primary : themeColors.border}`,
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={opt.value}
                      checked={isSelected}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                      className="hidden"
                    />
                    <span className="text-sm font-medium" style={{ color: isSelected ? onPrimaryText : themeColors.text }}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProjectForm;
