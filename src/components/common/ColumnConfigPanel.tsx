import React, { useRef } from 'react';
import { X, RotateCcw, GripVertical, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';
import type { ColumnConfig, AggFunction, AggPlacement } from '../../hooks/useColumnConfig';

interface Props {
  open: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onToggleVisible: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
  onSetAggregation: (key: string, fn: AggFunction | null, placement?: AggPlacement) => void;
  onToggleMerge: (key: string) => void;
  onReset: () => void;
}

const AGG_OPTIONS: { value: AggFunction | ''; label: string }[] = [
  { value: '', label: '없음' },
  { value: 'COUNT', label: 'COUNT (건수)' },
  { value: 'SUM',   label: 'SUM (합계)' },
  { value: 'AVG',   label: 'AVG (평균)' },
  { value: 'MIN',   label: 'MIN (최소)' },
  { value: 'MAX',   label: 'MAX (최대)' },
];

const ColumnConfigPanel: React.FC<Props> = ({
  open, onClose, columns, onToggleVisible, onReorder,
  onSetAggregation, onToggleMerge, onReset,
}) => {
  const theme = useSettingsStore(s => s.settings.theme);
  const tc    = themeConfigs[theme];
  const isDark = theme !== 'light';

  const dragKey = useRef<string | null>(null);

  if (!open) return null;

  const sorted = [...columns].sort((a, b) => a.order - b.order);

  const inputSt: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.05)',
    border: `1px solid ${tc.border}`, borderRadius: '4px',
    color: tc.text, padding: '3px 7px', fontSize: '0.75rem', outline: 'none',
    cursor: 'pointer',
  };

  return (
    <>
      {/* 오버레이 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px', zIndex: 201,
        backgroundColor: tc.surface, borderLeft: `1px solid ${tc.border}`,
        display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${tc.border}`, flexShrink: 0 }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9375rem', color: tc.text }}>컬럼 설정</span>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tc.border}`, background: 'transparent', color: tc.textSecondary, fontSize: '0.75rem', cursor: 'pointer', marginRight: 8 }}
            onClick={onReset}
          >
            <RotateCcw size={12} /> 초기화
          </button>
          <button
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: tc.textSecondary, display: 'flex' }}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* 안내 */}
        <div style={{ padding: '8px 16px', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(55,53,47,0.03)', borderBottom: `1px solid ${tc.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: '0.6875rem', color: tc.textSecondary, lineHeight: 1.6 }}>
            ≡ 드래그로 순서 변경 · 눈 아이콘으로 표시/숨김 · 집계 함수 및 위치 설정 가능
          </p>
        </div>

        {/* 컬럼 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {sorted.map((col) => (
            <div
              key={col.key}
              draggable
              onDragStart={() => { dragKey.current = col.key; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragKey.current && dragKey.current !== col.key) {
                  onReorder(dragKey.current, col.key);
                }
                dragKey.current = null;
              }}
              style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
                padding: '10px 10px', marginBottom: '4px', borderRadius: '6px',
                border: `1px solid ${tc.border}`,
                backgroundColor: col.visible
                  ? (isDark ? 'rgba(255,255,255,0.025)' : 'rgba(55,53,47,0.02)')
                  : (isDark ? 'rgba(255,255,255,0.01)' : 'transparent'),
                opacity: col.visible ? 1 : 0.5,
                cursor: 'grab',
              }}
            >
              {/* 행 1: 드래그핸들 + 이름 + 표시토글 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GripVertical size={14} style={{ color: tc.textSecondary, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: tc.text }}>{col.label}</span>
                {col.always && (
                  <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: `${tc.primary}18`, color: tc.primary }}>필수</span>
                )}
                <button
                  style={{ border: 'none', background: 'none', cursor: col.always ? 'not-allowed' : 'pointer', color: col.visible ? tc.primary : tc.textSecondary, display: 'flex', alignItems: 'center', opacity: col.always ? 0.4 : 1 }}
                  onClick={() => onToggleVisible(col.key)}
                  title={col.visible ? '숨기기' : '표시'}
                >
                  {col.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>

              {/* 행 2: 집계 함수 + 위치 선택 + 병합 (보이는 컬럼만) */}
              {col.visible && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '22px' }}>
                  {/* 집계 함수 선택 */}
                  <select
                    value={col.aggregation || ''}
                    onChange={e => {
                      const fn = e.target.value as AggFunction | '';
                      onSetAggregation(col.key, fn || null, col.aggPlacement);
                    }}
                    style={{ ...inputSt, flex: 1 }}
                  >
                    {AGG_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}
                        style={{ backgroundColor: isDark ? '#1D2229' : '#fff', color: tc.text }}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* 집계 위치 선택 (집계 함수 선택 시만 표시) */}
                  {col.aggregation && (
                    <select
                      value={col.aggPlacement}
                      onChange={e =>
                        onSetAggregation(col.key, col.aggregation, e.target.value as AggPlacement)
                      }
                      style={{ ...inputSt, width: '68px' }}
                    >
                      <option value="header" style={{ backgroundColor: isDark ? '#1D2229' : '#fff', color: tc.text }}>상단</option>
                      <option value="footer" style={{ backgroundColor: isDark ? '#1D2229' : '#fff', color: tc.text }}>하단</option>
                    </select>
                  )}

                  {/* 스마트 병합 (mergeable 컬럼만) */}
                  {col.mergeable && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.6875rem', color: tc.textSecondary, whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={col.merge}
                        onChange={() => onToggleMerge(col.key)}
                        style={{ accentColor: tc.primary, cursor: 'pointer' }}
                      />
                      병합
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${tc.border}`, flexShrink: 0 }}>
          <button
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: tc.primary, color: theme === 'yellow' ? '#333' : '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            onClick={onClose}
          >
            적용
          </button>
        </div>
      </div>
    </>
  );
};

export default ColumnConfigPanel;
