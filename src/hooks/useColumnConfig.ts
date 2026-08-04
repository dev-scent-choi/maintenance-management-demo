import { useState, useCallback, useMemo } from 'react';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

export type AggFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
export type AggPlacement = 'header' | 'footer';

export interface ColumnDef {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date';
  always?: boolean;       // 숨김 불가 필수 컬럼
  mergeable?: boolean;    // 스마트 병합 대상 가능 여부
  defaultWidth?: number;  // 기본 컬럼 너비(px), CSS grid 생성에 사용
}

export interface ColumnConfig extends ColumnDef {
  visible: boolean;
  order: number;
  aggregation: AggFunction | null;
  aggPlacement: AggPlacement;
  merge: boolean;
}

// ── 로컬스토리지 키 ──────────────────────────────────────────────────────────
const PREFIX = 'grid_config_v1_';

const load = (key: string): ColumnConfig[] | null => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as ColumnConfig[]) : null;
  } catch {
    return null;
  }
};

const save = (key: string, cols: ColumnConfig[]) => {
  localStorage.setItem(PREFIX + key, JSON.stringify(cols));
};

// ── 초기화 ─────────────────────────────────────────────────────────────────
const buildInitial = (pageId: string, defs: ColumnDef[]): ColumnConfig[] => {
  const saved = load(pageId);
  if (saved) {
    const savedMap = new Map(saved.map(c => [c.key, c]));
    // 새로 추가된 컬럼은 기본값으로 추가, 삭제된 컬럼은 제거
    return defs
      .map((def, i) => {
        const s = savedMap.get(def.key);
        return {
          ...def,
          visible:      s ? s.visible      : true,
          order:        s ? s.order        : i + 1000,
          aggregation:  s ? s.aggregation  : null,
          aggPlacement: s ? s.aggPlacement : 'footer',
          merge:        s ? s.merge        : false,
        };
      })
      .sort((a, b) => a.order - b.order)
      .map((c, i) => ({ ...c, order: i }));
  }
  return defs.map((def, i) => ({
    ...def,
    visible: true,
    order: i,
    aggregation: null,
    aggPlacement: 'footer' as AggPlacement,
    merge: false,
  }));
};

// ── 훅 ────────────────────────────────────────────────────────────────────────
export const useColumnConfig = (pageId: string, defaultDefs: ColumnDef[]) => {
  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    buildInitial(pageId, defaultDefs)
  );

  const update = useCallback((updater: (prev: ColumnConfig[]) => ColumnConfig[]) => {
    setColumns(prev => {
      const next = updater(prev);
      save(pageId, next);
      return next;
    });
  }, [pageId]);

  // 보이는 컬럼 — order 순 정렬 (Memoization)
  const visibleColumns = useMemo(
    () => columns.filter(c => c.visible).sort((a, b) => a.order - b.order),
    [columns]
  );

  // ── 컬럼 표시/숨김 ──────────────────────────────────────────────────────────
  const toggleVisible = useCallback((key: string) => {
    update(prev => prev.map(c =>
      c.key === key && !c.always ? { ...c, visible: !c.visible } : c
    ));
  }, [update]);

  // ── 드래그 앤 드롭 순서 변경 ────────────────────────────────────────────────
  const reorder = useCallback((fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    update(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const fi = sorted.findIndex(c => c.key === fromKey);
      const ti = sorted.findIndex(c => c.key === toKey);
      if (fi < 0 || ti < 0) return prev;
      const [item] = sorted.splice(fi, 1);
      sorted.splice(ti, 0, item);
      return sorted.map((c, i) => ({ ...c, order: i }));
    });
  }, [update]);

  // ── 집계 설정 ────────────────────────────────────────────────────────────────
  const setAggregation = useCallback(
    (key: string, fn: AggFunction | null, placement: AggPlacement = 'footer') => {
      update(prev => prev.map(c =>
        c.key === key ? { ...c, aggregation: fn, aggPlacement: placement } : c
      ));
    }, [update]
  );

  // ── 병합 토글 ────────────────────────────────────────────────────────────────
  const toggleMerge = useCallback((key: string) => {
    update(prev => prev.map(c =>
      c.key === key ? { ...c, merge: !c.merge } : c
    ));
  }, [update]);

  // ── 초기화 ──────────────────────────────────────────────────────────────────
  // ── 템플릿에서 컬럼 설정 일괄 적용 ────────────────────────────────────────────
  const applyFromTemplate = useCallback((
    templateCols: { key: string; order: number }[],
    templateAggs: { key: string; fn: AggFunction | null; placement: AggPlacement }[]
  ) => {
    const keyOrder = new Map(templateCols.map(c => [c.key, c.order]));
    const aggMap   = new Map(templateAggs.map(a => [a.key, a]));
    update(prev => prev
      .map(c => ({
        ...c,
        visible:      c.always ? true : keyOrder.has(c.key),
        order:        keyOrder.has(c.key) ? keyOrder.get(c.key)! : (prev.length + 999),
        aggregation:  aggMap.get(c.key)?.fn ?? null,
        aggPlacement: aggMap.get(c.key)?.placement ?? 'footer',
      }))
      .sort((a, b) => a.order - b.order)
      .map((c, i) => ({ ...c, order: i }))
    );
  }, [update]);

  const reset = useCallback(() => {
    const fresh = defaultDefs.map((def, i) => ({
      ...def, visible: true, order: i, aggregation: null as AggFunction | null,
      aggPlacement: 'footer' as AggPlacement, merge: false,
    }));
    setColumns(fresh);
    localStorage.removeItem(PREFIX + pageId);
  }, [defaultDefs, pageId]);

  return { columns, visibleColumns, toggleVisible, reorder, setAggregation, toggleMerge, reset, applyFromTemplate };
};
