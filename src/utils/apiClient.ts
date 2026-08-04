// 순환 의존성 방지: 모듈 최상단 import 대신 함수 내부에서 동적 require
// (permissionStore → apiClient → authStore → permissionStore 순환 방지)
let _getAuthState: (() => { token: string | null; logout: () => void; updateToken: (t: string) => void }) | null = null;

export const setAuthStateGetter = (
  getter: () => { token: string | null; logout: () => void; updateToken: (t: string) => void }
) => {
  _getAuthState = getter;
};

const getAuthState = () => {
  if (!_getAuthState) {
    throw new Error('[apiClient] Auth state getter not initialized. Ensure authStore is imported before making API calls.');
  }
  return _getAuthState();
};

interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * API 요청을 처리하는 중앙 집중식 클라이언트
 * - 자동으로 Authorization 헤더 추가
 * - 401 응답 시 자동 로그아웃
 * - 에러 처리 표준화
 */
export const apiClient = async (
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> => {
  const { skipAuth = false, headers = {}, ...restOptions } = options;

  // 인증 토큰 추가 (동적 접근으로 순환 의존성 방지)
  const token = getAuthState().token;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
    });

    // 401 Unauthorized - 토큰 만료 또는 유효하지 않음
    if (response.status === 401) {

      // 로그아웃 처리
      getAuthState().logout();

      // 로그인 페이지로 리다이렉트
      window.location.href = '/login';

      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }

    // 403 Forbidden - 권한 없음
    if (response.status === 403) {
      throw new Error('접근 권한이 없습니다.');
    }

    // 응답 헤더에 갱신된 토큰이 있으면 즉시 교체 (매 요청마다 세션 연장)
    if (!skipAuth) {
      const refreshedToken = response.headers.get('Authorization');
      if (refreshedToken && refreshedToken.startsWith('Bearer ')) {
        const newToken = refreshedToken.slice(7);
        const currentToken = getAuthState().token;
        if (newToken && newToken !== currentToken) {
          getAuthState().updateToken(newToken);
        }
      }
    }

    return response;
  } catch (error) {
    // 네트워크 오류 등
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('API 요청 중 오류가 발생했습니다.');
  }
};

/**
 * GET 요청 헬퍼
 */
export const apiGet = async (url: string, options?: ApiRequestOptions) => {
  const response = await apiClient(url, { ...options, method: 'GET' });
  return response;
};

/**
 * POST 요청 헬퍼
 */
export const apiPost = async (
  url: string,
  data?: any,
  options?: ApiRequestOptions
) => {
  const response = await apiClient(url, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response;
};

/**
 * PUT 요청 헬퍼
 */
export const apiPut = async (
  url: string,
  data?: any,
  options?: ApiRequestOptions
) => {
  const response = await apiClient(url, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response;
};

/**
 * DELETE 요청 헬퍼
 */
export const apiDelete = async (url: string, options?: ApiRequestOptions) => {
  const response = await apiClient(url, { ...options, method: 'DELETE' });
  return response;
};
