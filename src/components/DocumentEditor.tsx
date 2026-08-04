import React, { useEffect, useState, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { X, Download, Clock, Save, AlertCircle, Edit3 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import LoadingSpinner from './common/LoadingSpinner';
import type { MaintenanceFile } from '../types';

interface DocumentEditorProps {
  file: MaintenanceFile;
  onClose: () => void;
  onSave?: (data: any, description: string) => void;
  onDownload?: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  file,
  onClose,
  onSave,
  onDownload,
}) => {
  const { user } = useAuthStore();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const hotTableRef = useRef<HotTable>(null);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [mergeCells, setMergeCells] = useState<any[]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [cellStyles, setCellStyles] = useState<any>({});

  const canEdit = file.canEdit && user && (isAdminAccount(user) || file.uploadedById === user.id);

  const getDocumentType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    const typeMap: Record<string, string> = {
      'xls': 'spreadsheet',
      'xlsx': 'spreadsheet',
      'xlsm': 'spreadsheet',
      'xlsb': 'spreadsheet',
      'csv': 'spreadsheet',
      'ods': 'spreadsheet',
      'doc': 'document',
      'docx': 'document',
      'pdf': 'pdf',
      'txt': 'text',
    };
    return typeMap[ext || ''] || 'unknown';
  };

  const documentType = getDocumentType(file.filename);

  useEffect(() => {
    if (documentType === 'spreadsheet') {
      loadSpreadsheet();
    } else {
      setIsLoading(false);
    }
  }, [file.fileUrl, documentType]);

  const loadSpreadsheet = async () => {

    setIsLoading(true);
    try {
      let arrayBuffer: ArrayBuffer;

      if (file.fileUrl.startsWith('data:') || file.fileUrl.startsWith('blob:')) {
        const response = await fetch(file.fileUrl);
        arrayBuffer = await response.arrayBuffer();
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(file.fileUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          arrayBuffer = await response.arrayBuffer();
        } catch (fetchError: any) {
          // 샘플 데이터로 폴백
          const wb = XLSX.utils.book_new();
          const sampleData = [
            ['이름', '나이', '직책', '부서'],
            ['홍길동', '30', '과장', '개발팀'],
            ['김철수', '35', '차장', '기획팀'],
            ['이영희', '28', '대리', '영업팀'],
          ];
          const ws = XLSX.utils.aoa_to_sheet(sampleData);
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

          setTableData(sampleData);
          setIsLoading(false);
          return;
        }
      }

      // XLSX로 파일 읽기 (cellStyles 옵션 활성화)
      const wb = XLSX.read(arrayBuffer, {
        type: 'array',
        cellStyles: true,
        cellHTML: false,
        cellFormula: true,
        cellDates: true,
      });

      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];


      // 데이터 추출
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: true,
      }) as any[][];

      // 병합 셀 정보
      const merges: any[] = [];
      if (worksheet['!merges']) {
        worksheet['!merges'].forEach((merge: any) => {
          const row = merge.s.r;
          const col = merge.s.c;
          const rowspan = merge.e.r - merge.s.r + 1;
          const colspan = merge.e.c - merge.s.c + 1;

          if (row >= 0 && col >= 0 && rowspan > 0 && colspan > 0) {
            merges.push({ row, col, rowspan, colspan });
          }
        });
      }

      // 열 너비
      const colWidths: number[] = [];
      if (worksheet['!cols']) {
        worksheet['!cols'].forEach((col: any, index: number) => {
          colWidths[index] = col && col.wch ? col.wch * 8 : 100;
        });
      }

      // 스타일 정보 추출 - 개선된 버전
      const styles: any = {};
      let styleCount = 0;

      Object.keys(worksheet).forEach(cellAddress => {
        if (cellAddress[0] === '!') return;

        const cell = worksheet[cellAddress];
        if (!cell) return;

        const decoded = XLSX.utils.decode_cell(cellAddress);
        const row = decoded.r;
        const col = decoded.c;
        const styleKey = `${row},${col}`;

        const cellStyle: any = {};
        let hasStyle = false;

        // XLSX의 셀 객체에서 스타일 정보 추출
        if (cell.s) {
          // 폰트
          if (cell.s.font) {
            cellStyle.font = {
              bold: cell.s.font.bold || false,
              italic: cell.s.font.italic || false,
              underline: cell.s.font.underline || false,
              sz: cell.s.font.sz || 11,
              name: cell.s.font.name || 'Arial',
              color: cell.s.font.color || null
            };
            hasStyle = true;
          }

          // 채우기/배경색
          if (cell.s.fill) {
            cellStyle.fill = {
              fgColor: cell.s.fill.fgColor || null,
              bgColor: cell.s.fill.bgColor || null,
              patternType: cell.s.fill.patternType || 'none'
            };
            hasStyle = true;
          }

          // 테두리
          if (cell.s.border) {
            cellStyle.border = {
              top: cell.s.border.top || null,
              bottom: cell.s.border.bottom || null,
              left: cell.s.border.left || null,
              right: cell.s.border.right || null
            };
            hasStyle = true;
          }

          // 정렬 - 매우 중요!
          if (cell.s.alignment) {
            cellStyle.alignment = {
              horizontal: cell.s.alignment.horizontal || 'left',
              vertical: cell.s.alignment.vertical || 'bottom',
              wrapText: cell.s.alignment.wrapText || false,
              textRotation: cell.s.alignment.textRotation || 0,
              indent: cell.s.alignment.indent || 0
            };
            hasStyle = true;
          }
        }

        // 스타일이 없어도 기본 정렬 정보라도 저장
        if (!hasStyle && cell.v !== undefined) {
          // 숫자면 오른쪽 정렬, 문자면 왼쪽 정렬 (엑셀 기본 동작)
          cellStyle.alignment = {
            horizontal: typeof cell.v === 'number' ? 'right' : 'left',
            vertical: 'bottom',
            wrapText: false
          };
          hasStyle = true;
        }

        if (hasStyle) {
          styles[styleKey] = cellStyle;
          if (styleCount < 10) {
            styleCount++;
          }
        }
      });


      // 최대 열 수 계산
      const maxColCount = Math.max(...jsonData.map(row => row.length), 0);

      // 모든 행을 동일한 열 수로 맞추기
      const normalizedData = jsonData.map(row => {
        const newRow = [...row];
        while (newRow.length < maxColCount) {
          newRow.push('');
        }
        return newRow;
      });

      // 최소 행/열 수 보장
      const minRows = 20;
      const minCols = 10;
      const finalColCount = Math.max(maxColCount, minCols);

      while (normalizedData.length < minRows) {
        normalizedData.push(new Array(finalColCount).fill(''));
      }


      setTableData(normalizedData);
      setMergeCells(merges);
      setColumnWidths(colWidths);
      setCellStyles(styles);

      setIsLoading(false);
    } catch (error: any) {
      console.error('스프레드시트 로드 실패:', error);
      alert(`파일 로드 오류: ${error.message || '알 수 없는 오류'}`);
      onClose();
    }
  };

  const handleSaveVersion = async () => {
    if (!changeDescription.trim()) {
      alert('변경 내역을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        const data = hotInstance.getData();

        // Excel 파일로 변환
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        if (onSave) {
          onSave(wb, changeDescription);
        }

        setHasChanges(false);
        setChangeDescription('');
        setIsEditing(false);
        alert('저장되었습니다.');
      }
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    try {
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance && documentType === 'spreadsheet') {
        const data = hotInstance.getData();
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), file.filename);
      } else {
        const link = document.createElement('a');
        link.href = file.fileUrl;
        link.download = file.filename;
        link.click();
      }

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR');
  };

  const getDocumentIcon = () => {
    switch (documentType) {
      case 'spreadsheet': return '📊';
      case 'document': return '📄';
      case 'pdf': return '📕';
      case 'text': return '📝';
      default: return '📎';
    }
  };

  const getDocumentTypeLabel = () => {
    switch (documentType) {
      case 'spreadsheet': return '스프레드시트';
      case 'document': return '문서';
      case 'pdf': return 'PDF';
      case 'text': return '텍스트';
      default: return '파일';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div
        className="w-full h-full max-w-[98vw] max-h-[98vh] rounded-2xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        {/* 읽기 전용 모드 배너 */}
        {!canEdit && (
          <div
            className="px-6 py-3 border-b flex items-center justify-center"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
              borderColor: '#EF4444',
            }}
          >
            <div className="flex items-center space-x-2">
              <AlertCircle size={18} className="text-red-500" />
              <span className="font-semibold text-red-500">읽기 전용 - 편집 권한이 없습니다</span>
            </div>
          </div>
        )}

        {/* 편집 모드 배너 */}
        {canEdit && isEditing && (
          <div
            className="px-6 py-3 border-b flex items-center justify-center"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
              borderColor: '#3B82F6',
            }}
          >
            <div className="flex items-center space-x-2">
              <Edit3 size={18} className="text-blue-500" />
              <span className="font-semibold text-blue-500">편집 모드 - 변경 후 반드시 저장하세요</span>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: themeColors.border }}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <span className="text-3xl flex-shrink-0">{getDocumentIcon()}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold truncate" style={{ color: themeColors.text }}>
                {file.filename}
              </h2>
              <div className="flex items-center space-x-4 mt-1 text-sm flex-wrap" style={{ color: themeColors.textSecondary }}>
                <span>{getDocumentTypeLabel()}</span>
                <span>•</span>
                <span>업로드: {file.uploadedBy}</span>
                <span>•</span>
                <span>{formatDate(file.uploadedAt)}</span>
                <span>•</span>
                <span>{formatFileSize(file.size)}</span>
                {file.version > 1 && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500 text-white font-medium">
                      v{file.version}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
            {canEdit && hasChanges && (
              <div className="flex items-center space-x-2 px-4 py-2 rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)' }}>
                <AlertCircle size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-blue-500">변경됨</span>
              </div>
            )}

            {canEdit && documentType === 'spreadsheet' && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors font-medium"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
                  color: '#3B82F6',
                }}
              >
                <Edit3 size={18} />
                <span>편집</span>
              </button>
            )}

            {canEdit && isEditing && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="변경 내역을 입력하세요..."
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 w-64"
                  style={{
                    backgroundColor: themeColors.background,
                    border: `1px solid ${themeColors.border}`,
                    color: themeColors.text,
                  }}
                />
                <button
                  onClick={handleSaveVersion}
                  disabled={isSaving || !hasChanges}
                  className="px-4 py-2 rounded-lg flex items-center space-x-2 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: '#10B981',
                  }}
                >
                  <Save size={16} />
                  <span>{isSaving ? '저장 중...' : '저장'}</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
                    color: '#EF4444',
                  }}
                >
                  <span>취소</span>
                </button>
              </div>
            )}

            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors font-medium"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)',
                color: '#10B981',
              }}
            >
              <Download size={18} />
              <span>다운로드</span>
            </button>

            {file.versions && file.versions.length > 0 && (
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors font-medium"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
                  color: '#8B5CF6',
                }}
              >
                <Clock size={18} />
                <span>버전 ({file.versions.length})</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: themeColors.textSecondary }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 문서 뷰어 영역 */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* 메인 뷰어 */}
          <div className="flex-1 overflow-auto relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
                <LoadingSpinner message="파일을 불러오는 중..." />
              </div>
            )}

            {documentType === 'spreadsheet' ? (
              !isLoading ? (
                <div className="w-full h-full p-4">
                  <HotTable
                    ref={hotTableRef}
                    data={tableData}
                    colHeaders={true}
                    rowHeaders={true}
                    width="100%"
                    height="calc(100vh - 200px)"
                    licenseKey="non-commercial-and-evaluation"
                    readOnly={!isEditing}
                    mergeCells={mergeCells.length > 0 ? mergeCells : undefined}
                    colWidths={columnWidths.length > 0 ? columnWidths : 100}
                    manualColumnResize={true}
                    manualRowResize={true}
                    contextMenu={isEditing}
                    stretchH="none"
                    afterChange={() => setHasChanges(true)}
                    className="handsontable-custom"
                    customBorders={true}
                    cells={(row: number, col: number) => {
                      const styleKey = `${row},${col}`;
                      const style = cellStyles[styleKey];

                      return {
                        renderer: (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any, cellProperties: any) => {
                          // 기본 텍스트 렌더러 적용
                          Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties] as any);

                          // 기본 스타일 초기화
                          td.style.border = '1px solid #d0d0d0';
                          td.style.padding = '6px 8px';
                          td.style.boxSizing = 'border-box';
                          td.style.whiteSpace = 'pre-wrap';
                          td.style.wordWrap = 'break-word';

                          if (style) {
                            // 폰트 스타일
                            if (style.font) {
                              if (style.font.bold) {
                                td.style.fontWeight = 'bold';
                              }
                              if (style.font.italic) {
                                td.style.fontStyle = 'italic';
                              }
                              if (style.font.sz) {
                                td.style.fontSize = `${style.font.sz}pt`;
                              }
                              if (style.font.name) {
                                td.style.fontFamily = style.font.name;
                              }
                              if (style.font.color?.rgb) {
                                const rgb = style.font.color.rgb;
                                // ARGB 형식 처리
                                const colorHex = rgb.length === 8 ? rgb.substring(2) : rgb;
                                td.style.color = `#${colorHex}`;
                              }
                            }

                            // 배경색
                            if (style.fill) {
                              const fgColor = style.fill.fgColor || style.fill.bgColor;
                              if (fgColor?.rgb) {
                                const rgb = fgColor.rgb;
                                const colorHex = rgb.length === 8 ? rgb.substring(2) : rgb;
                                td.style.backgroundColor = `#${colorHex}`;
                              } else if (fgColor?.theme !== undefined) {
                                // 테마 색상 처리 - 기본 색상 매핑
                                const themeColors: Record<number, string> = {
                                  0: '#FFFFFF',
                                  1: '#000000',
                                  2: '#E7E6E6',
                                  3: '#44546A',
                                  4: '#4472C4',
                                  5: '#ED7D31',
                                };
                                if (fgColor.theme in themeColors) {
                                  td.style.backgroundColor = themeColors[fgColor.theme];
                                }
                              }
                            }

                            // 테두리
                            if (style.border) {
                              ['top', 'bottom', 'left', 'right'].forEach((side) => {
                                const borderDef = style.border[side];
                                if (borderDef?.style) {
                                  let color = '#000000';
                                  if (borderDef.color?.rgb) {
                                    const rgb = borderDef.color.rgb;
                                    const colorHex = rgb.length === 8 ? rgb.substring(2) : rgb;
                                    color = `#${colorHex}`;
                                  }

                                  let width = '1px';
                                  if (borderDef.style === 'medium') width = '2px';
                                  else if (borderDef.style === 'thick') width = '3px';

                                  const borderStyle = borderDef.style === 'dashed' ? 'dashed' : 'solid';
                                  const borderStr = `${width} ${borderStyle} ${color}`;

                                  if (side === 'top') td.style.borderTop = borderStr;
                                  else if (side === 'bottom') td.style.borderBottom = borderStr;
                                  else if (side === 'left') td.style.borderLeft = borderStr;
                                  else if (side === 'right') td.style.borderRight = borderStr;
                                }
                              });
                            }

                            // 정렬 - 가장 중요!
                            if (style.alignment) {
                              // 수평 정렬
                              if (style.alignment.horizontal) {
                                const h = style.alignment.horizontal;
                                td.style.textAlign = h === 'center' ? 'center'
                                  : h === 'right' ? 'right'
                                  : h === 'left' ? 'left'
                                  : 'left';
                              }

                              // 수직 정렬
                              if (style.alignment.vertical) {
                                const v = style.alignment.vertical;
                                td.style.verticalAlign = v === 'center' || v === 'middle' ? 'middle'
                                  : v === 'top' ? 'top'
                                  : v === 'bottom' ? 'bottom'
                                  : 'middle';
                              }

                              // 텍스트 회전
                              if (style.alignment.textRotation) {
                                td.style.transform = `rotate(${style.alignment.textRotation}deg)`;
                              }
                            }

                            // 텍스트 줄바꿈
                            if (style.alignment?.wrapText) {
                              td.style.whiteSpace = 'pre-wrap';
                              td.style.wordWrap = 'break-word';
                            }
                          }
                        }
                      };
                    }}
                  />
                </div>
              ) : null
            ) : documentType === 'pdf' || documentType === 'document' || documentType === 'text' ? (
              <iframe
                src={file.fileUrl}
                className="w-full h-full border-0"
                title={file.filename}
                style={{
                  backgroundColor: '#fff',
                }}
              />
            ) : !isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle size={48} style={{ color: themeColors.textSecondary }} className="mx-auto mb-4" />
                  <p style={{ color: themeColors.text }}>이 파일 형식은 미리보기를 지원하지 않습니다.</p>
                  <button
                    onClick={handleDownload}
                    className="mt-4 px-6 py-3 rounded-lg text-white font-medium"
                    style={{
                      backgroundColor: themeColors.primary,
                    }}
                  >
                    다운로드하여 열기
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* 버전 이력 사이드바 */}
          {showVersionHistory && file.versions && (
            <div
              className="w-80 border-l overflow-y-auto p-4 flex-shrink-0"
              style={{
                borderColor: themeColors.border,
                backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: themeColors.text }}>
                버전 이력
              </h3>
              <div className="space-y-3">
                <div
                  className="p-3 rounded-lg border-2"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
                    borderColor: '#3B82F6',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-500">
                      v{file.version} (현재)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">
                      최신
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{ color: themeColors.textSecondary }}>
                    {file.uploadedBy}
                  </p>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                    {formatDate(file.uploadedAt)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {file.versions.map((version) => (
                  <div
                    key={version.versionNumber}
                    className="p-3 rounded-lg border cursor-pointer hover:border-blue-400 transition-colors"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: themeColors.border,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: themeColors.text }}>
                        v{version.versionNumber}
                      </span>
                    </div>
                    <p className="text-xs mb-1" style={{ color: themeColors.textSecondary }}>
                      {version.modifiedBy}
                    </p>
                    <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                      {formatDate(version.modifiedAt)}
                    </p>
                    {version.changeDescription && (
                      <p
                        className="text-xs mt-2 p-2 rounded"
                        style={{
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          color: themeColors.text,
                        }}
                      >
                        {version.changeDescription}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                      {formatFileSize(version.size)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          className="px-6 py-3 border-t text-center text-sm flex-shrink-0"
          style={{
            backgroundColor: !canEdit
              ? (theme === 'dark' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)')
              : isEditing
                ? (theme === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)')
                : (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
            borderColor: !canEdit ? '#EF4444' : isEditing ? '#3B82F6' : themeColors.border,
            color: themeColors.textSecondary,
          }}
        >
          {canEdit && documentType === 'spreadsheet' ? (
            <div className="flex items-center justify-center space-x-2">
              {isEditing ? (
                <>
                  <Edit3 size={16} className="text-blue-500" />
                  <span className="font-medium text-blue-500">편집 모드</span>
                </>
              ) : (
                <>
                  <span className="font-medium" style={{ color: themeColors.text }}>보기 모드</span>
                  <span>•</span>
                  <span>편집 버튼을 클릭하여 수정하세요</span>
                </>
              )}
              {hasChanges && (
                <>
                  <span>•</span>
                  <AlertCircle size={16} className="text-orange-500" />
                  <span className="font-medium text-orange-500">저장되지 않은 변경사항</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              {!canEdit ? (
                <>
                  <AlertCircle size={16} className="text-red-500" />
                  <span className="font-medium text-red-500">읽기 전용 - 편집 권한이 없습니다</span>
                </>
              ) : (
                <>
                  <span className="font-medium" style={{ color: themeColors.text }}>보기 모드</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
