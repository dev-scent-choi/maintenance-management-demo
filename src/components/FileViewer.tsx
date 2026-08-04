import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Download, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelEditor from './ExcelEditor';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { themeConfigs } from '../utils/themeConfig';
import { normalizeFileUrl } from '../config';
import { useLanguage } from '../contexts/LanguageContext';

interface FileViewerProps {
  fileUrl: string;
  filename: string;
  onClose?: () => void;
}

// 지원되는 파일 형식 확인
const getSupportedFileType = (filename: string): 'excel' | 'image' | 'pdf' | 'text' | 'dwg' | 'docx' | 'ppt' | 'unsupported' => {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.xlsm') || ext.endsWith('.xlsb')) {
    return 'excel';
  }
  if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.bmp') || ext.endsWith('.webp') || ext.endsWith('.tif') || ext.endsWith('.tiff') || ext.endsWith('.ico')) {
    return 'image';
  }
  if (ext.endsWith('.pdf')) {
    return 'pdf';
  }
  if (ext.endsWith('.txt') || ext.endsWith('.log') || ext.endsWith('.md') || ext.endsWith('.html') || ext.endsWith('.htm') || ext.endsWith('.jsp')) {
    return 'text';
  }
  if (ext.endsWith('.dwg') || ext.endsWith('.dxf')) {
    return 'dwg';
  }
  if (ext.endsWith('.doc') || ext.endsWith('.docx')) {
    return 'docx';
  }
  if (ext.endsWith('.ppt') || ext.endsWith('.pptx')) {
    return 'ppt';
  }
  return 'unsupported';
};

interface ConversionProgressProps {
  progress: number;
  step: string;
  label: string;
  color: string;
  textSecondary: string;
  text: string;
  isDark: boolean;
}

