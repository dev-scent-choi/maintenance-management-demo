import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config';

// 로컬 스토리지에서 토큰 가져오기
const getAuthToken = () => {
  const authStore = localStorage.getItem('auth-storage');
  if (authStore) {
    try {
      const parsed = JSON.parse(authStore);
      return parsed.state?.token;
    } catch (error) {
      console.error('Failed to parse auth token:', error);
      return null;
    }
  }
  return null;
};

// 401 에러 처리 - 세션 만료 시 로그아웃
const handleUnauthorized = () => {

  // 로그아웃 처리
  useAuthStore.getState().logout();

  // 로그인 페이지로 리다이렉트
  window.location.href = '/login';
};

// 공통 헤더 생성
const getHeaders = (includeAuth = true) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

export const api = {
  get: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  post: async <T = unknown>(endpoint: string, data: T, includeAuth = true) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(includeAuth),
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  put: async <T = unknown>(endpoint: string, data: T) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
};