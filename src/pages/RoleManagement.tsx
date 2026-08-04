import React, { useState, useEffect } from 'react';
import {
  Save, RotateCcw, Plus, Trash2,
  ShieldCheck,
  LayoutDashboard, Building2, Wrench, FolderKanban,
  MessageSquare, Users, ClipboardList, Settings2,
  Download, Upload, Info, FileBarChart, Lock,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useLanguage } from '../contexts/LanguageContext';
import { themeConfigs } from '../utils/themeConfig';
import {
  DEFAULT_ROLE_PERMISSIONS,
  MENU_DEFINITIONS, FILE_PERMISSION_DEFS,
  type Permission, type ActionType, type MenuDef,
} from '../utils/permissions';
import { usePermissionStore, type RoleInfo as StoreRoleInfo } from '../store/permissionStore';
import ProtectedComponent from '../components/ProtectedComponent';
import { useToast } from '../hooks/useToast';
import { useAuthStore } from '../store/authStore';

// ── 아이콘 매핑 ──────────────────────────────────────────────────
const MENU_ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Building2, Wrench, FolderKanban,
  FileBarChart, MessageSquare, Users, ShieldCheck,
  ClipboardList, Settings2,
};

const ACTION_META: Record<ActionType, { label: string; color: string }> = {
  view:   { label: '접근(조회)', color: '#3B82F6' },
  create: { label: '추가',       color: '#10B981' },
  update: { label: '수정',       color: '#F59E0B' },
  delete: { label: '삭제',       color: '#EF4444' },
  export: { label: '내보내기',   color: '#8B5CF6' },
};
const ALL_ACTIONS: ActionType[] = ['view', 'create', 'update', 'delete', 'export'];

// ── 역할 정보 타입 ────────────────────────────────────────────────
interface RoleInfo extends StoreRoleInfo {
  description?: string;
  createdBy?: string;
  updatedBy?: string;
}

