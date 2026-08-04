import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Trash2, AlertCircle, Search, Save, Building2, Phone, FileText, Server, Shield, Eye, EyeOff, ChevronRight, History, CheckCircle, Plus, PenLine, Maximize2, Minimize2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useAuditLogStore } from '../store/auditLogStore';
import { usePermission } from '../hooks/usePermission';
import { isAdminAccount } from '../utils/permissions';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../hooks/useToast';
import DaumPostcode from 'react-daum-postcode';
import ConfirmPopover from '../components/common/ConfirmPopover';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (company: any) => void;
  onDeleted?: () => void;
  companyId?: string | null;
  initialCompany?: any;
}

const TABS = ['기본 정보', '계약 정보', '서버 정보', 'VPN 정보'] as const;
type Tab = typeof TABS[number];

// 서버 항목 타입
interface ServerEntry { id: string; name: string; ip: string; os: string; serverType: string; loginId: string; loginPw: string; notes: string; }
// VPN 항목 타입
interface VpnEntry { id: string; vpnType: string; server: string; port: string; account: string; password: string; notes: string; }
// 담당자 항목 타입
interface ContactEntry { id: string; name: string; role: string; phone: string; mobile: string; email: string; notes: string; }

const newServer = (): ServerEntry => ({ id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), name: '', ip: '', os: '', serverType: '웹서버', loginId: '', loginPw: '', notes: '' });
const newVpn = (): VpnEntry => ({ id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), vpnType: 'Cisco AnyConnect', server: '', port: '', account: '', password: '', notes: '' });
const newContact = (): ContactEntry => ({ id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), name: '', role: '', phone: '', mobile: '', email: '', notes: '' });

const SERVER_TYPES = ['웹서버', 'WAS', 'DB서버', '파일서버', '메일서버', '백업서버', '기타'];
const VPN_TYPES = ['Cisco AnyConnect', 'FortiClient', 'OpenVPN', 'WireGuard', 'L2TP/IPSec', '기타'];

