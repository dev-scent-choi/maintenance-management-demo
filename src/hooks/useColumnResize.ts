import { useState, useRef, useCallback, useEffect } from 'react';

export function useColumnResize(initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths);

  // 컬럼 수가 바뀌면 state 재초기화 (코드 변경 시 stale state 방지)
  useEffect(() => {
    setWidths(initialWidths);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWidths.length]);
  const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = useCallback((colIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { index: colIndex, startX: e.clientX, startWidth: widths[colIndex] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { index, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
      setWidths(prev => prev.map((w, i) => i === index ? newWidth : w));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [widths]);

  return {
    widths,
    handleResizeMouseDown,
    gridTemplateColumns: widths.map(w => `${w}px`).join(' '),
  };
}

export const colResizeHandleStyle = {
  position: 'absolute' as const,
  right: -4,
  top: 0,
  bottom: 0,
  width: 8,
  cursor: 'col-resize',
  zIndex: 10,
  userSelect: 'none' as const,
};
