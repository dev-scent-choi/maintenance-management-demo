import type { ColumnConfig, AggFunction, AggPlacement } from '../hooks/useColumnConfig';

// ── 집계 계산 ─────────────────────────────────────────────────────────────────

export interface AggResult {
  value: string | number;
  fn: AggFunction;
  placement: AggPlacement;
}

/**
 * filteredRows 전체를 기준으로 컬럼별 집계값 계산
 * rows: 필터링된 전체 데이터 (페이지네이션 전)
 */
export const computeAggregations = (
  rows: Record<string, any>[],
  columns: ColumnConfig[],
): Record<string, AggResult> => {
  const result: Record<string, AggResult> = {};

  columns
    .filter(c => c.visible && c.aggregation)
    .forEach(col => {
      const vals = rows.map(r => r[col.key]).filter(v => v != null && v !== '');
      let value: string | number = '';

      switch (col.aggregation) {
        case 'COUNT':
          value = vals.length;
          break;
        case 'SUM':
          value = vals.reduce((s, v) => s + (Number(v) || 0), 0);
          break;
        case 'AVG': {
          const sum = vals.reduce((s, v) => s + (Number(v) || 0), 0);
          value = vals.length ? +(sum / vals.length).toFixed(2) : 0;
          break;
        }
        case 'MIN':
          value = vals.length ? Math.min(...vals.map(Number)) : '';
          break;
        case 'MAX':
          value = vals.length ? Math.max(...vals.map(Number)) : '';
          break;
      }

      result[col.key] = { value, fn: col.aggregation!, placement: col.aggPlacement };
    });

  return result;
};

// ── 스마트 병합 — rowSpan 계산 ──────────────────────────────────────────────
// returns: spans[rowIndex][colKey] = rowSpan 값 (0이면 렌더링 생략)

export const computeMergeSpans = (
  rows: Record<string, any>[],
  columns: ColumnConfig[],
): number[][] => {
  const mergeCols = columns.filter(c => c.visible && c.merge);
  // spans[rowIndex][colIndex] 형태로 저장
  const colCount = columns.filter(c => c.visible).sort((a, b) => a.order - b.order).length;
  const visibleCols = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);
  const spans: number[][] = rows.map(() => new Array(colCount).fill(1));

  mergeCols.forEach(col => {
    const colIdx = visibleCols.findIndex(c => c.key === col.key);
    if (colIdx < 0) return;

    // 위에서 아래로 병합 계산 (연속된 동일값을 첫 번째 셀이 흡수)
    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (j < rows.length && rows[j][col.key] === rows[i][col.key] && rows[j][col.key] !== undefined && rows[j][col.key] !== '') {
        j++;
      }
      const span = j - i;
      spans[i][colIdx] = span;
      for (let k = i + 1; k < j; k++) spans[k][colIdx] = 0; // 숨김
      i = j;
    }
  });

  return spans;
};

// ── 집계 레이블 포매팅 ────────────────────────────────────────────────────────
export const fmtAggLabel = (fn: AggFunction) => {
  const map: Record<AggFunction, string> = {
    COUNT: '건수', SUM: '합계', AVG: '평균', MIN: '최소', MAX: '최대',
  };
  return map[fn] || fn;
};
