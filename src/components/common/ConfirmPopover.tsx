import React, { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { themeConfigs } from '../../utils/themeConfig';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfirmPopoverProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'delete' shows Trash icon (red), 'warn' shows AlertTriangle */
  variant?: 'delete' | 'warn';
  onConfirm: () => void;
  onCancel: () => void;
  /** Pass the trigger button's ref to anchor the popover near it */
  anchorRef?: React.RefObject<HTMLElement>;
  isLoading?: boolean;
}

const ConfirmPopover: React.FC<ConfirmPopoverProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'delete',
  onConfirm,
  onCancel,
  anchorRef,
  isLoading = false,
}) => {
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const popoverRef = useRef<HTMLDivElement>(null);
  const t = useLanguage();
  const resolvedConfirmLabel = confirmLabel ?? t('delete');
  const resolvedCancelLabel = cancelLabel ?? t('cancel');

  // outside click → cancel
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target as Node))
      ) {
        onCancel();
      }
    };
    // slight delay so the click that opened it doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handle); };
  }, [isOpen, onCancel, anchorRef]);

  // esc key → cancel
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const Icon = variant === 'delete' ? Trash2 : AlertTriangle;

  return (
    <>
      {/* Invisible backdrop for outside-click — no dim */}
      <div className="fixed inset-0 z-[60]" onClick={onCancel} />

      {/* Popover card */}
      <div
        ref={popoverRef}
        className="fixed z-[61] flex flex-col"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '8px',
          boxShadow: isDark
            ? '0 4px 6px rgba(0,0,0,0.3), 0 12px 32px rgba(0,0,0,0.5)'
            : '0 4px 6px rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.12)',
          padding: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center mt-0.5"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
          >
            <Icon size={15} style={{ color: '#EF4444' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug" style={{ color: themeColors.text }}>
              {title}
            </p>
            {description && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: themeColors.textSecondary }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: themeColors.border, margin: '0 0 16px' }} />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 text-sm font-medium rounded transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)',
              color: themeColors.textSecondary,
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(55,53,47,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(55,53,47,0.06)'; }}
          >
            {resolvedCancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-3 py-1.5 text-sm font-medium rounded transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#EF4444',
              color: '#ffffff',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {isLoading ? t('processing') : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmPopover;