// ── 토글 스위치 ───────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: () => void; color?: string }> = ({
  checked, onChange, color = '#3B82F6',
}) => (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); onChange(); }}
    style={{
      width: '32px', height: '18px', borderRadius: '99px', flexShrink: 0,
      backgroundColor: checked ? color : 'rgba(148,163,184,0.3)',
      border: 'none', cursor: 'pointer', padding: '2px',
      display: 'flex', alignItems: 'center',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      transition: 'all 0.18s ease',
      boxShadow: checked ? `0 0 0 2px ${color}28` : 'none',
    }}
  >
    <div style={{
      width: '14px', height: '14px', borderRadius: '50%',
      backgroundColor: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      transition: 'all 0.18s ease',
    }} />
  </button>
);

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
const RoleManagement: React.FC = () => {
  const theme = useSettingsStore((state) => state.settings.theme);
  const t = useLanguage();
  const themeColors = themeConfigs[theme];
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333' : '#fff';
  const subtleBg  = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.025)';
  const hoverBg   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(55,53,47,0.04)';
  const activeBg  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.06)';
  const divider   = themeColors.border;

  // ── 역할 helper ──────────────────────────────────────────────
  const getRoleDisplayName = (role: RoleInfo) => {
    if (role.id === 'admin') return '관리자';
    if (role.id === 'user')  return '일반 사용자';
    if (role.name === 'administrator') return '관리자';
    if (role.name === 'generalUser')   return '일반 사용자';
    return role.name;
  };
  const getRoleDescription = (role: RoleInfo) => {
    if (role.id === 'admin') return '시스템의 모든 기능에 접근할 수 있는 관리자 권한입니다.';
    if (role.id === 'user')  return '기본적인 조회 및 작성 권한을 가진 일반 사용자입니다.';
    return role.description || '커스텀 역할입니다.';
  };
  const formatDate = (d?: Date | string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
  };

  // ── store ─────────────────────────────────────────────────────
  const permStore = usePermissionStore();

  // ── state ─────────────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleInfo[]>(permStore.roles as RoleInfo[]);
  const [selectedRole, setSelectedRole] = useState<RoleInfo | null>((permStore.roles[0] as RoleInfo) ?? null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>(permStore.rolePermissions);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  useEffect(() => {
    // permStore.loaded 가 true 가 되는 시점 (DB 권한 로드 완료) 에만 1회 동기화
    // ※ permStore.rolePermissions를 의존성에서 제거:
    //   saveAll() 후 store 업데이트 → useEffect 재실행 → 컴포넌트 state 리셋
    //   → 토글한 값이 덮어씌워지는 경쟁 조건 방지
    if (permStore.loaded) {
      setRoles(permStore.roles as RoleInfo[]);
      setRolePermissions(permStore.rolePermissions);
      setSelectedRole(prev => {
        const match = permStore.roles.find(r => r.id === prev?.id);
        return (match as RoleInfo) ?? (permStore.roles[0] as RoleInfo) ?? null;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permStore.loaded]);

  // ── 권한 토글 ─────────────────────────────────────────────────
  const currentPerms: Permission[] = selectedRole ? (rolePermissions[selectedRole.id] || []) : [];

  const togglePermission = (permission: Permission, menu?: MenuDef) => {
    if (!selectedRole) return;
    const cp = rolePermissions[selectedRole.id] || [];
    const isOn = cp.includes(permission);
    let next: Permission[];

    if (menu && menu.permissionMap.view === permission && isOn) {
      const menuPerms = Object.values(menu.permissionMap).filter((p): p is Permission => !!p);
      next = cp.filter(p => !menuPerms.includes(p));
    } else {
      next = isOn ? cp.filter(p => p !== permission) : [...cp, permission];
    }
    if (!isOn && menu && menu.permissionMap.view && menu.permissionMap.view !== permission) {
      const viewPerm = menu.permissionMap.view;
      if (!next.includes(viewPerm)) next = [viewPerm, ...next];
    }
    setRolePermissions({ ...rolePermissions, [selectedRole.id]: next });
  };

  const isViewOn = (menu: MenuDef) => !!(menu.permissionMap.view && currentPerms.includes(menu.permissionMap.view));

  // ── 통계 ─────────────────────────────────────────────────────
  const totalUniquePerms = new Set(Object.values(DEFAULT_ROLE_PERMISSIONS.admin)).size;
  const activeCount = selectedRole ? new Set(currentPerms).size : 0;
  const progressPct = Math.round((activeCount / totalUniquePerms) * 100);

  // ── 저장/초기화/역할 관리 ─────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await permStore.saveAll(rolePermissions, roles as StoreRoleInfo[]);
      toast.success('권한 설정이 저장되었습니다');
    } catch {
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = { ...DEFAULT_ROLE_PERMISSIONS };
    setRolePermissions(defaults);
    setIsSaving(true);
    try {
      await permStore.saveAll(defaults, roles as StoreRoleInfo[]);
      toast.success('권한 설정이 초기화되었습니다');
    } catch {
      toast.error('초기화 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) { toast.error('역할명을 입력해주세요.'); return; }
    if (roles.find(r => r.name === newRoleName.trim())) { toast.error('이미 존재하는 역할명입니다.'); return; }
    const roleId = 'role_' + Date.now();
    const newRole: RoleInfo = { id: roleId, name: newRoleName.trim(), isSystem: false, description: newRoleDescription.trim(), createdBy: user?.name };
    const updRoles = [...roles, newRole];
    const updPerms = { ...rolePermissions, [roleId]: [] as Permission[] };
    setRoles(updRoles);
    setRolePermissions(updPerms);
    setIsAddingRole(false); setNewRoleName(''); setNewRoleDescription('');
    try {
      await permStore.saveAll(updPerms, updRoles as StoreRoleInfo[]);
      toast.success(`역할 "${newRole.name}"이(가) 추가되었습니다`);
    } catch { toast.error('역할 추가 저장에 실패했습니다.'); }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (roleId === 'admin' || roleId === 'user') { toast.error('기본 역할은 삭제할 수 없습니다.'); return; }
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    if (!confirm(`"${role.name}" 역할을 삭제하시겠습니까?`)) return;
    const updRoles = roles.filter(r => r.id !== roleId);
    const updPerms = { ...rolePermissions };
    delete updPerms[roleId];
    setRoles(updRoles);
    setRolePermissions(updPerms);
    if (selectedRole?.id === roleId) setSelectedRole(updRoles[0] ?? null);
    try {
      await permStore.saveAll(updPerms, updRoles as StoreRoleInfo[]);
      toast.success(`역할 "${role.name}"이(가) 삭제되었습니다`);
    } catch { toast.error('역할 삭제 저장에 실패했습니다.'); }
  };

  // ── 역할 배경색 ──────────────────────────────────────────────
  const roleAccentColor = (id: string) => {
    if (id === 'admin') return '#3B82F6';
    if (id === 'user')  return '#10B981';
    return themeColors.primary;
  };

  // ── 렌더링 ────────────────────────────────────────────────────
  return (
    <ProtectedComponent permission="view_roles">
      <div style={{ display: 'flex', gap: '0', height: 'calc(100vh - 112px)', minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: `1px solid ${divider}` }}>

        {/* ══════════════════ 왼쪽: 역할 패널 ══════════════════ */}
        <div style={{
          width: '248px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          backgroundColor: isDark ? themeColors.surface : '#FAFAFA',
          borderRight: `1px solid ${divider}`,
        }}>
          {/* 패널 헤더 */}
          <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${divider}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={15} style={{ color: themeColors.primary }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: themeColors.text }}>권한 역할</span>
            </div>
            <p style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, lineHeight: 1.5 }}>
              역할별 메뉴 접근 및 기능 권한을 관리합니다.
            </p>
          </div>

          {/* 역할 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {roles.map(role => {
              const isActive = selectedRole?.id === role.id;
              const count = (rolePermissions[role.id] || []).length;
              const accent = roleAccentColor(role.id);
              const isSystem = role.id === 'admin' || role.id === 'user';

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '9px 10px',
                    borderRadius: '6px', marginBottom: '2px', cursor: 'pointer',
                    backgroundColor: isActive ? activeBg : 'transparent',
                    borderLeft: `3px solid ${isActive ? accent : 'transparent'}`,
                    transition: 'all 0.12s',
                    gap: '10px',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = hoverBg; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* 역할 아이콘 */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                    backgroundColor: isActive ? `${accent}18` : subtleBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}>
                    <ShieldCheck size={13} style={{ color: isActive ? accent : themeColors.textSecondary }} />
                  </div>

                  {/* 역할명 + 카운트 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500, color: isActive ? themeColors.text : themeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getRoleDisplayName(role)}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, marginTop: '1px' }}>
                      {count}개 권한 활성
                    </div>
                  </div>

                  {/* 삭제 버튼 (커스텀 역할만) */}
                  {!isSystem && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteRole(role.id); }}
                      style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', color: '#EF4444', cursor: 'pointer', opacity: 0, transition: 'opacity 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                      className="role-delete-btn"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* 역할 추가 인라인 폼 */}
            {isAddingRole && (
              <div style={{
                marginTop: '6px', padding: '12px', borderRadius: '6px',
                border: `1px solid ${themeColors.primary}40`,
                backgroundColor: isDark ? `rgba(59,130,246,0.06)` : `rgba(59,130,246,0.04)`,
              }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.primary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>새 역할</p>
                <input
                  type="text" value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddRole(); if (e.key === 'Escape') { setIsAddingRole(false); setNewRoleName(''); setNewRoleDescription(''); } }}
                  placeholder="역할명을 입력하세요"
                  autoFocus
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: `1px solid ${divider}`, backgroundColor: themeColors.surface, color: themeColors.text, fontSize: '0.8125rem', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }}
                />
                <input
                  type="text" value={newRoleDescription}
                  onChange={e => setNewRoleDescription(e.target.value)}
                  placeholder="설명 (선택)"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '4px', border: `1px solid ${divider}`, backgroundColor: themeColors.surface, color: themeColors.text, fontSize: '0.8125rem', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleAddRole} style={{ flex: 1, padding: '5px 0', borderRadius: '4px', border: 'none', backgroundColor: themeColors.primary, color: onPrimaryText, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>추가</button>
                  <button onClick={() => { setIsAddingRole(false); setNewRoleName(''); setNewRoleDescription(''); }} style={{ flex: 1, padding: '5px 0', borderRadius: '4px', border: `1px solid ${divider}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: '0.8125rem', cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            )}
          </div>

          {/* 역할 추가 버튼 */}
          <div style={{ padding: '10px 8px', borderTop: `1px solid ${divider}` }}>
            <button
              onClick={() => setIsAddingRole(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '6px',
                border: isAddingRole ? `1px solid ${themeColors.primary}40` : `1px dashed ${divider}`,
                backgroundColor: isAddingRole ? `${themeColors.primary}08` : 'transparent',
                color: isAddingRole ? themeColors.primary : themeColors.textSecondary,
                fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!isAddingRole) e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={e => { if (!isAddingRole) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Plus size={13} />
              <span>역할 추가</span>
            </button>
          </div>
        </div>

        {/* ══════════════════ 오른쪽: 권한 매트릭스 ══════════════════ */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: themeColors.background, overflowY: 'auto' }}>

          {selectedRole ? (
            <>
              {/* ── 역할 헤더 카드 ── */}
              <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${divider}`, backgroundColor: themeColors.surface, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  {/* 좌측: 역할 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${roleAccentColor(selectedRole.id)}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ShieldCheck size={16} style={{ color: roleAccentColor(selectedRole.id) }} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: themeColors.text, margin: 0 }}>
                          {getRoleDisplayName(selectedRole)}
                        </h2>
                        <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, margin: 0 }}>
                          {getRoleDescription(selectedRole)}
                        </p>
                      </div>
                    </div>

                    {/* 권한 진행 바 */}
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: '99px', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(55,53,47,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: '99px', backgroundColor: roleAccentColor(selectedRole.id), transition: 'width 0.3s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>
                        {activeCount} / {totalUniquePerms}
                      </span>
                    </div>
                  </div>

                  {/* 우측: 액션 버튼 */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={handleReset}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '6px', border: `1px solid ${divider}`, backgroundColor: 'transparent', color: themeColors.textSecondary, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <RotateCcw size={13} />
                      <span>초기화</span>
                    </button>
                    <button
                      onClick={handleSave} disabled={isSaving}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '6px', border: 'none', backgroundColor: themeColors.primary, color: onPrimaryText, fontSize: '0.8125rem', fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, transition: 'opacity 0.12s' }}
                    >
                      <Save size={13} />
                      <span>{isSaving ? '저장 중...' : '저장'}</span>
                    </button>
                  </div>
                </div>

                {/* 메타 정보 (소형) */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${divider}` }}>
                  {[
                    { label: '생성일', value: formatDate(selectedRole.createdAt) },
                    { label: '수정일', value: formatDate(selectedRole.updatedAt) },
                    { label: '활성 권한', value: `${activeCount}개` },
                  ].map(item => (
                    <div key={item.label}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>{item.label}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: themeColors.text }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 메뉴 권한 매트릭스 ── */}
              <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
                {/* 섹션 타이틀 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Lock size={13} style={{ color: themeColors.textSecondary }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.04em' }}>메뉴 접근 권한</span>
                  <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary }}>— 각 메뉴별 기능 접근 범위를 설정합니다</span>
                </div>

                {/* 매트릭스 카드 */}
                <div style={{ borderRadius: '8px', border: `1px solid ${divider}`, overflow: 'hidden', backgroundColor: themeColors.surface }}>
                  {/* 컬럼 헤더 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '200px repeat(5, 1fr)',
                    borderBottom: `1px solid ${divider}`,
                    backgroundColor: subtleBg,
                  }}>
                    <div style={{ padding: '10px 16px', fontSize: '0.6875rem', fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      메뉴
                    </div>
                    {ALL_ACTIONS.map(action => {
                      const m = ACTION_META[action];
                      return (
                        <div key={action} style={{ padding: '10px 0', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: themeColors.textSecondary }}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 메뉴 행 — 사이드바와 동일한 섹션 그룹 */}
                  {[
                    { sectionLabel: t('sectionWork')   || '관리',   keys: ['dashboard','companies','maintenance','projects','weekly_report','collaboration'] },
                    { sectionLabel: t('sectionAdmin')  || '관리자', keys: ['users','roles','audit_logs'] },
                    { sectionLabel: t('sectionSystem') || '시스템', keys: ['settings'] },
                  ].map((group, gIdx, groups) => {
                    const groupMenus = group.keys
                      .map(k => MENU_DEFINITIONS.find(m => m.key === k))
                      .filter(Boolean) as typeof MENU_DEFINITIONS;
                    const isLastGroup = gIdx === groups.length - 1;

                    return (
                      <React.Fragment key={group.sectionLabel}>
                        {/* 섹션 헤더 행 */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '200px repeat(5, 1fr)',
                          borderBottom: `1px solid ${divider}`,
                          borderTop: gIdx > 0 ? `1px solid ${divider}` : 'none',
                          backgroundColor: subtleBg,
                        }}>
                          <div style={{ gridColumn: '1 / -1', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: themeColors.textSecondary }}>
                              {group.sectionLabel}
                            </span>
                            <div style={{ flex: 1, height: '1px', backgroundColor: divider, opacity: 0.5 }} />
                          </div>
                        </div>

                        {/* 그룹 내 메뉴 행들 */}
                        {groupMenus.map((menu, mIdx) => {
                          const viewOn = isViewOn(menu);
                          const isLast = isLastGroup && mIdx === groupMenus.length - 1;
                          const Icon = MENU_ICON_MAP[menu.icon] ?? ShieldCheck;
                          return (
                            <div
                              key={menu.key}
                              style={{
                                display: 'grid', gridTemplateColumns: '200px repeat(5, 1fr)',
                                borderBottom: isLast ? 'none' : `1px solid ${divider}`,
                                backgroundColor: 'transparent',
                                opacity: viewOn ? 1 : 0.55,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              {/* 메뉴명 */}
                              <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: viewOn ? `${roleAccentColor(selectedRole.id)}12` : subtleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                  <Icon size={13} style={{ color: viewOn ? roleAccentColor(selectedRole.id) : themeColors.textSecondary }} />
                                </div>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: themeColors.text }}>
                                  {t(menu.labelKey) || menu.label}
                                </span>
                              </div>

                              {/* 액션 토글 */}
                              {ALL_ACTIONS.map(action => {
                                const perm = menu.permissionMap[action];
                                const isView = action === 'view';
                                const isChecked = !!(perm && currentPerms.includes(perm));
                                return (
                                  <div key={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0' }}>
                                    {perm ? (
                                      <Toggle
                                        checked={isChecked}
                                        onChange={() => togglePermission(perm, isView ? menu : undefined)}
                                        color={ACTION_META[action].color}
                                      />
                                    ) : (
                                      <div style={{ width: '4px', height: '1.5px', borderRadius: '1px', backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(55,53,47,0.2)' }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 매트릭스 안내 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '8px', marginBottom: '20px' }}>
                  <Info size={12} style={{ color: themeColors.textSecondary, opacity: 0.5, flexShrink: 0, marginTop: '1px' }} />
                  <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, opacity: 0.7, lineHeight: 1.6 }}>
                    <strong>접근</strong> 권한을 해제하면 해당 메뉴의 모든 기능 권한이 함께 해제됩니다.
                    반대로 추가·수정·삭제 권한을 활성화하면 <strong>접근</strong> 권한이 자동으로 함께 활성화됩니다.
                  </span>
                </div>
              </div>

              {/* ── 파일 권한 섹션 ── */}
              <div style={{ padding: '0 24px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Download size={13} style={{ color: themeColors.textSecondary }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.04em' }}>파일 권한</span>
                  <span style={{ fontSize: '0.6875rem', color: themeColors.textSecondary }}>— 첨부파일 접근 범위를 설정합니다</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {FILE_PERMISSION_DEFS.map(fp => {
                    const isOn = currentPerms.includes(fp.permission);
                    const FileIcon = fp.permission === 'download_files' ? Download : fp.permission === 'upload_files' ? Upload : Trash2;
                    const color = fp.permission === 'delete_files' ? '#EF4444' : themeColors.primary;
                    return (
                      <div
                        key={fp.permission}
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePermission(fp.permission)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') togglePermission(fp.permission); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                          border: `1.5px solid ${isOn ? `${color}50` : divider}`,
                          backgroundColor: isOn ? `${color}08` : themeColors.surface,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!isOn) (e.currentTarget as HTMLDivElement).style.backgroundColor = hoverBg; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isOn ? `${color}08` : themeColors.surface; }}
                      >
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: isOn ? `${color}15` : subtleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          <FileIcon size={16} style={{ color: isOn ? color : themeColors.textSecondary }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isOn ? color : themeColors.text, marginBottom: '2px' }}>{fp.label}</div>
                          <div style={{ fontSize: '0.6875rem', color: themeColors.textSecondary, lineHeight: 1.4 }}>{fp.description}</div>
                        </div>
                        <Toggle checked={isOn} onChange={() => {}} color={color} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* ── 빈 상태 ── */
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: subtleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <ShieldCheck size={24} style={{ color: themeColors.textSecondary, opacity: 0.4 }} />
                </div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: themeColors.text, marginBottom: '6px' }}>역할을 선택하세요</p>
                <p style={{ fontSize: '0.8125rem', color: themeColors.textSecondary }}>왼쪽 패널에서 권한을 설정할 역할을 선택하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedComponent>
  );
};

export default RoleManagement;
