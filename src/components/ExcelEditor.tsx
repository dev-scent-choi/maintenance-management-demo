import React, { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';

interface ExcelEditorProps {
  fileUrl: string;
  filename: string;
  onClose?: () => void;
  readOnly?: boolean;
}

// 지원되는 파일 형식 확인
const getSupportedFileType = (filename: string): 'excel' | 'image' | 'pdf' | 'unsupported' => {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.xlsm') || ext.endsWith('.xlsb')) {
    return 'excel';
  }
  if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.bmp') || ext.endsWith('.webp')) {
    return 'image';
  }
  if (ext.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'unsupported';
};

const ExcelEditor: React.FC<ExcelEditorProps> = ({ fileUrl, filename, onClose, readOnly }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const containerRef = useRef<HTMLIFrameElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 시트별 HTML 캐시 (시트 인덱스 -> HTML 내용)
  const sheetCache = useRef<Map<number, string>>(new Map());
  const isInitialLoad = useRef(true);

  // 첫 번째 단계: 시트 목록만 먼저 가져오기 (레이아웃 준비)
  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setLoadProgress(0);
    setLoadStep('파일 분석 중...');

    if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    loadTimerRef.current = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 35) { clearInterval(loadTimerRef.current!); return prev; }
        return prev + 1.2;
      });
    }, 80);

    const loadSheets = async () => {
      try {
        const sheetsResponse = await fetch('/api/excel/get-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl }),
        });

        if (!sheetsResponse.ok) {
          throw new Error(`Failed to get sheets: ${sheetsResponse.status}`);
        }

        const sheetsData = await sheetsResponse.json();

        if (!isMounted) return;
        clearInterval(loadTimerRef.current!);
        setLoadProgress(40);
        setLoadStep('시트 목록 로드 완료...');
        setSheets(sheetsData.sheets || []);
      } catch (error) {
        clearInterval(loadTimerRef.current!);
        console.error('[ExcelEditor] Error loading sheets:', error);
        if (isMounted) {
          toast.error('시트 목록을 불러오는데 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
          setIsLoading(false);
        }
      }
    };

    loadSheets();

    return () => {
      isMounted = false;
      clearInterval(loadTimerRef.current!);
    };
  }, [fileUrl]);

  // 두 번째 단계: 시트 목록 로드 후 첫 번째 시트 HTML 가져오기
  useEffect(() => {
    if (sheets.length === 0) return;

    let isMounted = true;

    const loadFirstSheet = async () => {
      try {
        // 캐시 확인
        const cached = sheetCache.current.get(0);
        if (cached) {
          setHtmlContent(cached);
          setIsLoading(false);
          return;
        }

        setLoadProgress(45);
        setLoadStep('엑셀 데이터 변환 중...');

        if (loadTimerRef.current) clearInterval(loadTimerRef.current);
        loadTimerRef.current = setInterval(() => {
          setLoadProgress(prev => {
            if (prev >= 88) { clearInterval(loadTimerRef.current!); return prev; }
            return prev + 0.7;
          });
        }, 100);

        const htmlResponse = await fetch('/api/excel/convert-to-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl, sheetIndex: 0 }),
        });

        if (!htmlResponse.ok) {
          throw new Error(`Failed to convert to HTML: ${htmlResponse.status}`);
        }

        const htmlData = await htmlResponse.json();

        if (!isMounted) return;

        clearInterval(loadTimerRef.current!);
        setLoadProgress(96);
        setLoadStep('화면 렌더링 중...');

        sheetCache.current.set(0, htmlData.html);
        setHtmlContent(htmlData.html);
        setLoadProgress(100);
        setIsLoading(false);
        isInitialLoad.current = false;
      } catch (error) {
        clearInterval(loadTimerRef.current!);
        console.error('[ExcelEditor] Error loading Excel:', error);
        if (isMounted) {
          toast.error('파일을 불러오는데 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
          setIsLoading(false);
        }
      }
    };

    loadFirstSheet();

    return () => {
      isMounted = false;
      clearInterval(loadTimerRef.current!);
    };
  }, [sheets, fileUrl]);

  // 시트 변경 시: 해당 시트의 HTML 가져오기 또는 캐시에서 로드
  useEffect(() => {
    // sheets가 로드되지 않았거나 초기 로드 중이면 대기
    if (sheets.length === 0 || isInitialLoad.current) return;

    let isMounted = true;

    const loadSheetHtml = async () => {
      try {
        // 캐시 확인
        const cached = sheetCache.current.get(activeSheet);
        if (cached) {
          setHtmlContent(cached);
          return;
        }

        setIsLoading(true);
        setLoadProgress(0);
        setLoadStep('시트 데이터 변환 중...');

        if (loadTimerRef.current) clearInterval(loadTimerRef.current);
        loadTimerRef.current = setInterval(() => {
          setLoadProgress(prev => {
            if (prev >= 85) { clearInterval(loadTimerRef.current!); return prev; }
            return prev + 1.2;
          });
        }, 80);

        const response = await fetch('/api/excel/convert-to-html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl, sheetIndex: activeSheet }),
        });

        if (!response.ok) {
          throw new Error(`Failed to convert to HTML: ${response.status}`);
        }

        const data = await response.json();

        if (!isMounted) return;

        clearInterval(loadTimerRef.current!);
        setLoadProgress(100);
        sheetCache.current.set(activeSheet, data.html);
        setHtmlContent(data.html);
        setIsLoading(false);
      } catch (error) {
        clearInterval(loadTimerRef.current!);
        console.error('[ExcelEditor] Error loading sheet:', error);
        if (isMounted) {
          toast.error('시트를 불러오는데 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
          setIsLoading(false);
        }
      }
    };

    loadSheetHtml();

    return () => {
      isMounted = false;
      clearInterval(loadTimerRef.current!);
    };
  }, [activeSheet]);

  const handleDownload = async () => {
    try {
      // 서버에서 파일 가져오기
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      // Blob URL 생성
      const blobUrl = window.URL.createObjectURL(blob);

      // 다운로드 링크 생성
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

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ margin: 0, padding: 0 }}>
      <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <h2 className="text-lg font-semibold text-gray-800">{filename}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
              style={{ fontSize: 'inherit' }}
            >
              다운로드
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600"
                style={{ fontSize: 'inherit' }}
              >
                닫기
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white p-4">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px' }}>
              {/* 아이콘 */}
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Excel 파일 변환 중</span>
              {/* 진행 바 */}
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(loadProgress, 100)}%`, height: '100%', borderRadius: '3px', backgroundColor: '#22C55E', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{loadStep}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22C55E' }}>{Math.round(Math.min(loadProgress, 100))}%</span>
                </div>
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>파일 크기에 따라 시간이 걸릴 수 있습니다</span>
            </div>
          ) : (
            <iframe
              key={`${fileUrl}-${activeSheet}`}
              ref={containerRef}
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              title="Excel Viewer"
            />
          )}
        </div>

        {/* Sheet Tabs - 항상 렌더링하여 레이아웃 변경 방지 */}
        <div className="border-t border-gray-300 bg-gray-100 px-2 py-1 flex items-center gap-1 overflow-x-auto" style={{ minHeight: '42px' }}>
          <div className="flex items-center gap-1">
            {sheets.map((sheetName, index) => (
              <button
                key={index}
                onClick={() => setActiveSheet(index)}
                className={`px-4 py-1.5 text-sm whitespace-nowrap rounded-t border border-b-0 transition-colors ${
                  activeSheet === index
                    ? 'bg-white border-gray-300 text-gray-900 font-medium'
                    : 'bg-gray-50 border-transparent text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  borderBottom: activeSheet === index ? '2px solid white' : 'none',
                  marginBottom: activeSheet === index ? '-1px' : '0',
                }}
              >
                {sheetName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelEditor;
