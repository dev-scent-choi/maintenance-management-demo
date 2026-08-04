// Kakao Maps SDK 동적 로드 유틸리티

export const loadKakaoMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 이미 로드되어 있는 경우
    if (window.kakao && window.kakao.maps) {
      resolve();
      return;
    }

    // 이미 스크립트 태그가 존재하는지 확인
    const existingScript = document.querySelector(
      'script[src*="dapi.kakao.com"]'
    );

    if (existingScript) {
      // 스크립트가 이미 있다면 로드될 때까지 대기
      const checkInterval = setInterval(() => {
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Kakao Maps 스크립트 로드 타임아웃'));
      }, 10000);
      return;
    }

    // 새로운 스크립트 태그 생성
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_MAP_KEY}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      // autoload=false이므로 명시적으로 로드
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          resolve();
        });
      } else {
        reject(new Error('Kakao Maps SDK 로드 실패'));
      }
    };

    script.onerror = (error) => {
      console.error('Kakao Maps 스크립트 로드 오류:', error);
      reject(new Error('Kakao Maps 스크립트 로드 실패'));
    };

    document.head.appendChild(script);
  });
};