const CompanyCreateModal: React.FC<Props> = ({ isOpen, onClose, onCreated, onDeleted, companyId, initialCompany }) => {
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  // Server type display labels (values stay as Korean for DB compatibility)
  const SERVER_TYPE_LABELS: Record<string, string> = {
    '웹서버': t('serverTypeWeb'), 'WAS': t('serverTypeWas'), 'DB서버': t('serverTypeDb'),
    '파일서버': t('serverTypeFile'), '메일서버': t('serverTypeMail'), '백업서버': t('serverTypeBackup'),
    '기타': t('other'),
  };
  const themeColors = themeConfigs[theme];
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const { addLog } = useAuditLogStore();
  const { can } = usePermission();
  const toast = useToast();
  const isDark = theme !== 'light';
  const onPrimaryText = theme === 'yellow' ? '#333333' : '#fff';
  const isEditMode = !!companyId;

  const emptyForm = {
    name: '', businessNumber: '', representative: '',
    address: '', notes: '', contractNotes: '',
    contractStatus: 'project' as 'maintenance' | 'project' | 'ended',
    maintenanceStartDate: '', maintenanceEndDate: '',
    maintenanceCycle: 'monthly' as 'monthly' | 'quarterly' | 'biannual' | 'annual',
    maintenanceType: 'onsite' as 'onsite' | 'remote' | 'hybrid',
    remoteAccessMethod: '',
    assignedManagerId: '',
    assignedManagerName: '',
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [showPostcode, setShowPostcode] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<Tab>('기본 정보');
  const bodyRef = useRef<HTMLDivElement>(null);

  // 다중 항목 state
  const [servers, setServers] = useState<ServerEntry[]>([newServer()]);
  const [vpnAccounts, setVpnAccounts] = useState<VpnEntry[]>([newVpn()]);
  const [contacts, setContacts] = useState<ContactEntry[]>([newContact()]);
  const [showSrvPw, setShowSrvPw] = useState<Record<string, boolean>>({});
  const [showVpnPw, setShowVpnPw] = useState<Record<string, boolean>>({});
  const [systemUsers, setSystemUsers] = useState<{ id: string; name: string; department?: string; position?: string }[]>([]);

  // Edit mode state
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const loadedCompanyRef = useRef<any>(null);

  // 시스템 사용자 목록 로드
  useEffect(() => {
    if (!isOpen) return;
    fetch(import.meta.env.VITE_API_URL + '/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setSystemUsers(data.filter(u => u.accountStatus !== 'inactive')))
      .catch(() => {});
  }, [isOpen, token]);

  // Draggable modal
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const notesRef = useRef<HTMLDivElement>(null);

  const stripHtml = (v: string) => v?.replace(/<[^>]*>/g, '').trim() || '';

  // Load data in edit mode
  useEffect(() => {
    if (!isOpen || !isEditMode) return;
    setIsDataReady(false);
    setShowHistory(false);
    setHistoryLogs([]);
    setSaveState('idle');
    setModalPos(null);
    setActiveTab('기본 정보');

    const applySubResources = (data: any, contactsData: any[], serversData: any[], vpnData: any[]) => {
      if (Array.isArray(contactsData) && contactsData.length > 0) {
        setContacts(contactsData.map((c: any) => ({ ...newContact(), ...c })));
      } else if (data.contact) {
        setContacts([{ ...newContact(), name: data.contact }]);
      } else {
        setContacts([newContact()]);
      }

      if (Array.isArray(serversData) && serversData.length > 0) {
        setServers(serversData.map((s: any) => ({ ...newServer(), ...s })));
      } else if (data.serverName || data.serverIp) {
        setServers([{ ...newServer(), name: data.serverName || '', ip: data.serverIp || '', os: data.operatingSystem || '', notes: [data.hostingProvider, data.dbInfo, data.domain, data.serverSpec].filter(Boolean).join(' / ') }]);
      } else {
        setServers([newServer()]);
      }

      if (Array.isArray(vpnData) && vpnData.length > 0) {
        setVpnAccounts(vpnData.map((v: any) => ({ ...newVpn(), ...v })));
      } else if (data.vpnServer || data.vpnAccount) {
        setVpnAccounts([{ ...newVpn(), vpnType: data.vpnType || 'Cisco AnyConnect', server: data.vpnServer || '', port: data.vpnPort || '', account: data.vpnAccount || '', password: data.vpnPassword || '', notes: data.vpnNotes || '' }]);
      } else {
        setVpnAccounts([newVpn()]);
      }
    };

    const load = async (data: any) => {
      const cs = data.contractStatus || (data.maintenanceContract ? 'maintenance' : 'project');
      const notes = stripHtml(data.notes || '');
      const contractNotes = stripHtml(data.contractNotes || '');
      setFormData({
        name: data.name || '',
        businessNumber: formatBusinessNumber(data.businessNumber || ''),
        representative: data.representative || '',
        address: data.address || '',
        notes,
        contractNotes,
        contractStatus: cs as 'maintenance' | 'project' | 'ended',
        maintenanceStartDate: data.maintenanceStartDate || '',
        maintenanceEndDate: data.maintenanceEndDate || '',
        maintenanceCycle: data.maintenanceCycle || 'monthly',
        maintenanceType: data.maintenanceType || 'onsite',
        remoteAccessMethod: data.remoteAccessMethod || '',
        assignedManagerId: data.assignedManagerId || '',
        assignedManagerName: data.assignedManagerName || '',
      });
      loadedCompanyRef.current = data;
      setShowNotes(!!notes);

      // Companies.tsx에서 이미 sub-resource를 함께 전달한 경우 재요청 생략
      if (data.contacts !== undefined || data.servers !== undefined || data.vpnAccounts !== undefined) {
        applySubResources(data, data.contacts ?? [], data.servers ?? [], data.vpnAccounts ?? []);
      } else {
        const id = data.id ?? companyId;
        const headers = { 'Authorization': `Bearer ${token}` };
        const base = import.meta.env.VITE_API_URL;
        const [contactsRes, serversRes, vpnRes] = await Promise.allSettled([
          fetch(`${base}/companies/${id}/contacts`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${base}/companies/${id}/servers`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${base}/companies/${id}/vpn-accounts`, { headers }).then(r => r.ok ? r.json() : []),
        ]);
        applySubResources(
          data,
          contactsRes.status === 'fulfilled' ? contactsRes.value : [],
          serversRes.status === 'fulfilled' ? serversRes.value : [],
          vpnRes.status === 'fulfilled' ? vpnRes.value : [],
        );
      }

      setIsDataReady(true);
    };

    if (initialCompany) {
      load(initialCompany).finally(() => setIsLoading(false));
    } else {
      setIsLoading(true);
      fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(data => load(data))
        .catch(() => { toast.error(t('companyLoadFailed')); onClose(); })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, companyId]);

  // Reset for create mode
  useEffect(() => {
    if (!isOpen || isEditMode) return;
    setFormData(emptyForm);
    setServers([newServer()]);
    setVpnAccounts([newVpn()]);
    setContacts([newContact()]);
    setShowSrvPw({});
    setShowVpnPw({});
    setShowNotes(false);
    setFocused(null);
    setModalPos(null);
    setActiveTab('기본 정보');
    setIsDataReady(true);
  }, [isOpen]);

  // Pin modal position after data loads
  useLayoutEffect(() => {
    if (isDataReady && isEditMode && modalPos === null && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      if (rect.width > 0) setModalPos({ x: rect.left, y: rect.top });
    }
  }, [isDataReady]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => setModalPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  const toggleNotes = () => {
    const opening = !showNotes;
    setShowNotes(opening);
    if (opening) {
      setTimeout(() => {
        notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  };

  // Styles
  const ulWrap = (field: string): React.CSSProperties => ({
    borderBottom: `1.5px solid ${focused === field ? themeColors.primary : themeColors.border}`,
    transition: 'border-color 0.2s ease',
  });
  const ghostInput: React.CSSProperties = {
    border: 'none', backgroundColor: 'transparent', color: themeColors.text,
    outline: 'none', width: '100%', padding: '0.3125rem 0 0.25rem', fontSize: '0.875rem',
  };
  const sectionCard: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)',
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px', padding: '16px',
  };
  const fl: React.CSSProperties = { color: themeColors.textSecondary, fontSize: '0.75rem', marginBottom: '6px', fontWeight: 600 };

  const sectionHead = (_icon: React.ReactNode, label: string) => (
    <span style={{ color: themeColors.textSecondary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </span>
  );

  const formatPhone = (v: string) => {
    const n = v.replace(/[^0-9]/g, '');
    if (n.length <= 3) return n;
    if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
    return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7, 11)}`;
  };

  const handlePostcodeComplete = (data: any) => {
    let full = data.address;
    let extra = '';
    if (data.addressType === 'R') {
      if (data.bname) extra += data.bname;
      if (data.buildingName) extra += extra ? `, ${data.buildingName}` : data.buildingName;
      if (extra) full += ` (${extra})`;
    }
    setFormData(prev => ({ ...prev, address: full }));
    setShowPostcode(false);
  };

  const fd = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const formatBusinessNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length > 5) return digits.slice(0, 3) + '-' + digits.slice(3, 5) + '-' + digits.slice(5);
    if (digits.length > 3) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits;
  };

  const handleBusinessNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, businessNumber: formatBusinessNumber(e.target.value) }));
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setShowNotes(false);
    setFocused(null);
    setModalPos(null);
    setShowHistory(false);
    setConfirmConfig(null);
    onClose();
  };

  const FIELD_LABELS: Record<string, string> = {
    name: '업체명', businessNumber: '사업자번호', representative: '대표자',
    contact: '담당자', email: '이메일', phone: '유선번호', mobile: '휴대폰',
    address: '주소', notes: '메모', contractStatus: '계약상태',
    maintenanceStartDate: '계약 시작일', maintenanceEndDate: '계약 종료일',
    maintenanceCycle: '점검주기', maintenanceType: '유지보수방식', remoteAccessMethod: '원격접속방법',
    assignedManagerId: '담당자', assignedManagerName: '담당자명',
    serverName: '서버명', serverIp: 'IP 주소', operatingSystem: 'OS',
    contacts: '담당자', servers: '서버', vpnAccounts: 'VPN',
  };
  const CONTRACT_LABELS: Record<string, string> = { maintenance: '유지보수', project: '프로젝트', ended: '계약종료' };

  const syncSubResources = async (id: string | number) => {
    const base = import.meta.env.VITE_API_URL;
    const authHeader = { 'Authorization': `Bearer ${token}` };
    const jsonHeaders = { ...authHeader, 'Content-Type': 'application/json' };
    const validContacts = contacts.filter(c => c.name.trim());
    const validServers = servers.filter(s => s.name.trim() || s.ip.trim());
    const validVpn = vpnAccounts.filter(v => v.server.trim() || v.account.trim());

    const replaceAll = async (path: string, items: any[]) => {
      // 1. GET existing items
      const getRes = await fetch(`${base}${path}`, { headers: authHeader });
      const existing: any[] = getRes.ok ? await getRes.json() : [];

      // 2. DELETE each existing item
      for (const item of existing) {
        const delRes = await fetch(`${base}${path}/${item.id}`, { method: 'DELETE', headers: jsonHeaders });
        if (!delRes.ok && delRes.status !== 404) {
        }
      }

      // 3. POST each current item
      for (const item of items) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _localId, companyId: _cid, ...rest } = item as any;
        const postRes = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(rest),
        });
        if (!postRes.ok) {
          const errText = await postRes.text().catch(() => postRes.status.toString());
          throw new Error(`서브 리소스 저장 실패 (${path}): ${errText}`);
        }
      }
    };

    await replaceAll(`/companies/${id}/contacts`, validContacts);
    await replaceAll(`/companies/${id}/servers`, validServers);
    await replaceAll(`/companies/${id}/vpn-accounts`, validVpn);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error(t('companyNameRequired')); setActiveTab('기본 정보'); return; }
    if (!token) { toast.error(t('loginRequired')); return; }
    try {
      if (isEditMode) setSaveState('saving');
      setIsLoading(true);
      const firstContact = contacts.find(c => c.name.trim());
      const body = {
        name: formData.name.trim(),
        businessNumber: formData.businessNumber.trim() || null,
        representative: formData.representative.trim() || null,
        contact: firstContact?.name.trim() || null,
        contactRole: firstContact?.role?.trim() || null,
        email: firstContact?.email?.trim() || null,
        phone: firstContact?.phone?.trim() || null,
        mobile: firstContact?.mobile?.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes || null,
        contractNotes: formData.contractNotes || null,
        contractStatus: formData.contractStatus,
        maintenanceContract: formData.contractStatus === 'maintenance',
        maintenanceStartDate: formData.maintenanceStartDate || null,
        maintenanceEndDate: formData.maintenanceEndDate || null,
        maintenanceCycle: formData.maintenanceCycle,
        maintenanceType: formData.maintenanceType,
        remoteAccessMethod: formData.remoteAccessMethod.trim() || null,
        assignedManagerId: formData.assignedManagerId || null,
        assignedManagerName: formData.assignedManagerName.trim() || null,
        serverName: servers[0]?.name.trim() || null,
        serverIp: servers[0]?.ip.trim() || null,
        operatingSystem: servers[0]?.os.trim() || null,
      };
      const response = await fetch(
        isEditMode
          ? `${import.meta.env.VITE_API_URL}/companies/${companyId}`
          : `${import.meta.env.VITE_API_URL}/companies`,
        {
          method: isEditMode ? 'PUT' : 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: t('unknown') }));
        throw new Error(err.message || `Server error: ${response.status}`);
      }
      const result = await response.json().catch(() => null);
      const savedId = isEditMode ? companyId : result?.id;

      // sub-resource 동기화
      if (savedId) await syncSubResources(savedId);

      if (isEditMode) {
        const original = loadedCompanyRef.current;
        const changes = original
          ? Object.keys(body)
              .filter(key => String((original as any)[key] || '') !== String((body as any)[key] || ''))
              .map(key => `${FIELD_LABELS[key] || key}: ${(original as any)[key] || '-'} → ${(body as any)[key] || '-'}`)
              .join(' / ')
          : '';
        await fetch(import.meta.env.VITE_API_URL + '/audit-logs', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id, userName: user?.name, action: 'update',
            resourceType: 'company', resourceId: companyId,
            resourceName: formData.name, details: changes || `업체 정보 수정: ${formData.name}`,
          }),
        }).catch(() => {});
        loadedCompanyRef.current = { ...loadedCompanyRef.current, ...body };
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
        toast.success(t('saveSuccess'));
        onCreated?.(result);
        if (showHistory) fetchHistory();
      } else {
        addLog({ userId: user?.id, userName: user?.name, action: 'create', resourceType: 'company', resourceId: result?.id?.toString(), resourceName: formData.name, details: `새 업체가 등록되었습니다: ${formData.name}` });
        toast.success(t('companyRegistered'));
        handleClose();
        onCreated?.(result);
      }
    } catch (error) {
      if (isEditMode) setSaveState('idle');
      toast.error(error instanceof Error ? error.message : t('saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!companyId || !token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      addLog({ userId: user?.id, userName: user?.name, action: 'delete', resourceType: 'company', resourceId: companyId, resourceName: formData.name, details: `업체 삭제: ${formData.name}` });
      toast.success(t('companyDeleteSuccess'));
      onDeleted?.();
      handleClose();
    } catch { toast.error(t('deleteFailed')); }
  };

  const fetchHistory = async () => {
    if (!companyId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/audit-logs`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const filtered = data
          .filter((l: any) => String(l.resourceId) === String(companyId) && l.resourceType === 'company')
          .map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp);
        setHistoryLogs(filtered);
      }
    } catch (error) {
    } finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) fetchHistory();
  };

  if (!isOpen) return null;

  const contractStatusLabel = CONTRACT_LABELS[formData.contractStatus] || formData.contractStatus;

  const tabIcon: Record<Tab, React.ReactNode> = {
    '기본 정보': <Building2 size={12} />,
    '계약 정보': <FileText size={12} />,
    '서버 정보': <Server size={12} />,
    'VPN 정보': <Shield size={12} />,
  };
  const tabLabels: Record<Tab, string> = {
    '기본 정보': t('tabBasicInfo'),
    '계약 정보': t('tabContractInfo'),
    '서버 정보': t('tabServerInfo'),
    'VPN 정보': t('tabVpnInfo'),
  };

  // Relative time helper
  const relativeTime = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('justNow');
    if (m < 60) return t('minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('hoursAgo', { count: h });
    const day = Math.floor(h / 24);
    if (day < 7) return t('daysAgo', { count: day });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <style>{`
        @keyframes modalIn { from { opacity:0; } to { opacity:1; } }
        @keyframes sidePanelIn { from { transform: translateX(100%); opacity: 0.8; } to { transform: translateX(0); opacity: 1; } }
        @keyframes notesIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes historySlideIn { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
        .modal-anim { animation: modalIn 0.16s ease; }
        .side-panel-anim { animation: sidePanelIn 0.22s cubic-bezier(0.22,1,0.36,1); }
        .notes-anim { animation: notesIn 0.15s ease; }
        .history-slide { animation: historySlideIn 0.2s cubic-bezier(0.22,1,0.36,1); }
        .ghost-input::placeholder { color: ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(55,53,47,0.28)'}; }
        .ghost-input::-webkit-calendar-picker-indicator { opacity: 0.4; cursor: pointer; }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 49, backgroundColor: 'rgba(0,0,0,0.28)' }}
        onClick={handleClose}
      />

      {/* 편집 모드: 데이터 로딩 중 카드 스피너 */}
      {isEditMode && !isDataReady && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 50, pointerEvents: 'none' }}>
          <LoadingSpinner  />
        </div>
      )}

      {/* 데이터 준비 완료 후 사이드 패널 (편집/생성 모두) */}
      {(isEditMode && !isDataReady) ? null : (
      <div
        ref={modalRef}
        className="side-panel-anim"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 50,
          width: isWide ? 'min(52.5rem, calc(100vw - 2rem))' : 'min(560px, calc(100vw - 2rem))',
          height: '100vh',
          backgroundColor: themeColors.surface,
          borderLeft: `1px solid ${themeColors.border}`,
          borderRadius: '12px 0 0 12px',
          boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.5)' : '-4px 0 24px rgba(15,15,15,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        {isEditMode ? (
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{
              borderBottom: `1px solid ${themeColors.border}`,
              background: isDark
                ? `linear-gradient(135deg, ${themeColors.primary}14 0%, transparent 100%)`
                : `linear-gradient(135deg, ${themeColors.primary}0C 0%, transparent 100%)`,
            }}
          >
            <h2 className="text-base font-semibold leading-tight" style={{ color: themeColors.text }}>
              {formData.name || t('companyDetail')}
            </h2>
            <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setIsWide(w => !w)} title={isWide ? t('panelShrink') : t('panelExpand')}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
                style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
                {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              {saveState !== 'idle' && (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded"
                  style={{
                    color: saveState === 'saved' ? themeColors.primary : themeColors.textSecondary,
                    backgroundColor: saveState === 'saved' ? `${themeColors.primary}12` : 'transparent',
                  }}>
                  {saveState === 'saving'
                    ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" /></svg>{t('savingInProgress')}</>
                    : <><CheckCircle size={12} />{t('savedLabel')}</>}
                </span>
              )}
              {can('delete_companies') && (
                <button type="button" onClick={() => setConfirmConfig({ title: t('companyDeleteConfirm'), description: t('deleteCannotUndo'), onConfirm: async () => { setConfirmConfig(null); await executeDelete(); } })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer' }}>
                  <Trash2 size={13} />{t('delete')}
                </button>
              )}
              <button type="button" onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
                style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0"
            style={{
              borderBottom: `1px solid ${themeColors.border}`,
            }}
          >
            <div>
              <h2 className="text-lg font-semibold" style={{ color: themeColors.text, lineHeight: 1.3 }}>{ t('companyAddTitle') }</h2>
            </div>
            <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setIsWide(w => !w)} title={isWide ? t('panelShrink') : t('panelExpand')}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
                style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
                {isWide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button type="button" onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:opacity-60 transition-opacity"
                style={{ color: themeColors.textSecondary, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex flex-shrink-0 px-6" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-1 py-2.5 mr-5 text-sm font-medium transition-colors"
              style={{
                color: activeTab === tab ? themeColors.primary : themeColors.textSecondary,
                borderBottom: activeTab === tab ? `2px solid ${themeColors.primary}` : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="overflow-y-auto flex-1 min-h-0">
          <form id="company-form" onSubmit={handleSubmit} autoComplete="off" className="px-6 py-5">

            {/* ── 기본 정보 탭 ── */}
            {activeTab === '기본 정보' && (
              <div className="flex flex-col gap-4">
                <div style={sectionCard}>
                  <div className="mb-3.5">{sectionHead(<Building2 size={12} />, t('tabBasicInfo'))}</div>
                  <div className="space-y-3.5">
                    <div>
                      <p style={fl}>{ t('companyName') } <span style={{ color: '#EF4444' }}>*</span></p>
                      <div style={ulWrap('name')}>
                        <input type="text" required autoComplete="off" value={formData.name}
                          onChange={fd('name')}
                          onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                          placeholder={t('companyName')} className="ghost-input"
                          style={{ ...ghostInput, fontSize: '0.9375rem', fontWeight: 500 }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p style={fl}>{ t('businessNumber') }</p>
                        <div style={ulWrap('bizno')}>
                          <input type="text" autoComplete="off" value={formData.businessNumber}
                            onChange={handleBusinessNumberChange}
                            onFocus={() => setFocused('bizno')} onBlur={() => setFocused(null)}
                            placeholder="000-00-00000" className="ghost-input" style={ghostInput}
                            maxLength={12} />
                        </div>
                      </div>
                      <div>
                        <p style={fl}>{ t('representative') }</p>
                        <div style={ulWrap('rep')}>
                          <input type="text" autoComplete="off" value={formData.representative}
                            onChange={fd('representative')}
                            onFocus={() => setFocused('rep')} onBlur={() => setFocused(null)}
                            placeholder={t('representative')} className="ghost-input" style={ghostInput} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p style={fl}>{ t('address') }</p>
                      <div style={ulWrap('addr')} className="flex items-center gap-2">
                        <input type="text" readOnly autoComplete="off" value={formData.address}
                          placeholder={t('address')} className="ghost-input flex-1"
                          style={{ ...ghostInput, cursor: 'pointer' }}
                          onFocus={() => setFocused('addr')} onBlur={() => setFocused(null)}
                          onClick={() => setShowPostcode(true)} />
                        <button type="button" onClick={() => setShowPostcode(true)}
                          className="flex items-center gap-1 flex-shrink-0 text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ color: themeColors.primary, paddingBottom: '4px' }}
                          onMouseDown={(e) => e.stopPropagation()}>
                          <Search size={11} />{t('search')}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p style={fl}>{ t('notes') }</p>
                      <div style={ulWrap('notes')}>
                        <textarea
                          value={formData.notes}
                          onChange={fd('notes')}
                          onFocus={() => setFocused('notes')} onBlur={() => setFocused(null)}
                          placeholder={t('notes')}
                          rows={3}
                          className="ghost-input resize-none"
                          style={{ ...ghostInput, paddingTop: '6px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 담당자 목록 */}
                <div style={sectionCard}>
                  <div className="flex items-center justify-between mb-3.5">
                    {sectionHead(<Phone size={12} />, t('assignee'))}
                    <button type="button" onClick={() => setContacts(p => [...p, newContact()])}
                      className="flex items-center gap-1 transition-opacity hover:opacity-70"
                      style={{ color: themeColors.primary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      <Plus size={11} />{t('add')}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {contacts.map((c, i) => (
                      <div key={c.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)', border: `1px solid ${themeColors.border}`, borderRadius: '6px', padding: '10px 12px' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.textSecondary }}>{t('assignee')} {i + 1}</span>
                          {contacts.length > 1 && (
                            <button type="button" onClick={() => setContacts(p => p.filter((_, idx) => idx !== i))}
                              className="hover:opacity-70 transition-opacity" style={{ color: '#EF4444' }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('name') }</p>
                            <div style={ulWrap(`c-name-${i}`)}>
                              <input type="text" autoComplete="off" value={c.name}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                onFocus={() => setFocused(`c-name-${i}`)} onBlur={() => setFocused(null)}
                                placeholder={t('name')} className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                          <div>
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('contactRole') }</p>
                            <div style={ulWrap(`c-role-${i}`)}>
                              <input type="text" autoComplete="off" value={c.role}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))}
                                onFocus={() => setFocused(`c-role-${i}`)} onBlur={() => setFocused(null)}
                                placeholder={t('contactRole')} className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                          <div>
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('phone') }</p>
                            <div style={ulWrap(`c-phone-${i}`)}>
                              <input type="tel" autoComplete="off" value={c.phone}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, phone: formatPhone(e.target.value) } : x))}
                                onFocus={() => setFocused(`c-phone-${i}`)} onBlur={() => setFocused(null)}
                                placeholder="02-000-0000" className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                          <div>
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('mobile') }</p>
                            <div style={ulWrap(`c-mobile-${i}`)}>
                              <input type="tel" autoComplete="off" value={c.mobile}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, mobile: formatPhone(e.target.value) } : x))}
                                onFocus={() => setFocused(`c-mobile-${i}`)} onBlur={() => setFocused(null)}
                                placeholder="010-0000-0000" className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('email') }</p>
                            <div style={ulWrap(`c-email-${i}`)}>
                              <input type="email" autoComplete="off" value={c.email}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, email: e.target.value } : x))}
                                onFocus={() => setFocused(`c-email-${i}`)} onBlur={() => setFocused(null)}
                                placeholder="email@example.com" className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <p style={{ ...fl, marginBottom: '4px' }}>{ t('notes') }</p>
                            <div style={ulWrap(`c-notes-${i}`)}>
                              <input type="text" autoComplete="off" value={c.notes}
                                onChange={(e) => setContacts(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                                onFocus={() => setFocused(`c-notes-${i}`)} onBlur={() => setFocused(null)}
                                placeholder={t('notes')} className="ghost-input" style={ghostInput} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 계약 정보 탭 ── */}
            {activeTab === '계약 정보' && (
              <div className="flex flex-col gap-4">
                <div style={sectionCard}>
                  <div className="mb-3.5">{sectionHead(<FileText size={12} />, t('tabContractInfo'))}</div>
                  <div className="space-y-3.5">
                    <div>
                      <p style={fl}>{ t('contractStatus') }</p>
                      <div className="flex gap-2 mt-1.5">
                        {([
                          { key: 'maintenance', label: t('workTypeMaintenance') },
                          { key: 'project', label: t('projectsMenu') },
                          { key: 'ended', label: t('contractEnded') },
                        ] as const).map((item) => {
                          const isActive = formData.contractStatus === item.key;
                          return (
                            <button key={item.key} type="button"
                              onClick={() => setFormData(p => ({ ...p, contractStatus: item.key }))}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 text-xs font-medium transition-all"
                              style={{
                                borderRadius: '999px',
                                border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                backgroundColor: isActive ? `${themeColors.primary}18` : 'transparent',
                                color: isActive ? themeColors.primary : themeColors.textSecondary,
                              }}>
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p style={fl}>{ t('contractStartDate') }</p>
                        <div style={ulWrap('startDate')}>
                          <input type="date" value={formData.maintenanceStartDate}
                            onChange={fd('maintenanceStartDate')}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                            onFocus={() => setFocused('startDate')} onBlur={() => setFocused(null)}
                            className="ghost-input" style={{ ...ghostInput, colorScheme: isDark ? 'dark' : 'light' }} />
                        </div>
                      </div>
                      <div>
                        <p style={fl}>{ t('contractEndDate') }</p>
                        <div style={ulWrap('endDate')}>
                          <input type="date" value={formData.maintenanceEndDate}
                            onChange={fd('maintenanceEndDate')}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                            onFocus={() => setFocused('endDate')} onBlur={() => setFocused(null)}
                            className="ghost-input" style={{ ...ghostInput, colorScheme: isDark ? 'dark' : 'light' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 유지보수 상세 */}
                <div style={sectionCard}>
                  <div className="mb-3.5">{sectionHead(<FileText size={12} />, t('maintenanceManagement'))}</div>
                  <div className="space-y-3.5">
                    {/* 점검 주기 */}
                    <div>
                      <p style={fl}>{ t('inspectionCycleLabel') }</p>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        {([
                          { key: 'monthly', label: t('maintenanceCycleMonthly') },
                          { key: 'quarterly', label: t('maintenanceCycleQuarterly') },
                          { key: 'biannual', label: t('maintenanceCycleBiannual') },
                          { key: 'annual', label: t('maintenanceCycleAnnual') },
                        ] as const).map((item) => {
                          const isActive = formData.maintenanceCycle === item.key;
                          return (
                            <button key={item.key} type="button"
                              onClick={() => setFormData(p => ({ ...p, maintenanceCycle: item.key }))}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 text-xs font-medium transition-all"
                              style={{
                                borderRadius: '999px',
                                border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                backgroundColor: isActive ? `${themeColors.primary}18` : 'transparent',
                                color: isActive ? themeColors.primary : themeColors.textSecondary,
                              }}>
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 유지보수 방식 */}
                    <div>
                      <p style={fl}>{ t('maintenanceType') }</p>
                      <div className="flex gap-2 mt-1.5">
                        {([
                          { key: 'onsite', label: t('maintenanceTypeOnsite') },
                          { key: 'remote', label: t('maintenanceTypeRemote') },
                          { key: 'hybrid', label: t('maintenanceTypeHybrid') },
                        ] as const).map((item) => {
                          const isActive = formData.maintenanceType === item.key;
                          return (
                            <button key={item.key} type="button"
                              onClick={() => setFormData(p => ({ ...p, maintenanceType: item.key }))}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-4 py-1.5 text-xs font-medium transition-all"
                              style={{
                                borderRadius: '999px',
                                border: `1px solid ${isActive ? themeColors.primary : themeColors.border}`,
                                backgroundColor: isActive ? `${themeColors.primary}18` : 'transparent',
                                color: isActive ? themeColors.primary : themeColors.textSecondary,
                              }}>
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 원격 접속 방법 (원격/혼합일 때만 표시) */}
                    {(formData.maintenanceType === 'remote' || formData.maintenanceType === 'hybrid') && (
                      <div>
                        <p style={fl}>{ t('remoteAccessMethod') }</p>
                        <div style={ulWrap('remoteAccess')}>
                          <input type="text" autoComplete="off" value={formData.remoteAccessMethod}
                            onChange={fd('remoteAccessMethod')}
                            onFocus={() => setFocused('remoteAccess')} onBlur={() => setFocused(null)}
                            placeholder={t('remoteAccessMethodPlaceholder')} className="ghost-input" style={ghostInput} />
                        </div>
                      </div>
                    )}

                    {/* 담당자 지정 */}
                    <div>
                      <p style={fl}>{ t('assignManagerLabel') }</p>
                      <div style={ulWrap('assignedManager')} className="flex items-center gap-2">
                        <select
                          value={formData.assignedManagerId}
                          onChange={(e) => {
                            const selected = systemUsers.find(u => String(u.id) === e.target.value);
                            setFormData(p => ({
                              ...p,
                              assignedManagerId: e.target.value,
                              assignedManagerName: selected?.name || '',
                            }));
                          }}
                          onFocus={() => setFocused('assignedManager')} onBlur={() => setFocused(null)}
                          className="ghost-input flex-1"
                          style={{ ...ghostInput, cursor: 'pointer' }}
                        >
                          <option value="">{t('selectManagerPlaceholder')}</option>
                          {systemUsers.map(u => (
                            <option key={u.id} value={String(u.id)}>
                              {u.name}{u.department ? ` (${u.department}${u.position ? ' · ' + u.position : ''})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 계약 메모 */}
                <div style={sectionCard}>
                  <p style={fl}>{ t('notes') }</p>
                  <div style={ulWrap('contractNotes')}>
                    <textarea
                      value={formData.contractNotes}
                      onChange={fd('contractNotes')}
                      onFocus={() => setFocused('contractNotes')} onBlur={() => setFocused(null)}
                      placeholder={t('notes')}
                      rows={6}
                      className="ghost-input resize-none"
                      style={{ ...ghostInput, paddingTop: '6px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── 서버 정보 탭 ── */}
            {/* ── 서버 정보 탭 ── */}
            {activeTab === '서버 정보' && (
              <div style={sectionCard}>
                <div className="flex items-center justify-between mb-3.5">
                  {sectionHead(<Server size={12} />, t('tabServerInfo'))}
                  <button type="button" onClick={() => setServers(p => [...p, newServer()])}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: themeColors.primary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <Plus size={11} />{t('add')}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {servers.map((s, i) => (
                    <div key={s.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)', border: `1px solid ${themeColors.border}`, borderRadius: '6px', padding: '10px 12px' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.textSecondary }}>{t('serverNameLabel')} {i + 1}</span>
                        {servers.length > 1 && (
                          <button type="button" onClick={() => setServers(p => p.filter((_, idx) => idx !== i))}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="hover:opacity-70 transition-opacity" style={{ color: '#EF4444' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('serverNameLabel') }</p>
                          <div style={ulWrap(`s-name-${i}`)}>
                            <input type="text" autoComplete="off" value={s.name}
                              onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                              onFocus={() => setFocused(`s-name-${i}`)} onBlur={() => setFocused(null)}
                              placeholder={t('serverNameLabel')} className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('ipAddress') }</p>
                          <div style={ulWrap(`s-ip-${i}`)}>
                            <input type="text" autoComplete="off" value={s.ip}
                              onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, ip: e.target.value } : x))}
                              onFocus={() => setFocused(`s-ip-${i}`)} onBlur={() => setFocused(null)}
                              placeholder="000.000.000.000" className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>OS</p>
                          <div style={ulWrap(`s-os-${i}`)}>
                            <input type="text" autoComplete="off" value={s.os}
                              onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, os: e.target.value } : x))}
                              onFocus={() => setFocused(`s-os-${i}`)} onBlur={() => setFocused(null)}
                              placeholder="Ubuntu 22.04 / Windows Server 등" className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('serverTypeLabel') }</p>
                          <div style={ulWrap(`s-type-${i}`)}>
                            {SERVER_TYPES.includes(s.serverType) ? (
                              <select value={s.serverType}
                                onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, serverType: e.target.value === '직접 입력' ? '' : e.target.value } : x))}
                                onFocus={() => setFocused(`s-type-${i}`)} onBlur={() => setFocused(null)}
                                className="ghost-input w-full"
                                style={{ ...ghostInput, backgroundColor: 'transparent', cursor: 'pointer' }}>
                                {SERVER_TYPES.map(st => <option key={st} value={st}>{SERVER_TYPE_LABELS[st] ?? st}</option>)}
                                <option value="직접 입력">{t('directInput')}</option>
                              </select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input type="text" autoComplete="off" value={s.serverType}
                                  onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, serverType: e.target.value } : x))}
                                  onFocus={() => setFocused(`s-type-${i}`)} onBlur={() => setFocused(null)}
                                  placeholder={t('serverTypeLabel')} className="ghost-input flex-1" style={ghostInput} />
                                <button type="button" onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => setServers(p => p.map((x, idx) => idx === i ? { ...x, serverType: SERVER_TYPES[0] } : x))}
                                  className="flex-shrink-0 hover:opacity-70 transition-opacity text-xs"
                                  style={{ color: themeColors.textSecondary, paddingBottom: '4px' }}>✕</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('loginId') }</p>
                          <div style={ulWrap(`s-lid-${i}`)}>
                            <input type="text" autoComplete="off" value={s.loginId}
                              onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, loginId: e.target.value } : x))}
                              onFocus={() => setFocused(`s-lid-${i}`)} onBlur={() => setFocused(null)}
                              placeholder="admin" className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('password') }</p>
                          <div style={ulWrap(`s-pw-${i}`)} className="flex items-center gap-1">
                            <input
                              type={showSrvPw[s.id] ? 'text' : 'password'}
                              autoComplete="new-password" value={s.loginPw}
                              onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, loginPw: e.target.value } : x))}
                              onFocus={() => setFocused(`s-pw-${i}`)} onBlur={() => setFocused(null)}
                              placeholder={t('password')} className="ghost-input flex-1" style={ghostInput} />
                            <button type="button"
                              onClick={() => setShowSrvPw(p => ({ ...p, [s.id]: !p[s.id] }))}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-shrink-0 hover:opacity-70 transition-opacity"
                              style={{ color: themeColors.textSecondary, paddingBottom: '4px' }}>
                              {showSrvPw[s.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('notes') }</p>
                          <textarea value={s.notes}
                            onChange={(e) => setServers(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                            onFocus={() => setFocused(`s-notes-${i}`)} onBlur={() => setFocused(null)}
                            placeholder={t('notes')} rows={3}
                            className="w-full text-sm resize-none focus:outline-none ghost-input mt-0.5"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)',
                              border: `1px solid ${focused === `s-notes-${i}` ? themeColors.primary : themeColors.border}`,
                              borderRadius: '4px', padding: '6px 8px',
                              color: themeColors.text, fontSize: '13px',
                            }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── VPN 정보 탭 ── */}
            {activeTab === 'VPN 정보' && (
              <div style={sectionCard}>
                <div className="flex items-center justify-between mb-3.5">
                  {sectionHead(<Shield size={12} />, t('tabVpnInfo'))}
                  <button type="button" onClick={() => setVpnAccounts(p => [...p, newVpn()])}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: themeColors.primary, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <Plus size={11} />{t('add')}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {vpnAccounts.map((v, i) => (
                    <div key={v.id} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.02)', border: `1px solid ${themeColors.border}`, borderRadius: '6px', padding: '10px 12px' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.textSecondary }}>VPN {i + 1}</span>
                        {vpnAccounts.length > 1 && (
                          <button type="button" onClick={() => setVpnAccounts(p => p.filter((_, idx) => idx !== i))}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="hover:opacity-70 transition-opacity" style={{ color: '#EF4444' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('vpnTypeLabel') }</p>
                          <div style={ulWrap(`v-type-${i}`)}>
                            {VPN_TYPES.includes(v.vpnType) ? (
                              <select value={v.vpnType}
                                onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, vpnType: e.target.value === '직접 입력' ? '' : e.target.value } : x))}
                                onFocus={() => setFocused(`v-type-${i}`)} onBlur={() => setFocused(null)}
                                className="ghost-input w-full"
                                style={{ ...ghostInput, backgroundColor: 'transparent', cursor: 'pointer' }}>
                                {VPN_TYPES.map(vt => <option key={vt} value={vt}>{vt === '기타' ? t('other') : vt}</option>)}
                                <option value="직접 입력">{t('directInput')}</option>
                              </select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input type="text" autoComplete="off" value={v.vpnType}
                                  onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, vpnType: e.target.value } : x))}
                                  onFocus={() => setFocused(`v-type-${i}`)} onBlur={() => setFocused(null)}
                                  placeholder={t('vpnTypeLabel')} className="ghost-input flex-1" style={ghostInput} />
                                <button type="button" onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, vpnType: VPN_TYPES[0] } : x))}
                                  className="flex-shrink-0 hover:opacity-70 transition-opacity text-xs"
                                  style={{ color: themeColors.textSecondary, paddingBottom: '4px' }}>✕</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('serverAddressLabel') }</p>
                          <div style={ulWrap(`v-srv-${i}`)}>
                            <input type="text" autoComplete="off" value={v.server}
                              onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, server: e.target.value } : x))}
                              onFocus={() => setFocused(`v-srv-${i}`)} onBlur={() => setFocused(null)}
                              placeholder="vpn.example.com" className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('portLabel') }</p>
                          <div style={ulWrap(`v-port-${i}`)}>
                            <input type="text" autoComplete="off" value={v.port}
                              onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, port: e.target.value } : x))}
                              onFocus={() => setFocused(`v-port-${i}`)} onBlur={() => setFocused(null)}
                              placeholder="443 / 1194" className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('accountId') }</p>
                          <div style={ulWrap(`v-acc-${i}`)}>
                            <input type="text" autoComplete="off" value={v.account}
                              onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, account: e.target.value } : x))}
                              onFocus={() => setFocused(`v-acc-${i}`)} onBlur={() => setFocused(null)}
                              placeholder={t('accountId')} className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('password') }</p>
                          <div style={ulWrap(`v-pw-${i}`)} className="flex items-center gap-1">
                            <input
                              type={showVpnPw[v.id] ? 'text' : 'password'}
                              autoComplete="new-password" value={v.password}
                              onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, password: e.target.value } : x))}
                              onFocus={() => setFocused(`v-pw-${i}`)} onBlur={() => setFocused(null)}
                              placeholder={t('password')} className="ghost-input flex-1" style={ghostInput} />
                            <button type="button"
                              onClick={() => setShowVpnPw(p => ({ ...p, [v.id]: !p[v.id] }))}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-shrink-0 hover:opacity-70 transition-opacity"
                              style={{ color: themeColors.textSecondary, paddingBottom: '4px' }}>
                              {showVpnPw[v.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <p style={{ ...fl, marginBottom: '4px' }}>{ t('notes') }</p>
                          <div style={ulWrap(`v-notes-${i}`)}>
                            <input type="text" autoComplete="off" value={v.notes}
                              onChange={(e) => setVpnAccounts(p => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                              onFocus={() => setFocused(`v-notes-${i}`)} onBlur={() => setFocused(null)}
                              placeholder={t('notes')} className="ghost-input" style={ghostInput} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </form>
        </div>

        {/* 변경 이력 — 오른쪽 슬라이드 오버레이 패널 */}
        {isEditMode && showHistory && (() => {
          const fullTime = (d: Date) => d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          return (
            <div
              className="history-slide"
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 0,
                width: '288px',
                backgroundColor: isDark ? 'rgba(22,27,34,0.97)' : 'rgba(255,255,255,0.97)',
                borderLeft: `1px solid ${themeColors.border}`,
                display: 'flex', flexDirection: 'column',
                zIndex: 10,
                backdropFilter: 'blur(6px)',
              }}
            >
              {/* 패널 헤더 */}
              <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={13} style={{ color: themeColors.primary }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: themeColors.text, letterSpacing: '0.03em' }}>{ t('changeHistory') }</span>
                  {historyLogs.length > 0 && (
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>{historyLogs.length}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeColors.textSecondary, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <X size={14} />
                </button>
              </div>

              {/* 타임라인 내용 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 12px' }}>
                {historyLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                    <svg className="animate-spin" style={{ width: '1.25rem', height: '1.25rem', color: themeColors.primary }} viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" />
                    </svg>
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '2rem 0' }}>
                    <History size={20} style={{ color: themeColors.textSecondary, opacity: 0.25 }} />
                    <p style={{ fontSize: '0.75rem', color: themeColors.textSecondary, opacity: 0.45 }}>{ t('noHistory') }</p>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '9px', top: '10px', bottom: '10px', width: '1px', backgroundColor: themeColors.border }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {historyLogs.map((log, i) => {
                        const isCreate = log.action === 'create';
                        const isDelete = log.action === 'delete';
                        const dotColor = isCreate ? themeColors.primary : isDelete ? '#EF4444' : (isDark ? '#6B7280' : '#9CA3AF');
                        const DotIcon = isCreate ? Plus : isDelete ? Trash2 : PenLine;
                        const parsedChanges: { field: string; oldValue: string; newValue: string }[] = [];
                        if (log.details && log.details.includes(' → ')) {
                          log.details.split(' / ').forEach((part: string) => {
                            const colonIdx = part.indexOf(': ');
                            if (colonIdx === -1) return;
                            const field = part.slice(0, colonIdx).trim();
                            const rest = part.slice(colonIdx + 2);
                            const arrowIdx = rest.indexOf(' → ');
                            if (arrowIdx === -1) return;
                            parsedChanges.push({ field, oldValue: rest.slice(0, arrowIdx).trim(), newValue: rest.slice(arrowIdx + 3).trim() });
                          });
                        }
                        const ts = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                        return (
                          <div key={i} style={{ display: 'flex', gap: '10px', padding: '6px 0', alignItems: 'flex-start' }}>
                            <div style={{ width: '19px', height: '19px', borderRadius: '50%', backgroundColor: `${dotColor}18`, border: `1.5px solid ${dotColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', position: 'relative', zIndex: 1 }}>
                              <DotIcon size={9} style={{ color: dotColor }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, paddingBottom: i < historyLogs.length - 1 ? '4px' : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: parsedChanges.length > 0 ? '4px' : 0 }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: `${themeColors.primary}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.5rem', fontWeight: 700, color: themeColors.primary }}>{(log.userName || '?').charAt(0)}</span>
                                </div>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: themeColors.text }}>{log.userName || '-'}</span>
                                <span style={{ fontSize: '0.625rem', color: themeColors.textSecondary, opacity: 0.5 }}>·</span>
                                <span title={fullTime(ts)} style={{ fontSize: '0.625rem', color: themeColors.textSecondary, cursor: 'default' }}>{relativeTime(ts)}</span>
                                {(isCreate || isDelete) && (
                                  <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: `${dotColor}15`, color: dotColor }}>{isCreate ? t('logCreated') : t('delete')}</span>
                                )}
                              </div>
                              {parsedChanges.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {parsedChanges.map((c, ci) => (
                                    <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', fontSize: '0.625rem', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderRadius: '4px', padding: '3px 6px' }}>
                                      <span style={{ fontWeight: 600, color: themeColors.textSecondary, flexShrink: 0 }}>{c.field}</span>
                                      {c.oldValue
                                        ? <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: isDark ? '#F87171' : '#DC2626', textDecoration: 'line-through', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.oldValue}</span>
                                        : <span style={{ color: themeColors.textSecondary, opacity: 0.4 }}>{t('unknown')}</span>}
                                      <span style={{ color: themeColors.textSecondary, flexShrink: 0 }}>→</span>
                                      <span style={{ padding: '0 3px', borderRadius: '3px', backgroundColor: isDark ? 'rgba(63,185,80,0.12)' : 'rgba(34,197,94,0.08)', color: isDark ? '#3FB950' : '#16A34A', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.newValue || t('unknown')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {parsedChanges.length === 0 && log.details && (
                                <p style={{ fontSize: '0.625rem', color: themeColors.textSecondary, marginTop: '2px', lineHeight: 1.5 }}>{log.details}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        {isEditMode ? (
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${themeColors.border}` }}>
            {isAdminAccount(user) && (
              <button type="button" onClick={toggleHistory}
                className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
                style={{ color: showHistory ? themeColors.primary : themeColors.textSecondary }}>
                <History size={13} />
                {t('changeHistory')}
                <ChevronRight size={12} style={{ transition: 'transform 0.2s', transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
            )}
            <button type="submit" form="company-form"
              disabled={isLoading || !formData.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: themeColors.primary, color: onPrimaryText }}>
              <Save size={13} />
              {isLoading ? t('savingInProgress') : t('save')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${themeColors.border}` }}>
            <button type="button" onClick={handleClose}
              className="flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-70"
              style={{ color: themeColors.textSecondary, border: `1px solid ${themeColors.border}`, minWidth: '80px' }}>
              {t('cancel')}
            </button>
            <button type="submit" form="company-form"
              disabled={isLoading || !formData.name.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: themeColors.primary, color: onPrimaryText, minWidth: '80px' }}>
              <Save size={13} />
              {isLoading ? t('processing') : t('companyAddTitle')}
            </button>
          </div>
        )}
      </div>
      )}

      {/* 주소 검색 모달 */}
      {showPostcode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => { e.stopPropagation(); setShowPostcode(false); }}>
          <div className="overflow-hidden w-full mx-4"
            style={{ maxWidth: '480px', backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div className="flex items-center gap-2">
                <Search size={13} style={{ color: themeColors.primary }} />
                <span className="text-sm font-semibold" style={{ color: themeColors.text }}>{ t('address') }</span>
              </div>
              <button type="button" onClick={() => setShowPostcode(false)} className="hover:opacity-60 transition-opacity" style={{ color: themeColors.textSecondary }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-3">
              <DaumPostcode onComplete={handlePostcodeComplete} autoClose={false} style={{ height: '400px' }} />
            </div>
          </div>
        </div>
      )}

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title ?? ''}
        description={confirmConfig?.description}
        onConfirm={() => confirmConfig?.onConfirm()}
        onCancel={() => setConfirmConfig(null)}
      />
    </>
  );
};

export default CompanyCreateModal;
