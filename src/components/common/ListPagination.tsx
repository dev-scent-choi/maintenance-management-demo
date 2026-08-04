import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';
import { useLanguage } from '../../contexts/LanguageContext';

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Unified pagination for all list pages.
 * Prev/Next text + icon buttons with smart ellipsis page range.
 */
const ListPagination: React.FC<ListPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  const t = useLanguage();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  const pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (currentPage <= 3) {
    pages.push(1, 2, 3, 4, '...', totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
  }

  const activePageText = theme === 'yellow' ? '#333333' : '#fff';

  return (
    <div
      className={`flex items-center justify-center px-4 py-2.5 flex-shrink-0 gap-2${className ? ` ${className}` : ''}`}
      style={{ borderTop: `1px solid ${themeColors.border}` }}
    >
      {/* 이전 버튼 */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
        style={{ color: currentPage === 1 ? themeColors.textSecondary : themeColors.text }}
        onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <ChevronLeft size={15} />
        <span>{t('previous')}</span>
      </button>

      {/* 페이지 번호 */}
      <div className="flex items-center gap-1">
        {pages.map((page, idx) =>
          page === '...' ? (
            <span
              key={`e-${idx}`}
              className="px-2 text-sm"
              style={{ color: themeColors.textSecondary }}
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className="w-8 h-8 rounded text-sm font-medium transition-all"
              style={{
                backgroundColor: currentPage === page ? themeColors.primary : 'transparent',
                color: currentPage === page ? activePageText : themeColors.text,
              }}
              onMouseEnter={(e) => { if (currentPage !== page) e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { if (currentPage !== page) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {page}
            </button>
          )
        )}
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
        disabled={currentPage >= totalPages || totalPages === 0}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
        style={{ color: currentPage >= totalPages ? themeColors.textSecondary : themeColors.text }}
        onMouseEnter={(e) => { if (currentPage < totalPages) e.currentTarget.style.backgroundColor = hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span>{t('next')}</span>
        <ChevronRight size={15} />
      </button>
    </div>
  );
};

export default ListPagination;
