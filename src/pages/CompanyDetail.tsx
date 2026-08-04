import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, AlertCircle, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { usePermission } from '../hooks/usePermission';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmPopover from '../components/common/ConfirmPopover';
import CompanyContactsTab from '../components/company/CompanyContactsTab';
import CompanyServersTab from '../components/company/CompanyServersTab';
import CompanyVpnTab from '../components/company/CompanyVpnTab';

const CompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { token } = useAuthStore();
  const { can } = usePermission();

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'contacts' | 'servers' | 'vpn'>('basic');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!id || !token) return;
    const fetchCompany = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setCompany(data);
      } catch (error) {
        console.error('Error fetching company:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompany();
  }, [id, token]);

  const executeDelete = async () => {
    if (!id || !token) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' })
      });
      if (!response.ok) throw new Error('Failed to delete');
      navigate('/companies');
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('업체 삭제에 실패했습니다.');
    }
  };

  // 메모 영역 이미지 클릭 → 이미지 뷰어
  const openLightbox = (src: string) => {
    setLightboxSrc(src);
    setZoom(100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => { setZoom(100); setRotation(0); setPosition({ x: 0, y: 0 }); };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    setZoom(prev => Math.max(25, Math.min(300, prev + delta)));
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Escape 키로 뷰어 닫기
  useEffect(() => {
    if (!lightboxSrc) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxSrc]);

  const getPrimaryBg = (alpha: number) => {
    const primary = themeColors.primary;
    if (primary.startsWith('#')) {
      return `${primary}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    }
    return primary.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  };

  const getContractStatusBadge = () => {
    if (!company) return { label: '-' };
    const status = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
    switch (status) {
      case 'maintenance':
        return { label: '유지보수' };
      case 'project':
        return { label: '프로젝트' };
      case 'ended':
        return { label: '계약종료' };
      default:
        return { label: '-' };
    }
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  if (isLoading) return <LoadingSpinner message="업체 정보를 불러오는 중..." />;

  if (!company) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 opacity-20" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm font-medium" style={{ color: themeColors.text }}>업체 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/companies')}
            className="mt-4 px-4 py-2 rounded text-sm font-medium text-white"
            style={{ backgroundColor: themeColors.primary }}
          >
            업체 목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  const badge = getContractStatusBadge();

  const isDark = theme === 'dark' || theme === 'yellow';

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.surface,
    border: `1px solid ${themeColors.border}`,
    borderRadius: '4px',
    boxShadow: 'none',
  };

  return (
    <div>
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/companies')}
            className="p-2.5 rounded transition-colors"
            style={{ color: themeColors.textSecondary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: themeColors.text }}>
                {company.name}
              </h1>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: getPrimaryBg(0.15), color: themeColors.primary }}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: themeColors.textSecondary }}>
              {t('companyDetail')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {can('update_companies') && (
            <button
              onClick={() => navigate(`/companies/${id}/edit`)}
              className="flex items-center gap-2 px-5 py-2.5 rounded font-medium text-white text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Edit size={15} />
              {t('edit')}
            </button>
          )}
          {can('delete_companies') && (
            <button
              onClick={() => setConfirmConfig({ title: '선택한 업체가 삭제됩니다.', description: '삭제하면 복구할 수 없습니다.', onConfirm: async () => { setConfirmConfig(null); await executeDelete(); } })}
              className="flex items-center gap-2 px-4 py-2.5 rounded font-medium text-sm transition-colors"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
            >
              <Trash2 size={15} />
              {t('delete')}
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-0 mb-6" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
        {([
          { key: 'basic', label: '기본 정보' },
          { key: 'contacts', label: '담당자' },
          { key: 'servers', label: '서버 정보' },
          { key: 'vpn', label: 'VPN 정보' },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: isActive ? themeColors.primary : themeColors.textSecondary,
                borderBottom: isActive ? `2px solid ${themeColors.primary}` : '2px solid transparent',
                marginBottom: '-1px',
                background: 'transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 담당자 탭 */}
      {activeTab === 'contacts' && <CompanyContactsTab companyId={id!} readOnly />}

      {/* 서버 정보 탭 */}
      {activeTab === 'servers' && <CompanyServersTab companyId={id!} readOnly />}

      {/* VPN 정보 탭 */}
      {activeTab === 'vpn' && <CompanyVpnTab companyId={id!} readOnly />}

      {/* 메인 콘텐츠 - 기본 정보 탭 */}
      {activeTab === 'basic' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 정보 + 연락처 */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* 기본 정보 카드 */}
          <div className="rounded p-6" style={cardStyle}>
            <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('basicInfo')}</h2>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('companyBasicInfo')}</p>
              </div>
            </div>

            <div className="space-y-5">
              <InfoItem label={t('companyName')} value={company.name} themeColors={themeColors} isDark={isDark} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoItem label={t('businessNumber')} value={company.businessNumber} themeColors={themeColors} isDark={isDark} />
                <InfoItem label={t('representative')} value={company.representative} themeColors={themeColors} isDark={isDark} />
              </div>

              <InfoItem label={t('address')} value={company.address} themeColors={themeColors} isDark={isDark} />
            </div>
          </div>

          {/* 연락처 정보 카드 */}
          <div className="rounded p-6 flex-1" style={cardStyle}>
            <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('contactInfo')}</h2>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('companyContact')} &amp; {t('companyPhone')}</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoItem label={t('email')} value={company.email} themeColors={themeColors} isDark={isDark} />
                <InfoItem label={t('companyContact')} value={company.contact} themeColors={themeColors} isDark={isDark} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoItem label={t('phone')} value={company.phone} themeColors={themeColors} isDark={isDark} />
                <InfoItem label={t('mobile')} value={company.mobile} themeColors={themeColors} isDark={isDark} />
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 계약 정보 + 메모 */}
        <div className="flex flex-col gap-6">
          {/* 계약 정보 카드 */}
          <div className="rounded p-6" style={cardStyle}>
            <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('contractInfo')}</h2>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('contractStatus')} &amp; {t('period')}</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 계약 상태 */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: themeColors.text }}>{t('contractStatus')}</p>
                <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${themeColors.border}` }}>
                  {[
                    { key: 'maintenance', label: t('maintenance') },
                    { key: 'project', label: t('projectsMenu') },
                    { key: 'ended', label: t('contractInactive') }
                  ].map((item) => {
                    const currentStatus = company.contractStatus || (company.maintenanceContract ? 'maintenance' : 'project');
                    const isActive = currentStatus === item.key;
                    return (
                      <div
                        key={item.key}
                        className="flex-1 py-3 text-center text-sm font-medium transition-all"
                        style={{
                          background: isActive
                            ? themeColors.primary
                            : 'transparent',
                          color: isActive ? '#fff' : themeColors.textSecondary,
                          borderRight: item.key !== 'ended' ? `1px solid ${themeColors.border}` : 'none'
                        }}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <InfoItem label={t('contractStartDate')} value={formatDate(company.maintenanceStartDate)} themeColors={themeColors} isDark={isDark} />
              <InfoItem label={t('contractEndDate')} value={formatDate(company.maintenanceEndDate)} themeColors={themeColors} isDark={isDark} />
            </div>
          </div>

          {/* 메모 카드 */}
          <div className="rounded p-6 flex-1 flex flex-col" style={cardStyle}>
            <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: themeColors.text }}>{t('notes')}</h2>
                <p className="text-xs" style={{ color: themeColors.textSecondary }}>{t('notesPlaceholder')}</p>
              </div>
            </div>

            <div
              className="flex-1 px-4 py-3.5 rounded text-sm min-h-[120px]"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FAFBFC',
                border: `1.5px solid ${themeColors.border}`,
                color: company.notes ? themeColors.text : themeColors.textSecondary
              }}
            >
              {company.notes ? (
                <>
                  <style>{`.notes-content img { cursor: zoom-in !important; }`}</style>
                  <div
                    className="notes-content"
                    dangerouslySetInnerHTML={{ __html: company.notes }}
                    style={{ lineHeight: 1.7 }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'IMG') {
                        openLightbox((target as HTMLImageElement).src);
                      }
                    }}
                  />
                </>
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>
      </div>)}

      {/* 이미지 뷰어 (FileViewer 스타일) */}
      {lightboxSrc && ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
          <div className="rounded shadow-sm w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
              <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>메모 이미지</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleZoomOut} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="축소">
                  <ZoomOut size={18} />
                </button>
                <span className="text-sm min-w-[60px] text-center" style={{ color: themeColors.textSecondary }}>{zoom}%</span>
                <button onClick={handleZoomIn} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="확대">
                  <ZoomIn size={18} />
                </button>
                <button onClick={handleRotate} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="회전">
                  <RotateCw size={18} />
                </button>
                <button onClick={handleReset} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }}>
                  초기화
                </button>
                <button onClick={() => setLightboxSrc(null)} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}>
                  닫기
                </button>
              </div>
            </div>
            {/* 이미지 영역 */}
            <div
              className="flex-1 overflow-hidden p-4 flex items-center justify-center"
              style={{ backgroundColor: themeColors.card, cursor: isDragging ? 'grabbing' : 'grab' }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={lightboxSrc}
                alt="메모 이미지"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  userSelect: 'none'
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmPopover
        isOpen={!!confirmConfig}
        title={confirmConfig?.title ?? ''}
        description={confirmConfig?.description}
        onConfirm={() => confirmConfig?.onConfirm()}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
};

// 정보 항목 컴포넌트
const InfoItem: React.FC<{
  label: string;
  value?: string | null;
  themeColors: any;
  isDark: boolean;
}> = ({ label, value, themeColors, isDark }) => {
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: themeColors.text }}>{label}</p>
      <p
        className="text-sm px-4 py-3.5 rounded"
        style={{
          color: value ? themeColors.text : themeColors.textSecondary,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FAFBFC',
          border: `1.5px solid ${themeColors.border}`
        }}
      >
        {value || '-'}
      </p>
    </div>
  );
};

export default CompanyDetail;
