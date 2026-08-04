import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, FileQuestion } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: themeColors.background }}
    >
      <div className="max-w-md w-full text-center">
        <div
          className="w-32 h-32 rounded-full mx-auto mb-8 flex items-center justify-center"
          style={{ backgroundColor: `${themeColors.primary}15` }}
        >
          <FileQuestion size={80} style={{ color: themeColors.primary }} className="opacity-60" />
        </div>

        <h1
          className="text-6xl font-bold mb-4"
          style={{ color: themeColors.text }}
        >
          404
        </h1>

        <h2
          className="text-2xl font-semibold mb-4"
          style={{ color: themeColors.text }}
        >
          페이지를 찾을 수 없습니다
        </h2>

        <p
          className="text-lg mb-8"
          style={{ color: themeColors.textSecondary }}
        >
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: themeColors.text
            }}
          >
            <ArrowLeft size={20} />
            <span>이전 페이지</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium text-white transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
          >
            <Home size={20} />
            <span>홈으로 가기</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
