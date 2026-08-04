import { Clock, Activity, CheckCircle2, XCircle } from 'lucide-react';

/**
 * 언어 코드를 locale 코드로 변환
 */
export const getLocaleFromLanguage = (language: 'ko' | 'en' | 'ja'): string => {
  const localeMap = {
    ko: 'ko-KR',
    en: 'en-US',
    ja: 'ja-JP',
  };
  return localeMap[language] || 'ko-KR';
};

/**
 * 날짜 포맷팅 함수
 */
export const formatDate = (date: Date | undefined, locale: string = 'ko-KR'): string => {
  if (!date) return '-';

  try {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    return '-';
  }
};

/**
 * 날짜와 시간 포맷팅 함수
 */
export const formatDateTime = (date: Date | undefined, locale: string = 'ko-KR'): string => {
  if (!date) return '-';

  try {
    return new Date(date).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '-';
  }
};

/**
 * 파일 크기 포맷팅 함수
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * 상대 시간 포맷팅 함수 (예: "3시간 전", "2일 전")
 */
export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInMinutes < 1) return '방금 전';
  if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  if (diffInDays < 30) return `${diffInDays}일 전`;
  if (diffInMonths < 12) return `${diffInMonths}개월 전`;
  return `${diffInYears}년 전`;
};

/**
 * 유지보수 상태 설정 반환
 */
export const getMaintenanceStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        bg: 'rgba(251, 191, 36, 0.1)',
        color: '#F59E0B',
        label: '대기',
      };
    case 'in-progress':
      return {
        icon: Activity,
        bg: 'rgba(59, 130, 246, 0.1)',
        color: '#3B82F6',
        label: '처리중',
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        bg: 'rgba(16, 185, 129, 0.1)',
        color: '#10B981',
        label: '완료',
      };
    case 'cancelled':
      return {
        icon: XCircle,
        bg: 'rgba(239, 68, 68, 0.1)',
        color: '#EF4444',
        label: '취소',
      };
    default:
      return {
        icon: Clock,
        bg: 'rgba(156, 163, 175, 0.1)',
        color: '#6B7280',
        label: '알 수 없음',
      };
  }
};

/**
 * 우선순위 배지 설정 반환
 */
export const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return {
        bg: 'rgba(239, 68, 68, 0.1)',
        color: '#EF4444',
        label: '긴급',
      };
    case 'high':
      return {
        bg: 'rgba(245, 158, 11, 0.1)',
        color: '#F59E0B',
        label: '높음',
      };
    case 'medium':
      return {
        bg: 'rgba(59, 130, 246, 0.1)',
        color: '#3B82F6',
        label: '보통',
      };
    case 'low':
      return {
        bg: 'rgba(16, 185, 129, 0.1)',
        color: '#10B981',
        label: '낮음',
      };
    default:
      return {
        bg: 'rgba(156, 163, 175, 0.1)',
        color: '#6B7280',
        label: '알 수 없음',
      };
  }
};

/**
 * 전화번호 포맷팅 함수
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }

  return phone;
};

/**
 * 사업자번호 포맷팅 함수
 */
export const formatBusinessNumber = (businessNumber: string): string => {
  const cleaned = businessNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3');
  }

  return businessNumber;
};

/**
 * 숫자를 천 단위로 콤마 구분
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

/**
 * 백분율 포맷팅
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 문자열을 특정 길이로 자르고 ...을 추가
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * 안전한 문자열 비교 (null/undefined 처리)
 */
export const safeStringCompare = (a: string | null | undefined, b: string | null | undefined): boolean => {
  return (a || '').toLowerCase() === (b || '').toLowerCase();
};

/**
 * 검색어 하이라이트 함수
 */
export const highlightText = (text: string, query: string): string => {
  if (!query) return text;

  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>');
};
