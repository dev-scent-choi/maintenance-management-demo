// API 기본 URL — .env.production의 VITE_API_URL 값을 사용
// 개발: http://localhost:8080/api (vite.config.ts proxy가 /api → localhost:8080 중계)
// 운영: VITE_API_URL 환경변수 값 (예: /api 또는 http://서버IP:8080/api)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * DB에 저장된 fileUrl의 localhost:8080 을 현재 접속 서버 기준으로 교정.
 *
 * 배포 환경에서 file.base-url=http://localhost:8080/api 로 인해
 * 파일 URL이 http://localhost:8080/api/uploads/... 형태로 저장됨.
 * 브라우저에서 이 URL을 직접 fetch하면 서버가 아닌 클라이언트 PC의 8080으로 요청해서 실패.
 *
 * 이 함수는 localhost:8080 부분을 현재 접속 중인 origin(Nginx 주소)으로 대체한다.
 */
export function normalizeFileUrl(url: string): string {
  if (!url) return url;
  // 개발환경(localhost:5173)에서는 변환 불필요
  if (typeof window === 'undefined') return url;
  const currentOrigin = window.location.origin; // e.g. http://your-server-domain:30443
  // localhost:8080 또는 127.0.0.1:8080 패턴을 현재 origin + /api 경로로 대체
  // http://localhost:8080/api/uploads/... → http://vdi.../api/uploads/...
  return url
    .replace(/^http:\/\/localhost:8080\/api/, currentOrigin + '/api')
    .replace(/^http:\/\/127\.0\.0\.1:8080\/api/, currentOrigin + '/api');
}
