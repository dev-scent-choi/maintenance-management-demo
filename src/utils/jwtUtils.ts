/**
 * JWT 토큰 디코딩 및 검증 유틸리티
 */

interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: any;
}

/**
 * JWT 토큰을 디코딩하여 페이로드를 반환합니다
 */
export const decodeJWT = (token: string): JWTPayload | null => {
  try {
    // JWT는 header.payload.signature 형식
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    // payload 부분 (두 번째 부분) 디코딩
    const payload = parts[1];

    // Base64 URL 디코딩
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

/**
 * JWT 토큰이 만료되었는지 확인합니다
 * @param token JWT 토큰
 * @returns true: 만료됨, false: 유효함, null: 디코딩 실패
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload) {
    // 디코딩 실패
    return true;
  }

  // exp가 없으면 만료 시간이 설정되지 않은 토큰으로 간주하여 유효한 것으로 처리
  if (!payload.exp) {
    return false;
  }

  // exp는 초 단위, Date.now()는 밀리초 단위
  const currentTime = Math.floor(Date.now() / 1000);
  const isExpired = payload.exp < currentTime;

  return isExpired;
};

/**
 * JWT 토큰이 유효한지 확인합니다 (형식 및 만료 체크)
 */
export const isTokenValid = (token: string | null): boolean => {
  if (!token) {
    return false;
  }

  // 형식 체크
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // 만료 체크
  return !isTokenExpired(token);
};

/**
 * JWT 토큰이 곧 만료될 예정인지 확인합니다
 * @param token JWT 토큰
 * @param thresholdMinutes 임계값 (분 단위, 기본값: 10분)
 * @returns true: 곧 만료됨 (갱신 필요), false: 여유 있음
 */
export const isTokenExpiringSoon = (token: string | null, thresholdMinutes: number = 10): boolean => {
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return false;
  }

  // exp는 초 단위, Date.now()는 밀리초 단위
  const currentTime = Math.floor(Date.now() / 1000);
  const timeUntilExpiration = payload.exp - currentTime;
  const thresholdSeconds = thresholdMinutes * 60;

  return timeUntilExpiration < thresholdSeconds;
};

/**
 * JWT 토큰의 총 유효기간(초)을 반환합니다 (exp - iat)
 * iat가 없으면 1800(30분)을 기본값으로 반환합니다
 */
export const getTokenLifetime = (token: string | null): number => {
  if (!token) return 1800;
  const payload = decodeJWT(token);
  if (!payload || !payload.exp || !payload.iat) return 1800;
  return Math.max(300, payload.exp - payload.iat); // 최소 5분
};

/**
 * JWT 토큰의 남은 시간을 초 단위로 반환합니다
 */
export const getTokenRemainingTime = (token: string | null): number => {
  if (!token) {
    return 0;
  }

  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return 0;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const remainingTime = payload.exp - currentTime;

  return Math.max(0, remainingTime);
};
