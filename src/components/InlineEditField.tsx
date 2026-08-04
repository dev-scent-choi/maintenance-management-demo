import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';

export interface ChangeEntry {
  id: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  timestamp: Date;
  userName: string;
}

interface InlineEditFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date';
  placeholder?: string;
  multiline?: boolean;
  displayValue?: string;
  className?: string;
  style?: React.CSSProperties;
  canEdit?: boolean;
}

const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onSave,
  type = 'text',
  placeholder,
  multiline = false,
  displayValue,
  className,
  style,
  canEdit = true,
}) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const theme = useSettingsStore((s) => s.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const t = useLanguage();
  const resolvedPlaceholder = placeholder ?? t('clickToEnter');

  useEffect(() => { setLocalValue(value); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && type !== 'date') {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = type === 'date' ? localValue : localValue.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setLocalValue(value); setEditing(false); }
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); handleSave(); }
  };

  if (!canEdit) {
    return <span className={className} style={style}>{displayValue || value || '-'}</span>;
  }

  const editingStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: `1.5px solid ${themeColors.primary}`,
    borderRadius: '4px',
    color: themeColors.text,
    padding: multiline ? '8px 12px' : '3px 8px',
    width: '100%',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: `0 0 0 3px ${themeColors.primary}20`,
    lineHeight: '1.5',
    display: 'block',
    colorScheme: type === 'date' ? (isDark ? 'dark' : 'light') : undefined,
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={className}
          style={{ ...editingStyle, resize: 'vertical', minHeight: '80px' }}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`no-focus-ring ${className || ''}`}
        style={editingStyle}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        ...style,
        display: 'block',
        borderRadius: '4px',
        padding: '3px 8px',
        margin: '0 -8px',
        cursor: 'text',
        transition: 'background 0.1s ease',
        minHeight: multiline ? '80px' : undefined,
        whiteSpace: multiline ? 'pre-wrap' : undefined,
        wordBreak: multiline ? 'break-word' : undefined,
      }}
      title={t('clickToEdit')}
      onClick={() => setEditing(true)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(55,53,47,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {displayValue || value || <span style={{ opacity: 0.35, fontWeight: 400 }}>{resolvedPlaceholder}</span>}
    </span>
  );
};

export default InlineEditField;
