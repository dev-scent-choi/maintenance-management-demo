import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { themeConfigs } from '../utils/themeConfig';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../contexts/LanguageContext';
import type { ProjectAssignment } from '../types';

const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const toast = useToast();
  const t = useLanguage();

  const companyEmail = useSettingsStore((state) => state.settings.companyEmail);
  const companyEmailDomain = companyEmail && companyEmail.includes('@') ? companyEmail.split('@')[1] : '';

  const isNewRecord = !id || id === 'new';
  const [isLoading, setIsLoading] = useState(false);
  const [usernameId, setUsernameId] = useState('');

  interface RoleInfo {
    id: string;
    name: string;
    description: string;
  }

  const loadAvailableRoles = (): RoleInfo[] => {
    const stored = localStorage.getItem('role_list');
    if (stored) {
      const parsedRoles = JSON.parse(stored);
      return parsedRoles.map((role: RoleInfo) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      }));
    }
    return [
      { id: 'admin', name: 'admin', description: '전체 시스템 접근 권한' },
      { id: 'user', name: 'user', description: '일반 사용자 권한' },
    ];
  };

  const [availableRoles] = useState<RoleInfo[]>(loadAvailableRoles());

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    hireDate: '',
    resignDate: '',
    adminMemo: '',
    role: 'user',
    projectAssignments: [] as ProjectAssignment[],
    accountStatus: 'active' as 'active' | 'inactive' | 'suspended',
  });

  useEffect(() => {
    if (!isNewRecord && id) {
      fetchUserData(id);
    }
  }, [id, isNewRecord]);

  const fetchUserData = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch user data');
      const user = await response.json();
      if (user.email && user.email.includes('@')) {
        setUsernameId(user.email.split('@')[0]);
      }
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        department: user.department || '',
        position: user.position || '',
        hireDate: user.hireDate || '',
        resignDate: user.resignDate || '',
        adminMemo: user.adminMemo || '',
        role: user.role.toLowerCase(),
        projectAssignments: [],
        accountStatus: user.active ? 'active' : 'inactive'
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error(t('fetchUserFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !usernameId.trim()) {
      toast.error(t('nameAndIdRequired'));
      return;
    }
    const composedEmail = usernameId.trim() + (companyEmailDomain ? '@' + companyEmailDomain : '');

    setIsLoading(true);
    try {
      // 신규 등록 시 아이디 중복 체크
      if (isNewRecord) {
        const checkRes = await fetch(import.meta.env.VITE_API_URL + '/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (checkRes.ok) {
          const allUsers: any[] = await checkRes.json();
          const normalizedId = usernameId.trim().toLowerCase();
          const isDuplicate = normalizedId !== '' && allUsers.some((u: any) => {
            const storedId = (u.loginId || u.username || '').toLowerCase();
            return storedId !== '' && storedId === normalizedId;
          });
          if (isDuplicate) {
            toast.error(t('loginIdDuplicate'));
            setIsLoading(false);
            return;
          }
        }
      }

      if (isNewRecord) {
        const newUserPayload: Record<string, unknown> = {
          loginId: usernameId.trim(),
          email: composedEmail, name: formData.name,
          phone: formData.phone, department: formData.department, position: formData.position, role: formData.role.toUpperCase(),
          emailNotificationEnabled: true
        };
        const response = await fetch(import.meta.env.VITE_API_URL + '/users', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newUserPayload)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || '사용자 생성에 실패했습니다.');
        }
        const createdUser = await response.json().catch(() => null);
        addLog({ userId: currentUser?.id, userName: currentUser?.name, action: 'create', resourceType: 'user', resourceId: createdUser?.id?.toString(), resourceName: formData.name, details: `새 사용자가 등록되었습니다: ${formData.name} (${composedEmail})` });
        toast.success(t('userCreateSuccess'));
      } else {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginId: usernameId.trim(),
            email: composedEmail, name: formData.name, phone: formData.phone,
            department: formData.department, position: formData.position, role: formData.role.toUpperCase(),
            active: formData.accountStatus === 'active'
          })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || '사용자 정보 수정에 실패했습니다.');
        }
        addLog({ userId: currentUser?.id, userName: currentUser?.name, action: 'update', resourceType: 'user', resourceId: id, resourceName: formData.name, details: `사용자 정보가 수정되었습니다: ${formData.name} (${composedEmail})` });
        toast.success(t('userUpdateSuccess'));
      }
      navigate('/users');
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error instanceof Error ? error.message : '사용자 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const inputStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text
  };


  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';
  const sectionLabel = { color: themeColors.textSecondary, fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const };
  const fieldLabel = { color: themeColors.textSecondary, fontSize: '12px' };
  const divider = { borderTop: `1px solid ${themeColors.border}` };

  const roleLabels: Record<string, string> = {
    admin: t('roleAdmin'), manager: t('roleManager'),
    user: t('roleUser'), readonly: t('roleReadonly'),
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/users')}
            className="w-7 h-7 flex items-center justify-center rounded hover:opacity-60 transition-opacity"
            style={{ color: themeColors.textSecondary }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('userManagement')}</p>
            <h1 className="text-base font-semibold leading-tight" style={{ color: themeColors.text }}>
              {isNewRecord ? t('newUser') : (formData.name || t('editUser'))}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/users')}
            className="px-3 py-1.5 text-sm rounded hover:opacity-70 transition-opacity"
            style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}>
            {t('cancel')}
          </button>
          <button type="submit" form="user-form"
            disabled={isLoading || !formData.name.trim() || !usernameId.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeColors.primary, color: onPrimaryText, borderRadius: '4px' }}>
            <Save size={13} />
            {isLoading ? t('processing') : (isNewRecord ? t('register') : t('save'))}
          </button>
        </div>
      </div>

      {/* Body — centered, max-width */}
      <div className="flex-1 min-h-0 overflow-hidden flex justify-center">
        <div className="w-full max-w-3xl flex gap-6 min-h-0 overflow-hidden">

          {/* Left: Form */}
          <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">

            {/* 기본 정보 */}
            <p className="mb-2.5" style={sectionLabel}>{t('basicInfo')}</p>
            <div className="space-y-2.5 mb-5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block mb-1" style={fieldLabel}>
                    {t('name')} <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('namePlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
                    style={inputStyle} />
                </div>
                <div>
                  <label className="block mb-1" style={fieldLabel}>
                    {t('userId')} <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input type="text" required value={usernameId}
                    onChange={(e) => setUsernameId(e.target.value.replace(/\s/g, ''))}
                    placeholder="username"
                    className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
                    style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block mb-1" style={fieldLabel}>{t('contactInfo')}</label>
                  <input type="tel" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                    placeholder="010-0000-0000" maxLength={13}
                    className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
                    style={inputStyle} />
                </div>
                <div>
                  <label className="block mb-1" style={fieldLabel}>{t('department')}</label>
                  <input type="text" value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder={t('departmentPlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
                    style={inputStyle} />
                </div>
                <div>
                  <label className="block mb-1" style={fieldLabel}>{t('position')}</label>
                  <input type="text" value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder={t('positionPlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all"
                    style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={divider} className="mb-5" />

            {/* 관리자 메모 */}
            <p className="mb-2.5" style={sectionLabel}>{t('adminMemo')}</p>
            <textarea value={formData.adminMemo}
              onChange={(e) => setFormData({ ...formData, adminMemo: e.target.value })}
              placeholder={t('adminMemoPlaceholder')}
              rows={4}
              className="w-full px-2.5 py-1.5 rounded text-sm focus:outline-none focus:ring-1 transition-all resize-none"
              style={inputStyle} />

          </form>

          {/* Right: Properties */}
          <div className="w-40 flex-shrink-0 overflow-y-auto">

            {/* 권한 */}
            <p className="mb-2.5" style={sectionLabel}>{t('role')}</p>
            <div className="space-y-1 mb-5">
              {availableRoles.map((role) => {
                const isSelected = formData.role === role.id;
                return (
                  <label key={role.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-sm"
                    style={{
                      backgroundColor: isSelected
                        ? (isDark ? `${themeColors.primary}20` : `${themeColors.primary}12`)
                        : 'transparent',
                      color: isSelected ? themeColors.primary : themeColors.text,
                    }}>
                    <input type="radio" name="role" value={role.id} checked={isSelected}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="hidden" />
                    <span className="w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: isSelected ? themeColors.primary : themeColors.border }}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColors.primary }} />}
                    </span>
                    <span className="truncate text-xs font-medium">{roleLabels[role.id] || role.name}</span>
                  </label>
                );
              })}
            </div>

            <div style={divider} className="mb-5" />

            {/* 계정 상태 */}
            <p className="mb-2.5" style={sectionLabel}>{t('accountStatus')}</p>
            <div className="space-y-1">
              {([
                { value: 'active', label: t('activeLabel') },
                { value: 'inactive', label: t('inactiveLabel') },
              ] as const).map((status) => {
                const isSelected = formData.accountStatus === status.value;
                return (
                  <label key={status.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-sm"
                    style={{
                      backgroundColor: isSelected
                        ? (isDark ? `${themeColors.primary}20` : `${themeColors.primary}12`)
                        : 'transparent',
                      color: isSelected ? themeColors.primary : themeColors.text,
                    }}>
                    <input type="radio" name="accountStatus" value={status.value} checked={isSelected}
                      onChange={(e) => setFormData({ ...formData, accountStatus: e.target.value as 'active' | 'inactive' })}
                      className="hidden" />
                    <span className="w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: isSelected ? themeColors.primary : themeColors.border }}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColors.primary }} />}
                    </span>
                    <span className="text-xs font-medium">{status.label}</span>
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

export default UserForm;
