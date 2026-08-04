import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  address: string;
  width?: string;
  height?: string;
  clickable?: boolean; // 클릭 가능 여부
}

const KakaoMap: React.FC<KakaoMapProps> = ({ address, width = '100%', height = '200px', clickable = true }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!address) {
      return;
    }

    if (!mapContainer.current) {
      return;
    }

    const loadMap = () => {
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        console.error('KakaoMap: Kakao Maps API가 로드되지 않았습니다');
        return;
      }


      try {
        const geocoder = new window.kakao.maps.services.Geocoder();

        // 주소로 좌표를 검색
        geocoder.addressSearch(address, (result: any[], status: any) => {

          if (status === window.kakao.maps.services.Status.OK) {
            const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);

            // 좌표 저장 (카카오맵 링크용)
            setCoordinates({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });

            // 기존 지도가 있으면 재사용, 없으면 새로 생성
            if (!mapInstance.current) {
              const mapOption = {
                center: coords,
                level: 3
              };
              mapInstance.current = new window.kakao.maps.Map(mapContainer.current, mapOption);
            } else {
              mapInstance.current.setCenter(coords);
            }

            // 기존 마커 제거
            if (markerInstance.current) {
              markerInstance.current.setMap(null);
            }

            // 새 마커 생성
            markerInstance.current = new window.kakao.maps.Marker({
              map: mapInstance.current,
              position: coords
            });

            // 인포윈도우 생성
            const infowindow = new window.kakao.maps.InfoWindow({
              content: `<div style="padding:5px 10px;font-size:12px;white-space:nowrap;">${address}</div>`
            });
            infowindow.open(mapInstance.current, markerInstance.current);
          } else {
            console.error('KakaoMap: 주소 검색 실패 - address:', address, 'status:', status);
          }
        });
      } catch (error) {
        console.error('KakaoMap: 지도 로드 중 오류 발생:', error);
      }
    };

    // kakao maps API가 로드되었는지 확인
    if (window.kakao?.maps?.services) {
      loadMap();
    } else {
      // API 로드 대기
      let attempts = 0;
      const maxAttempts = 100; // 10초 대기
      const checkKakao = setInterval(() => {
        attempts++;

        if (window.kakao?.maps?.services) {
          clearInterval(checkKakao);
          loadMap();
        } else if (attempts >= maxAttempts) {
          console.error('KakaoMap: Kakao Maps API 로드 타임아웃');
          clearInterval(checkKakao);
        }
      }, 100);

      return () => clearInterval(checkKakao);
    }
  }, [address]);

  const handleMapClick = () => {
    if (!clickable || !coordinates) return;

    // 카카오맵 앱/웹 링크
    const kakaoMapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(address)},${coordinates.lat},${coordinates.lng}`;
    window.open(kakaoMapUrl, '_blank');
  };

  if (!address) {
    return null;
  }

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        cursor: clickable ? 'pointer' : 'default'
      }}
      onClick={handleMapClick}
      title={clickable ? '클릭하여 카카오맵에서 열기' : ''}
    >
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      {clickable && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            color: '#333',
            pointerEvents: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10
          }}
        >
          🗺️ 지도 보기
        </div>
      )}
    </div>
  );
};

export default KakaoMap;
