import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Wrench, User as UserIcon, X, FileText } from 'lucide-react';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import type { Company, MaintenanceRecord, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SearchResult {
  type: 'company' | 'maintenance' | 'user';
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  data: Company | MaintenanceRecord | User;
}

const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const { companies, maintenanceRecords, users } = useMaintenanceStore();
  const t = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색 수행
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const newResults: SearchResult[] = [];

    // 업체 검색
    companies.forEach((company) => {
      const matchScore =
        (company.name.toLowerCase().includes(searchLower) ? 10 : 0) +
        (company.contact.toLowerCase().includes(searchLower) ? 5 : 0) +
        (company.representative.toLowerCase().includes(searchLower) ? 5 : 0) +
        (company.address.toLowerCase().includes(searchLower) ? 3 : 0) +
        (company.phone.toLowerCase().includes(searchLower) ? 3 : 0);

      if (matchScore > 0) {
        newResults.push({
          type: 'company',
          id: company.id,
          title: company.name,
          subtitle: `${t('managerLabel')}: ${company.contact} · ${company.representative}`,
          description: company.address || t('noAddress'),
          data: company,
        });
      }
    });

    // 유지보수 기록 검색
    maintenanceRecords.forEach((record) => {
      const descriptionText = record.description.replace(/<[^>]*>/g, ''); // HTML 태그 제거
      const matchScore =
        (record.title.toLowerCase().includes(searchLower) ? 10 : 0) +
        (record.companyName.toLowerCase().includes(searchLower) ? 7 : 0) +
        (descriptionText.toLowerCase().includes(searchLower) ? 5 : 0) +
        (record.assignedToName?.toLowerCase().includes(searchLower) ? 5 : 0);

      if (matchScore > 0) {
        newResults.push({
          type: 'maintenance',
          id: record.id,
          title: record.title,
          subtitle: `${record.companyName} · ${record.assignedToName || t('unassigned')}`,
          description: descriptionText.substring(0, 100),
          data: record,
        });
      }
    });

    // 사용자 검색
    users.forEach((user) => {
      const matchScore =
        (user.name.toLowerCase().includes(searchLower) ? 10 : 0) +
        (user.email.toLowerCase().includes(searchLower) ? 7 : 0) +
        (user.department.toLowerCase().includes(searchLower) ? 5 : 0) +
        (user.position.toLowerCase().includes(searchLower) ? 5 : 0) +
        (user.phone.toLowerCase().includes(searchLower) ? 3 : 0);

      if (matchScore > 0) {
        newResults.push({
          type: 'user',
          id: user.id,
          title: user.name,
          subtitle: `${user.department} · ${user.position}`,
          description: user.email,
          data: user,
        });
      }
    });

    setResults(newResults);
    setIsOpen(newResults.length > 0);
    setSelectedIndex(0);
  }, [searchTerm, companies, maintenanceRecords, users]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleResultClick(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // 결과 클릭 핸들러
  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'company') {
      navigate(`/companies/${result.id}/edit`);
    } else if (result.type === 'maintenance') {
      navigate(`/maintenance/${result.id}`);
    } else if (result.type === 'user') {
      navigate(`/users/${result.id}/edit`);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  // 검색 초기화
  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // 결과 아이콘 가져오기
  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'company':
        return <Building2 size={18} />;
      case 'maintenance':
        return <Wrench size={18} />;
      case 'user':
        return <UserIcon size={18} />;
      default:
        return <FileText size={18} />;
    }
  };

  // 결과 타입 레이블
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'company':
        return t('companyManagement');
      case 'maintenance':
        return t('maintenance');
      case 'user':
        return t('userManagement');
      default:
        return '';
    }
  };

  // 타입별로 그룹화
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
          style={{ color: themeColors.textSecondary }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={t('search') + '...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="w-full pl-10 pr-10 py-2 sm:py-3 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-sm"
          style={{
            backgroundColor: themeColors.background,
            border: `1px solid ${themeColors.border}`,
            color: themeColors.text,
          }}
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-10 transition-colors"
            style={{ color: themeColors.textSecondary }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[600px] overflow-y-auto"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`,
          }}
        >
          {/* 결과 요약 */}
          <div
            className="px-4 py-3 border-b text-xs font-medium"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              color: themeColors.textSecondary,
              borderColor: themeColors.border,
            }}
          >
            {t('searchResultsCount', { count: results.length })}
          </div>

          {/* 타입별 그룹 */}
          {Object.entries(groupedResults).map(([type, items]) => (
            <div key={type}>
              <div
                className="px-4 py-2 text-xs font-semibold"
                style={{
                  color: themeColors.textSecondary,
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
              >
                {getTypeLabel(type as SearchResult['type'])} ({items.length})
              </div>
              {items.map((result, index) => {
                const globalIndex = results.indexOf(result);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <div
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="px-4 py-3 cursor-pointer transition-all duration-150 border-b last:border-b-0"
                    style={{
                      backgroundColor: isSelected
                        ? theme === 'dark'
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)'
                        : 'transparent',
                      borderColor: themeColors.border,
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <div className="flex items-start space-x-3">
                      {/* 아이콘 */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background:
                            result.type === 'company'
                              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                              : result.type === 'maintenance'
                              ? 'linear-gradient(135deg, #10b981, #059669)'
                              : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                          color: 'white',
                        }}
                      >
                        {getResultIcon(result.type)}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4
                            className="text-sm font-semibold truncate"
                            style={{ color: themeColors.text }}
                          >
                            {result.title}
                          </h4>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                            style={{
                              backgroundColor:
                                result.type === 'company'
                                  ? 'rgba(59, 130, 246, 0.1)'
                                  : result.type === 'maintenance'
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : 'rgba(139, 92, 246, 0.1)',
                              color:
                                result.type === 'company'
                                  ? '#3b82f6'
                                  : result.type === 'maintenance'
                                  ? '#10b981'
                                  : '#8b5cf6',
                            }}
                          >
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        <p
                          className="text-xs truncate mb-1"
                          style={{ color: themeColors.textSecondary }}
                        >
                          {result.subtitle}
                        </p>
                        {result.description && (
                          <p
                            className="text-xs line-clamp-2"
                            style={{ color: themeColors.textSecondary, opacity: 0.8 }}
                          >
                            {result.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* 안내 문구 */}
          <div
            className="px-4 py-2 text-xs text-center border-t"
            style={{
              color: themeColors.textSecondary,
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              borderColor: themeColors.border,
            }}
          >
            <span className="opacity-60">{t('searchHint')}</span>
          </div>
        </div>
      )}

      {/* 검색어가 있지만 결과가 없을 때 */}
      {isOpen && searchTerm && results.length === 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 p-8 text-center"
          style={{
            backgroundColor: themeColors.surface,
            border: `1px solid ${themeColors.border}`,
          }}
        >
          <Search size={48} className="mx-auto mb-4 opacity-20" style={{ color: themeColors.textSecondary }} />
          <p className="text-sm font-medium mb-2" style={{ color: themeColors.text }}>
            {t('searchNoResults')}
          </p>
          <p className="text-xs" style={{ color: themeColors.textSecondary }}>
            {t('searchNoResultsFor', { term: searchTerm })}
          </p>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
