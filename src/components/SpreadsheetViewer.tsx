import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { X, Download, Edit3, Save, RotateCcw, Clock, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import LoadingSpinner from './common/LoadingSpinner';
import type { MaintenanceFile, FileVersion } from '../types';

interface SpreadsheetViewerProps {
  file: MaintenanceFile;
  onClose: () => void;
  onSave?: (data: any, description: string) => void;
  onDownload?: () => void;
}

interface SheetData {
  name: string;
  data: any[][];
  cols: XLSX.ColInfo[];
  rows: XLSX.RowInfo[];
  merges?: XLSX.Range[];
}

const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  file,
  onClose,
  onSave,
  onDownload,
}) => {
  const { user } = useAuthStore();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any[][]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 편집 권한 확인
  const canEdit = file.canEdit && user && (isAdminAccount(user) || file.uploadedById === user.id);

  // 파일 로드
  useEffect(() => {
    loadExcelFile();
  }, [file.fileUrl]);

  const loadExcelFile = async () => {
    setIsLoading(true);
    try {
      // Base64 데이터 또는 URL에서 파일 로드
      const response = await fetch(file.fileUrl);
      const arrayBuffer = await response.arrayBuffer();

      // Excel 파일 파싱
      const wb = XLSX.read(arrayBuffer, {
        type: 'array',
        cellStyles: true,
        cellHTML: false,
        cellDates: true,
      });

      setWorkbook(wb);

      // 모든 시트 데이터 추출
      const sheetsData: SheetData[] = wb.SheetNames.map((name) => {
        const worksheet = wb.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        return {
          name,
          data: jsonData as any[][],
          cols: worksheet['!cols'] || [],
          rows: worksheet['!rows'] || [],
          merges: worksheet['!merges'],
        };
      });

      setSheets(sheetsData);
      if (sheetsData.length > 0) {
        setEditedData(JSON.parse(JSON.stringify(sheetsData[0].data)));
      }
    } catch (error) {
      console.error('Excel 파일 로드 실패:', error);
      alert('Excel 파일을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...editedData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = [];
    }
    newData[rowIndex][colIndex] = value;
    setEditedData(newData);
  };

  const handleSave = async () => {
    if (!changeDescription.trim()) {
      alert('변경 내역을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 새 워크북 생성
      const newWb = XLSX.utils.book_new();
      const newWs = XLSX.utils.aoa_to_sheet(editedData);

      // 원본 시트의 열 너비 정보 복사
      if (sheets[activeSheetIndex]?.cols) {
        newWs['!cols'] = sheets[activeSheetIndex].cols;
      }

      XLSX.utils.book_append_sheet(newWb, newWs, sheets[activeSheetIndex].name);

      // 다른 시트들도 복사
      sheets.forEach((sheet, index) => {
        if (index !== activeSheetIndex) {
          const ws = XLSX.utils.aoa_to_sheet(sheet.data);
          if (sheet.cols) ws['!cols'] = sheet.cols;
          XLSX.utils.book_append_sheet(newWb, ws, sheet.name);
        }
      });

      // 저장을 위한 데이터 전달
      if (onSave) {
        onSave(newWb, changeDescription);
      }

      // 로컬 상태 업데이트
      const newSheets = [...sheets];
      newSheets[activeSheetIndex] = {
        ...newSheets[activeSheetIndex],
        data: JSON.parse(JSON.stringify(editedData)),
      };
      setSheets(newSheets);

      setIsEditing(false);
      setChangeDescription('');
      alert('저장되었습니다.');
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedData(JSON.parse(JSON.stringify(sheets[activeSheetIndex].data)));
    setIsEditing(false);
    setChangeDescription('');
  };

  const handleDownload = () => {
    if (!workbook) return;

    try {
      // 편집된 데이터가 있으면 반영
      if (isEditing) {
        const newWb = XLSX.utils.book_new();
        const newWs = XLSX.utils.aoa_to_sheet(editedData);
        if (sheets[activeSheetIndex]?.cols) {
          newWs['!cols'] = sheets[activeSheetIndex].cols;
        }
        XLSX.utils.book_append_sheet(newWb, newWs, sheets[activeSheetIndex].name);

        sheets.forEach((sheet, index) => {
          if (index !== activeSheetIndex) {
            const ws = XLSX.utils.aoa_to_sheet(sheet.data);
            if (sheet.cols) ws['!cols'] = sheet.cols;
            XLSX.utils.book_append_sheet(newWb, ws, sheet.name);
          }
        });

        const wbout = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), file.filename);
      } else {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), file.filename);
      }

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleSheetChange = (index: number) => {
    if (isEditing) {
      if (!confirm('편집 중인 내용이 있습니다. 시트를 변경하시겠습니까?')) {
        return;
      }
      setIsEditing(false);
    }
    setActiveSheetIndex(index);
    setEditedData(JSON.parse(JSON.stringify(sheets[index].data)));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR');
  };

  const currentSheet = sheets[activeSheetIndex];
  const displayData = isEditing ? editedData : currentSheet?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div
        className="w-full h-full max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        {/* 헤더 */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: themeColors.border }}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <FileSpreadsheet size={24} style={{ color: themeColors.primary }} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold truncate" style={{ color: themeColors.text }}>
                {file.filename}
              </h2>
              <div className="flex items-center space-x-4 mt-1 text-sm flex-wrap" style={{ color: themeColors.textSecondary }}>
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
            {canEdit && !isEditing && (
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

            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: themeColors.textSecondary }}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 편집 모드 안내 */}
        {isEditing && (
          <div
            className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
              borderColor: themeColors.border,
            }}
          >
            <div className="flex items-center space-x-2">
              <AlertCircle size={18} className="text-blue-500" />
              <span className="text-sm font-medium" style={{ color: themeColors.text }}>
                편집 모드 - 셀을 클릭하여 수정하세요
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="변경 내역을 입력하세요... (필수)"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 w-80"
                style={{
                  backgroundColor: themeColors.background,
                  border: `1px solid ${themeColors.border}`,
                  color: themeColors.text,
                }}
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg flex items-center space-x-2 text-white text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: '#10B981',
                }}
              >
                <Save size={16} />
                <span>{isSaving ? '저장 중...' : '저장'}</span>
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
                  color: '#EF4444',
                }}
              >
                <RotateCcw size={16} />
                <span>취소</span>
              </button>
            </div>
          </div>
        )}

        {/* 시트 탭 */}
        {sheets.length > 1 && (
          <div
            className="px-6 py-2 border-b flex items-center space-x-2 overflow-x-auto flex-shrink-0"
            style={{ borderColor: themeColors.border }}
          >
            {sheets.map((sheet, index) => (
              <button
                key={index}
                onClick={() => handleSheetChange(index)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: activeSheetIndex === index
                    ? theme === 'dark'
                      ? 'rgba(59,130,246,0.2)'
                      : 'rgba(59,130,246,0.1)'
                    : 'transparent',
                  color: activeSheetIndex === index ? '#3B82F6' : themeColors.text,
                  borderBottom: activeSheetIndex === index ? `2px solid #3B82F6` : 'none',
                }}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        {/* 스프레드시트 영역 */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* 메인 스프레드시트 */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <LoadingSpinner message="파일을 불러오는 중..." />
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {displayData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, colIndex) => (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          className="border px-3 py-2 min-w-[100px]"
                          style={{
                            borderColor: themeColors.border,
                            backgroundColor: rowIndex === 0
                              ? theme === 'dark'
                                ? 'rgba(59,130,246,0.1)'
                                : 'rgba(59,130,246,0.05)'
                              : 'transparent',
                          }}
                        >
                          {isEditing && rowIndex > 0 ? (
                            <input
                              type="text"
                              value={cell || ''}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              className="w-full px-2 py-1 rounded focus:outline-none focus:ring-2"
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: themeColors.text,
                              }}
                            />
                          ) : (
                            <span
                              className={rowIndex === 0 ? 'font-semibold' : ''}
                              style={{ color: themeColors.text }}
                            >
                              {cell || ''}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                {/* 현재 버전 */}
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

                {/* 이전 버전들 */}
                {file.versions.map((version) => (
                  <div
                    key={version.versionNumber}
                    className="p-3 rounded-lg border"
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
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderColor: themeColors.border,
            color: themeColors.textSecondary,
          }}
        >
          {canEdit ? (
            <span>편집 가능 - {sheets.length}개 시트, {displayData.length}행</span>
          ) : (
            <span>읽기 전용 - 편집 권한이 없습니다</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetViewer;
