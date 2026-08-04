import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 데모/포트폴리오 빌드: 기본적으로 목업 데이터 사용 (VITE_USE_MOCK_DATA=false 로 끌 수 있음)
if (import.meta.env.VITE_USE_MOCK_DATA !== 'false') {
  const { installMockFetch } = await import('./mocks/mockFetch');
  installMockFetch();
}

createRoot(document.getElementById('root')!).render(
  <App />
)