const ConversionProgress: React.FC<ConversionProgressProps> = React.memo(({ progress, step, label, color, textSecondary, text, isDark }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
    {/* 아이콘 + 제목 */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        backgroundColor: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: text }}>{label}</span>
    </div>

    {/* 진행 바 */}
    <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        width: '100%', height: '6px', borderRadius: '3px',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(progress, 100)}%`,
          height: '100%',
          borderRadius: '3px',
          backgroundColor: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: textSecondary }}>{step}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: color }}>{Math.round(Math.min(progress, 100))}%</span>
      </div>
    </div>

    {progress < 100 && (
      <span style={{ fontSize: '0.6875rem', color: textSecondary, opacity: 0.65 }}>
        처음 변환 시 시간이 걸릴 수 있습니다
      </span>
    )}
  </div>
));

const FileViewer: React.FC<FileViewerProps> = ({ fileUrl: rawFileUrl, filename, onClose }) => {
  // localhost:8080 으로 저장된 URL을 현재 접속 서버 주소로 교정 (배포 환경 대응)
  const fileUrl = normalizeFileUrl(rawFileUrl);
  const fileType = getSupportedFileType(filename);
  const theme = useSettingsStore(state => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const authToken = useAuthStore(state => state.token);
  const t = useLanguage();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [textContent, setTextContent] = useState<string>('');
  const [isLoadingText, setIsLoadingText] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [isDocxLoading, setIsDocxLoading] = useState(true);
  const [isDwgLoading, setIsDwgLoading] = useState(fileType === 'dwg');
  const [dwgViewerError, setDwgViewerError] = useState<string>('');
  const [dwgImageUrl, setDwgImageUrl] = useState<string>('');
  const [isPptLoading, setIsPptLoading] = useState(fileType === 'ppt');
  const [pptPdfBlobUrl, setPptPdfBlobUrl] = useState<string>('');
  const [pptError, setPptError] = useState<string>('');
  // 변환 진행 상태
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStep, setPdfStep] = useState('');
  const [pptProgress, setPptProgress] = useState(0);
  const [pptStep, setPptStep] = useState('');
  const [dwgProgress, setDwgProgress] = useState(0);
  const [dwgStep, setDwgStep] = useState('');
  const [docxProgress, setDocxProgress] = useState(0);
  const [docxStep, setDocxStep] = useState('');
  const [dwgFitZoom, setDwgFitZoom] = useState(100);
  // 변환 캐시 다이얼로그 (PPT)
  const [showPptCacheDialog, setShowPptCacheDialog] = useState(false);
  const [pptCachedPdfUrl, setPptCachedPdfUrl] = useState('');
  const pptForceRef = useRef(false);
  const [pptEffectKey, setPptEffectKey] = useState(0);
  // 변환 캐시 다이얼로그 (DWG)
  const [showDwgCacheDialog, setShowDwgCacheDialog] = useState(false);
  const [dwgCachedImageUrl, setDwgCachedImageUrl] = useState('');
  const dwgForceRef = useRef(false);
  const [dwgEffectKey, setDwgEffectKey] = useState(0);
  const pdfTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dwgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docxTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const dwgViewerRef = useRef<HTMLDivElement>(null);
  const dwgImgRef = useRef<HTMLImageElement>(null);
  const dwgPanContainerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    try {
      // Fetch를 사용하여 파일을 Blob으로 가져오기
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('파일 다운로드 실패');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Blob URL을 사용하여 다운로드
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename; // 원본 파일명 사용
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Blob URL 해제
      window.URL.revokeObjectURL(blobUrl);

      toast.success('파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('파일 다운로드에 실패했습니다.');
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 500));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 10));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(fileType === 'dwg' ? dwgFitZoom : 100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // DWG 이미지 로드 후 컨테이너에 맞는 초기 줌 계산
  const handleDwgImageLoad = () => {
    const img = dwgImgRef.current;
    const container = dwgPanContainerRef.current;
    if (!img || !container) return;
    const padding = 32;
    const containerW = container.clientWidth - padding;
    const containerH = container.clientHeight - padding;
    const fitScale = Math.floor(Math.min(containerW / img.naturalWidth, containerH / img.naturalHeight) * 100);
    setZoom(fitScale);
    setDwgFitZoom(fitScale);
    setPosition({ x: 0, y: 0 });
  };

  // 마우스 휠로 확대/축소
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (fileType === 'dwg') {
      const factor = e.deltaY > 0 ? 0.88 : 1.12;
      const newZoom = Math.max(10, Math.min(500, zoom * factor));
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cW = rect.width;
      const cH = rect.height;
      const ratio = newZoom / zoom;
      setPosition(prev => ({
        x: (mx - cW / 2) * (1 - ratio) + prev.x * ratio,
        y: (my - cH / 2) * (1 - ratio) + prev.y * ratio,
      }));
      setZoom(Math.round(newZoom));
    } else {
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoom(prev => Math.max(25, Math.min(300, prev + delta)));
    }
  };

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // 왼쪽 클릭만
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  // 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // 드래그 종료
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 텍스트 파일 로드
  useEffect(() => {
    if (fileType === 'text') {
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setIsLoadingText(false);
        })
        .catch(error => {
          console.error('Error loading text file:', error);
          toast.error('파일을 불러오는데 실패했습니다.');
          setIsLoadingText(false);
        });
    }
  }, [fileUrl, fileType]);

  // PDF 파일 로드 — embed가 백그라운드에서 직접 스트리밍 로드, blob fetch 불필요
  useEffect(() => {
    if (fileType === 'pdf') {
      setIsPdfLoading(true);
      setPdfProgress(0);
      setPdfStep('PDF 파일 로드 중...');

      // 빠른 진행 애니메이션(실제 로딩은 embed가 직접 처리)
      if (pdfTimerRef.current) clearInterval(pdfTimerRef.current);
      pdfTimerRef.current = setInterval(() => {
        setPdfProgress(prev => {
          if (prev >= 90) { clearInterval(pdfTimerRef.current!); return prev; }
          return prev + 6; // ~1.5s 에 90% 도달
        });
      }, 100);
    }
    return () => { clearInterval(pdfTimerRef.current!); };
  }, [fileUrl, fileType]);

  // DOCX 파일 로드 및 렌더링
  useEffect(() => {
    if (fileType === 'docx') {
      const loadDocx = async () => {
        if (!docxContainerRef.current) return;

        setIsDocxLoading(true);
        setDocxProgress(0);
        setDocxStep('문서 라이브러리 로드 중...');

        if (docxTimerRef.current) clearInterval(docxTimerRef.current);
        docxTimerRef.current = setInterval(() => {
          setDocxProgress(prev => {
            if (prev >= 40) { clearInterval(docxTimerRef.current!); return prev; }
            return prev + 1.2;
          });
        }, 80);

        // 이전 내용 초기화
        docxContainerRef.current.innerHTML = '';

        try {
          // import와 fetch 병렬 실행 — 순차 대기 시간 제거
          const [{ renderAsync }, response] = await Promise.all([
            import('docx-preview'),
            fetch(fileUrl),
          ]);
          clearInterval(docxTimerRef.current!);
          setDocxProgress(60);
          setDocxStep('문서 렌더링 중...');

          const buffer = await response.arrayBuffer();
          setDocxProgress(70);

          // 70→95% 시뮬레이션 (렌더링 대기)
          docxTimerRef.current = setInterval(() => {
            setDocxProgress(prev => {
              if (prev >= 95) { clearInterval(docxTimerRef.current!); return prev; }
              return prev + 1;
            });
          }, 150);

          if (docxContainerRef.current) {
            await renderAsync(buffer, docxContainerRef.current, undefined, {
              className: 'docx-wrapper',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: false,
              trimXmlDeclaration: true,
              useBase64URL: false,
              renderHeaders: true,
              renderFooters: true,
              renderFootnotes: true,
              renderEndnotes: true,
              debug: false,
            });

            clearInterval(docxTimerRef.current!);
            setDocxProgress(100);
            setIsDocxLoading(false);

            setTimeout(() => { window.scrollTo(0, 0); }, 100);
          }
        } catch (error) {
          clearInterval(docxTimerRef.current!);
          console.error('Error loading DOCX file:', error);
          toast.error('DOCX 파일을 불러오는데 실패했습니다.');
          setIsDocxLoading(false);
        }
      };

      loadDocx();
      return () => { clearInterval(docxTimerRef.current!); };
    }
  }, [fileUrl, fileType]);

  // PPT: 캐시된 PDF — blob fetch 없이 직접 URL 사용
  const handleUseCachedPpt = () => {
    setShowPptCacheDialog(false);
    setPptProgress(100);
    setPptPdfBlobUrl(pptCachedPdfUrl);
    setIsPptLoading(false);
  };

  // PPT: 강제 재변환
  const handlePptReconvert = () => {
    setShowPptCacheDialog(false);
    pptForceRef.current = true;
    setPptEffectKey(k => k + 1);
  };

  // PPT/PPTX → PDF 변환
  useEffect(() => {
    if (fileType === 'ppt') {
      const force = pptForceRef.current;
      pptForceRef.current = false;

      setIsPptLoading(true);
      setPptPdfBlobUrl('');
      setPptError('');
      setShowPptCacheDialog(false);
      setPptProgress(0);
      setPptStep('서버에 변환 요청 중...');

      if (pptTimerRef.current) clearInterval(pptTimerRef.current);
      pptTimerRef.current = setInterval(() => {
        setPptProgress(prev => {
          if (prev >= 60) { clearInterval(pptTimerRef.current!); return prev; }
          return prev + 1.2;
        });
      }, 200);

      fetch(import.meta.env.VITE_API_URL + '/ppt/convert-to-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ fileUrl, force: force ? 'true' : 'false' }),
      })
        .then(async res => {
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`변환 실패 (${res.status}): ${errText}`);
          }
          const data = await res.json();
          if (!data.pdfUrl) throw new Error('PDF URL 없음');
          clearInterval(pptTimerRef.current!);

          // 기존 변환 파일 존재 → 다이얼로그 표시
          if (data.fromCache) {
            setPptCachedPdfUrl(import.meta.env.VITE_API_URL + data.pdfUrl);
            setShowPptCacheDialog(true);
            setIsPptLoading(false);
            return;
          }

          // blob fetch 없이 직접 URL — embed가 스트리밍 로드
          setPptProgress(100);
          setPptStep('뷰어 준비 중...');
          setPptPdfBlobUrl(import.meta.env.VITE_API_URL + data.pdfUrl);
          setIsPptLoading(false);
        })
        .catch(err => {
          clearInterval(pptTimerRef.current!);
          console.error('[FileViewer] PPT conversion error:', err);
          setPptError('PPT 파일을 PDF로 변환하는데 실패했습니다.');
          setIsPptLoading(false);
        });

      return () => {
        clearInterval(pptTimerRef.current!);
        if (pptPdfBlobUrl) URL.revokeObjectURL(pptPdfBlobUrl);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileType, filename, pptEffectKey]);

  // DWG: 캐시된 이미지 직접 로드
  const handleUseCachedDwg = () => {
    setShowDwgCacheDialog(false);
    setDwgImageUrl(dwgCachedImageUrl);
    setIsDwgLoading(false);
  };

  // DWG: 강제 재변환
  const handleDwgReconvert = () => {
    setShowDwgCacheDialog(false);
    dwgForceRef.current = true;
    setDwgEffectKey(k => k + 1);
  };

  // DWG/DXF 파일 로드 및 Three.js 뷰어 초기화
  useEffect(() => {
    if (fileType === 'dwg') {
      const loadDxfViewer = async () => {
        const force = dwgForceRef.current;
        dwgForceRef.current = false;

        setIsDwgLoading(true);
        setDwgViewerError('');
        setDwgImageUrl('');
        setShowDwgCacheDialog(false);
        setDwgProgress(0);
        setDwgStep('서버에 변환 요청 중...');

        if (dwgTimerRef.current) clearInterval(dwgTimerRef.current);
        dwgTimerRef.current = setInterval(() => {
          setDwgProgress(prev => {
            if (prev >= 65) { clearInterval(dwgTimerRef.current!); return prev; }
            return prev + 1.6;
          });
        }, 200);

        try {
          // DWG 파일은 백엔드에서 이미지로 변환
          if (filename.toLowerCase().endsWith('.dwg')) {

            try {
              const response = await fetch(import.meta.env.VITE_API_URL + '/dwg/convert-to-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileUrl, force: force ? 'true' : 'false' }),
              });

              if (!response.ok) {
                throw new Error('DWG 변환 요청 실패');
              }

              const data = await response.json();

              if (data.imageUrl) {
                clearInterval(dwgTimerRef.current!);
                const fullImageUrl = import.meta.env.VITE_API_URL + data.imageUrl;

                // 기존 변환 파일 존재 → 다이얼로그 표시
                if (data.fromCache) {
                  setDwgCachedImageUrl(fullImageUrl);
                  setShowDwgCacheDialog(true);
                  setIsDwgLoading(false);
                  return;
                }

                setDwgProgress(90);
                setDwgStep('이미지 렌더링 중...');
                setDwgImageUrl(fullImageUrl);
                setTimeout(() => { setDwgProgress(100); setIsDwgLoading(false); }, 300);
                return;
              } else {
                throw new Error('이미지 URL을 받지 못했습니다.');
              }
            } catch (error) {
              clearInterval(dwgTimerRef.current!);
              console.error('[FileViewer] DWG conversion failed:', error);
              setDwgViewerError('DWG 파일 변환에 실패했습니다.');
              setIsDwgLoading(false);
              return;
            }
          }

          // DXF 파일은 Three.js로 렌더링
          if (!dwgViewerRef.current) {
            setDwgViewerError('뷰어 컨테이너를 찾을 수 없습니다.');
            setIsDwgLoading(false);
            return;
          }

          // DXF 파일 렌더링
          const container = dwgViewerRef.current;
          setDwgStep('Three.js 렌더러 로드 중...');

          // Three.js 장면 설정
          const [THREE, { DXFLoader }] = await Promise.all([
            import('three'),
            import('three-dxf-loader'),
          ]);

          const scene = new THREE.Scene();
          scene.background = new THREE.Color(themeColors.card);

          // 카메라 설정
          const camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            10000
          );
          camera.position.set(0, 0, 100);

          // 렌더러 설정
          const renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(container.clientWidth, container.clientHeight);
          container.appendChild(renderer.domElement);

          // 조명 추가
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
          scene.add(ambientLight);
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
          directionalLight.position.set(1, 1, 1);
          scene.add(directionalLight);

          // DXF 로더
          const loader = new DXFLoader();

          // DXF 파일 로드
          setDwgStep('DXF 파일 로드 중...');
          setDwgProgress(70);
          loader.load(
            fileUrl,
            (dxf: import('three').Object3D) => {
              scene.add(dxf);
              setDwgProgress(90);
              setDwgStep('도면 렌더링 중...');

              // 객체를 화면 중앙에 배치
              const box = new THREE.Box3().setFromObject(dxf);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              // 카메라 위치 조정
              const maxDim = Math.max(size.x, size.y, size.z);
              const fov = camera.fov * (Math.PI / 180);
              let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
              cameraZ *= 1.5; // 여유 공간

              camera.position.set(center.x, center.y, center.z + cameraZ);
              camera.lookAt(center);

              clearInterval(dwgTimerRef.current!);
              setDwgProgress(100);
              setIsDwgLoading(false);

              // 애니메이션 루프
              const animate = () => {
                requestAnimationFrame(animate);
                renderer.render(scene, camera);
              };
              animate();
            },
            undefined,
            (error: Error) => {
              clearInterval(dwgTimerRef.current!);
              console.error('Error loading DXF file:', error);
              setDwgViewerError('DXF 파일을 불러오는데 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.');
              setIsDwgLoading(false);
            }
          );

          // 창 크기 조정 이벤트
          const handleResize = () => {
            if (container) {
              camera.aspect = container.clientWidth / container.clientHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(container.clientWidth, container.clientHeight);
            }
          };
          window.addEventListener('resize', handleResize);

          // 클린업
          return () => {
            window.removeEventListener('resize', handleResize);
            if (container && container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
            renderer.dispose();
          };

        } catch (error) {
          clearInterval(dwgTimerRef.current!);
          console.error('Error initializing DXF viewer:', error);
          setDwgViewerError('DXF 뷰어를 초기화하는데 실패했습니다.');
          setIsDwgLoading(false);
        }
      };

      loadDxfViewer();
      return () => { clearInterval(dwgTimerRef.current!); };
    }
  }, [fileUrl, fileType, filename, themeColors.card, dwgEffectKey]);

  // Excel 파일은 ExcelEditor 사용
  if (fileType === 'excel') {
    return <ExcelEditor fileUrl={fileUrl} filename={filename} onClose={onClose} readOnly={true} />;
  }

  // 지원하지 않는 파일 형식
  if (fileType === 'unsupported') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[90vw] max-w-md flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold" style={{ color: themeColors.text }}>파일 미리보기 불가</h2>
            {onClose && (
              <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ backgroundColor: themeColors.cardHover }}>
                <X size={20} style={{ color: themeColors.text }} />
              </button>
            )}
          </div>
          <div className="text-center py-8 p-6">
            <div className="mb-4" style={{ color: themeColors.textSecondary }}>이 파일 형식은 미리보기를 지원하지 않습니다.</div>
            <div className="text-sm mb-6" style={{ color: themeColors.textSecondary }}>{ filename}</div>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
              style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
            >
              <Download size={18} />
              <span>다운로드</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // 이미지 파일
  if (fileType === 'image') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleZoomOut} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="축소">
                <ZoomOut size={18} />
              </button>
              <span className="text-sm min-w-[60px] text-center" style={{ color: themeColors.textSecondary }}>{zoom}%</span>
              <button onClick={handleZoomIn} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="확대">
                <ZoomIn size={18} />
              </button>
              <button onClick={handleRotate} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="회전">
                <RotateCw size={18} />
              </button>
              <button onClick={handleReset} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }}>
                초기화
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
              >
                {t('download')}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded transition-colors"
                  style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          <div
            ref={imageContainerRef}
            className="flex-1 overflow-hidden p-4 flex items-center justify-center"
            style={{ backgroundColor: themeColors.card, cursor: isDragging ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={fileUrl}
              alt={filename}
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                userSelect: 'none'
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // PDF 파일
  if (fileType === 'pdf') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
              >
                {t('download')}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded transition-colors"
                  style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: themeColors.card }}>
            {/* embed는 오버레이 뒤에서 즉시 스트리밍 로드 — blob fetch 없음 */}
            <embed
              src={fileUrl}
              type="application/pdf"
              className="absolute inset-0 w-full h-full"
              title="PDF Viewer"
              onLoad={() => { clearInterval(pdfTimerRef.current!); setPdfProgress(100); setIsPdfLoading(false); }}
            />
            {isPdfLoading && (
              <div className="absolute inset-0 z-10" style={{ backgroundColor: themeColors.card }}>
                <ConversionProgress
                  progress={pdfProgress}
                  step={pdfStep}
                  label="PDF 불러오는 중"
                  color={themeColors.primary}
                  textSecondary={themeColors.textSecondary}
                  text={themeColors.text}
                  isDark={theme !== 'light'}
                />
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // PPT/PPTX 파일 (PDF 변환 후 표시)
  if (fileType === 'ppt') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleDownload} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}>
                다운로드
              </button>
              {onClose && (
                <button onClick={onClose} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}>
                  닫기
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: themeColors.card }}>
            {showPptCacheDialog && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  backgroundColor: `${themeColors.primary}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={themeColors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: themeColors.text, marginBottom: '6px' }}>변환된 파일이 이미 존재합니다</div>
                  <div style={{ fontSize: '0.8125rem', color: themeColors.textSecondary }}>기존 변환 파일을 바로 보시겠습니까?</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleUseCachedPpt}
                    style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600, backgroundColor: themeColors.primary, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    바로 보기
                  </button>
                  <button
                    onClick={handlePptReconvert}
                    style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, backgroundColor: themeColors.cardHover, color: themeColors.text, border: `1px solid ${themeColors.border}`, cursor: 'pointer' }}
                  >
                    재변환
                  </button>
                </div>
              </div>
            )}
            {!showPptCacheDialog && isPptLoading && (
              <ConversionProgress
                progress={pptProgress}
                step={pptStep}
                label="PPT → PDF 변환 중"
                color={themeColors.primary}
                textSecondary={themeColors.textSecondary}
                text={themeColors.text}
                isDark={theme !== 'light'}
              />
            )}
            {pptError && (
              <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                <div style={{ color: themeColors.text, fontSize: '0.9rem', fontWeight: 600 }}>미리보기를 사용할 수 없습니다</div>
                <div style={{ color: themeColors.textSecondary, fontSize: '0.8125rem' }}>{pptError}</div>
                <button onClick={handleDownload} className="inline-flex items-center gap-2 px-5 py-2.5 rounded transition-colors" style={{ backgroundColor: themeColors.primary, color: '#fff' }}>
                  <Download size={16} /> 파일 다운로드
                </button>
              </div>
            )}
            {!isPptLoading && !pptError && pptPdfBlobUrl && (
              <embed src={pptPdfBlobUrl} type="application/pdf" className="w-full h-full" title="PPT Preview" />
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // DWG/DXF 파일 (CAD 도면)
  if (fileType === 'dwg') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isDwgLoading && !dwgViewerError && dwgImageUrl && (
                <>
                  <button onClick={handleZoomOut} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="축소">
                    <ZoomOut size={18} />
                  </button>
                  <span className="text-sm min-w-[60px] text-center" style={{ color: themeColors.textSecondary }}>{zoom}%</span>
                  <button onClick={handleZoomIn} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="확대">
                    <ZoomIn size={18} />
                  </button>
                  <button onClick={handleRotate} className="p-2 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }} title="회전">
                    <RotateCw size={18} />
                  </button>
                  <button onClick={handleReset} className="px-3 py-1.5 rounded transition-colors" style={{ backgroundColor: themeColors.card, color: themeColors.text }}>
                    초기화
                  </button>
                </>
              )}
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
              >
                {t('download')}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded transition-colors"
                  style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: themeColors.card }}>
            {showDwgCacheDialog && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  backgroundColor: `${themeColors.primary}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={themeColors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: themeColors.text, marginBottom: '6px' }}>변환된 파일이 이미 존재합니다</div>
                  <div style={{ fontSize: '0.8125rem', color: themeColors.textSecondary }}>기존 변환 이미지를 바로 보시겠습니까?</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleUseCachedDwg}
                    style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600, backgroundColor: themeColors.primary, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    바로 보기
                  </button>
                  <button
                    onClick={handleDwgReconvert}
                    style={{ padding: '8px 20px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 500, backgroundColor: themeColors.cardHover, color: themeColors.text, border: `1px solid ${themeColors.border}`, cursor: 'pointer' }}
                  >
                    재변환
                  </button>
                </div>
              </div>
            )}
            {!showDwgCacheDialog && isDwgLoading && !dwgViewerError && (
              <ConversionProgress
                progress={dwgProgress}
                step={dwgStep}
                label={filename.toLowerCase().endsWith('.dwg') ? t('dwgConverting') : t('dxfLoading')}
                color={themeColors.primary}
                textSecondary={themeColors.textSecondary}
                text={themeColors.text}
                isDark={theme !== 'light'}
              />
            )}
            {dwgViewerError && (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center max-w-2xl">
                  <div className="mb-4 text-lg font-semibold" style={{ color: themeColors.text }}>{t('cadFileTitle')}</div>
                  <div className="text-sm mb-6" style={{ color: themeColors.textSecondary }}>{filename}</div>
                  <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: themeColors.background, color: themeColors.textSecondary }}>
                    <div className="mb-3 text-base" style={{ color: themeColors.text }}>{dwgViewerError}</div>
                    <div className="text-sm">{t('cadDownloadHint')}</div>
                  </div>
                  <div className="flex flex-col gap-3 items-center">
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors hover:opacity-90"
                      style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
                    >
                      <Download size={18} />
                      <span>{t('cadDownloadOriginal')}</span>
                    </button>
                    <div className="text-xs" style={{ color: themeColors.textSecondary }}>{t('cadRecommendedPrograms')}</div>
                  </div>
                </div>
              </div>
            )}
            {!isDwgLoading && !dwgViewerError && dwgImageUrl && (
              <div
                ref={dwgPanContainerRef}
                className="w-full h-full overflow-hidden p-4 flex items-center justify-center"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={dwgImgRef}
                  src={dwgImageUrl}
                  alt={filename}
                  draggable={false}
                  onLoad={handleDwgImageLoad}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    userSelect: 'none',
                    display: 'block',
                  }}
                />
              </div>
            )}
            {!isDwgLoading && !dwgViewerError && !dwgImageUrl && (
              <div
                ref={dwgViewerRef}
                className="w-full h-full"
                style={{ backgroundColor: themeColors.card }}
              />
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // 텍스트 파일
  if (fileType === 'text') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
              >
                {t('download')}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded transition-colors"
                  style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: themeColors.card }}>
            {isLoadingText ? (
              <div className="flex items-center justify-center h-full">
                <div style={{ color: themeColors.textSecondary }}>{t('loadingFile')}</div>
              </div>
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-mono" style={{ color: themeColors.text }}>{textContent}</pre>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // DOCX/DOC 파일 (Word 문서)
  if (fileType === 'docx') {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}>
        <div className="rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col" style={{ backgroundColor: themeColors.background }}>
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: themeColors.border }}>
            <h2 className="text-lg font-semibold truncate flex-1 mr-4" style={{ color: themeColors.text }}>{filename}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded transition-colors"
                style={{ backgroundColor: themeColors.primary, color: '#ffffff' }}
              >
                {t('download')}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded transition-colors"
                  style={{ backgroundColor: themeColors.cardHover, color: themeColors.text }}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 relative" style={{ backgroundColor: themeColors.card }}>
            {isDocxLoading && (
              <div className="absolute inset-0 z-10" style={{ backgroundColor: themeColors.card }}>
                <ConversionProgress
                  progress={docxProgress}
                  step={docxStep}
                  label={t('wordConverting')}
                  color={themeColors.primary}
                  textSecondary={themeColors.textSecondary}
                  text={themeColors.text}
                  isDark={theme !== 'light'}
                />
              </div>
            )}
            <div
              ref={docxContainerRef}
              className="docx-viewer-container bg-white p-6 mx-auto shadow-sm"
              style={{
                width: '100%',
                maxWidth: '1200px',
                minHeight: '100%'
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return null;
};

export default FileViewer;
