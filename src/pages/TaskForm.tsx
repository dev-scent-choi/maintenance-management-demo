import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Save, ListTodo, Calendar, Flag, Gauge, Paperclip, UserCircle, Bug, Lightbulb, Zap, HelpCircle, Shield, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { themeConfigs } from '../utils/themeConfig';
import { useLanguage } from '../contexts/LanguageContext';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  department?: string;
}

type CategoryType = 'bug' | 'feature' | 'improvement' | 'other';

const TaskForm: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const t = useLanguage();
  const { theme, language } = useSettingsStore((state) => state.settings);
  const themeColors = themeConfigs[theme];
  const { user, token } = useAuthStore();
  const { addIssue } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialType = (searchParams.get('type') || 'bug') as CategoryType;
  const isIssueType = (_cat: CategoryType) => true;

  const [category, setCategory] = useState<CategoryType>(initialType);
  const [isDragging, setIsDragging] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'todo' as 'todo' | 'in_progress' | 'review' | 'done',
    severity: 'major' as 'minor' | 'major' | 'critical' | 'blocker',
    dueDate: '',
    assigneeId: '',
    weight: 10,
    files: [] as any[],
  });

  const isDark = theme !== 'light';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
  const subtleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const onPrimaryText = theme === 'yellow' ? '#333' : '#fff';
  const optionStyle = { backgroundColor: themeColors.surface, color: themeColors.text };
  const inputStyle = {
    backgroundColor: inputBg,
    border: `1px solid ${themeColors.border}`,
    color: themeColors.text,
    borderRadius: '4px',
  };

  const categories: { value: CategoryType; label: string; icon: any; color: string }[] = [
    { value: 'bug',         label: t('issueTypeBug'),         icon: Bug,      color: '#EF4444' },
    { value: 'feature',     label: t('issueTypeFeature'),     icon: Lightbulb, color: '#8B5CF6' },
    { value: 'improvement', label: t('issueTypeImprovement'), icon: Zap,      color: '#3B82F6' },
    { value: 'other',       label: t('issueTypeOther'),       icon: ListTodo, color: themeColors.primary },
  ];

  const currentCat = categories.find(c => c.value === category) || categories[0];

  useEffect(() => {
    const fetchProjectMembers = async () => {
      if (!projectId || !token) return;
      try {
        const projectRes = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const memberIds = [projectData.managerId, ...(projectData.members || [])];
          const usersRes = await fetch(import.meta.env.VITE_API_URL + '/users', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const members = usersData
              .filter((u: any) => memberIds.includes(u.id))
              .map((u: any) => ({
                id: u.id.toString(),
                name: u.name,
                email: u.email,
                department: u.department,
              }));
            setProjectMembers(members);
          }
        }
      } catch (error) {
        console.error('Error fetching project members:', error);
      }
    };
    fetchProjectMembers();
  }, [projectId, token]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processTaskFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processTaskFiles(Array.from(e.target.files));
  };

  const processTaskFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile = {
          id: `temp-${Date.now()}-${Math.random()}`,
          name: file.name,
          url: e.target?.result as string,
          type: file.type,
          size: file.size,
          uploadedAt: new Date(),
          uploadedBy: user?.name || '',
          uploadedById: user?.id || '',
          isImage: file.type.startsWith('image/'),
          file: file,
        };
        setTaskFormData(prev => ({ ...prev, files: [...prev.files, newFile] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setTaskFormData(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }));
  };

  const handleSubmit = async () => {
    if (!taskFormData.title.trim()) {
      alert(t('issueTitle') + ' required');
      return;
    }
    if (!projectId) return;

    if (isIssueType(category)) {
      try {
        await addIssue({
          projectId,
          title: taskFormData.title,
          description: taskFormData.description,
          type: category as 'bug' | 'feature' | 'improvement' | 'question',
          status: 'open',
          severity: taskFormData.severity,
          priority: taskFormData.priority as any,
          assigneeId: taskFormData.assigneeId || undefined,
          reporterId: user?.id || '',
          dueDate: taskFormData.dueDate ? new Date(taskFormData.dueDate) : undefined,
          labels: [],
          attachments: [],
          comments: [],
        });
        navigate(`/projects/${projectId}`);
      } catch (error) {
        console.error('Error creating issue:', error);
        alert('이슈 등록에 실패했습니다.');
      }
    } else {
      if (!taskFormData.assigneeId) {
        alert('담당자를 선택해주세요.');
        return;
      }
      try {
        const formattedDueDate = taskFormData.dueDate || null;
        const backendStatus = taskFormData.status === 'review' ? 'IN_REVIEW' : taskFormData.status.toUpperCase();
        const requestBody = {
          title: taskFormData.title,
          description: taskFormData.description,
          priority: taskFormData.priority.toUpperCase(),
          status: backendStatus,
          dueDate: formattedDueDate,
          assigneeId: taskFormData.assigneeId ? parseInt(taskFormData.assigneeId, 10) : null,
          reporterId: user?.id ? parseInt(user.id, 10) : null,
          weight: taskFormData.weight,
          projectId: projectId,
        };
        const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(requestBody),
        });
        if (response.ok) {
          const createdTask = await response.json();
          const taskId = createdTask.id;
          if (taskFormData.files && taskFormData.files.length > 0) {
            for (const fileData of taskFormData.files) {
              if (fileData.file) {
                const formData = new FormData();
                formData.append('file', fileData.file);
                await fetch(`${import.meta.env.VITE_API_URL}/tasks/${taskId}/attachments`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: formData,
                });
              }
            }
          }
          alert('작업이 생성되었습니다.');
          navigate(`/projects/${projectId}`);
        } else {
          const errorData = await response.json();
          alert(`작업 생성 실패: ${errorData.message || '알 수 없는 오류'}`);
        }
      } catch (error) {
        console.error('[TaskForm] Error creating task:', error);
        alert('작업 생성 중 오류가 발생했습니다.');
      }
    }
  };

  const headerTitle = isIssueType(category)
    ? `${currentCat.label} ${t('registerIssue')}`
    : (t('addTask') || '작업 추가');

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: themeColors.textSecondary,
  };
  const propRow = 'flex items-center gap-0 py-0';
  const propLabel = 'flex-shrink-0 text-sm font-medium';

  return (
    <div className="h-full flex flex-col">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="w-8 h-8 flex items-center justify-center rounded transition-opacity hover:opacity-60"
            style={{ color: themeColors.textSecondary }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: themeColors.text }}>{headerTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={!taskFormData.title.trim()}
            className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
          >
            {language === 'ko' ? '등록' : 'Register'}
          </button>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-60"
            style={{ backgroundColor: subtleBg, color: themeColors.text, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}
          >
            {language === 'ko' ? '취소' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* ── 카테고리 탭 ── */}
      <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
        {categories.map((cat) => {
          const isActive = category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className="px-4 py-2.5 text-xs font-semibold transition-colors"
              style={{
                color: isActive ? themeColors.primary : themeColors.textSecondary,
                borderBottom: `2px solid ${isActive ? themeColors.primary : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── BODY: 기본정보 + 첨부파일 2열 ── */}
      <div className="flex gap-3 flex-1 min-h-0 mt-3">
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />

        {/* ── 열 1: 기본 정보 (상태/우선순위 포함) ── */}
        <div className="flex-[6] min-w-0 rounded overflow-hidden flex flex-col" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
            <div className="flex items-center gap-2.5">
              <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
              <h2 className="text-base font-bold" style={{ color: themeColors.text }}>기본 정보</h2>
            </div>
          </div>
          <div className="p-3 flex flex-col flex-1 min-h-0 gap-3">
            {/* 제목 */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>
                제목 <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder={isIssueType(category) ? '이슈 제목을 입력하세요' : '작업 제목을 입력하세요'}
                className="w-full px-4 py-2.5 rounded focus:outline-none text-sm"
                style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
              />
            </div>
            {/* 담당자 + 마감일 (2열) */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>
                  담당자 {!isIssueType(category) && <span style={{ color: '#EF4444' }}>*</span>}
                </label>
                <select
                  value={taskFormData.assigneeId}
                  onChange={(e) => setTaskFormData({ ...taskFormData, assigneeId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded focus:outline-none text-sm"
                  style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                >
                  <option value="" style={optionStyle}>선택</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.id} style={optionStyle}>
                      {m.name}{m.department ? ` (${m.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>마감일</label>
                <input
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                  onClick={(e) => { const i = e.currentTarget; if (i.showPicker) i.showPicker(); }}
                  className="w-full px-3 py-2.5 rounded focus:outline-none text-sm cursor-pointer"
                  style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                />
              </div>
            </div>
            {/* 상태/심각도 + 우선순위 (2열) */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>
                  {isIssueType(category) ? '심각도' : '상태'}
                </label>
                {isIssueType(category) ? (
                  <select
                    value={taskFormData.severity}
                    onChange={(e) => setTaskFormData({ ...taskFormData, severity: e.target.value as typeof taskFormData.severity })}
                    className="w-full px-3 py-2.5 rounded focus:outline-none text-sm"
                    style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                  >
                    <option value="minor" style={optionStyle}>{t('severityMinor') || '낮음'}</option>
                    <option value="major" style={optionStyle}>{t('severityMajor') || '보통'}</option>
                    <option value="critical" style={optionStyle}>{t('severityCritical') || '높음'}</option>
                    <option value="blocker" style={optionStyle}>{t('severityBlocker') || '치명적'}</option>
                  </select>
                ) : (
                  <select
                    value={taskFormData.status}
                    onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value as typeof taskFormData.status })}
                    className="w-full px-3 py-2.5 rounded focus:outline-none text-sm"
                    style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                  >
                    <option value="todo" style={optionStyle}>{t('todoStatus') || '할 일'}</option>
                    <option value="in_progress" style={optionStyle}>{t('inProgressStatus') || '진행 중'}</option>
                    <option value="review" style={optionStyle}>{t('reviewStatus') || '검토 중'}</option>
                    <option value="done" style={optionStyle}>{t('doneStatus') || '완료'}</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>우선순위</label>
                <select
                  value={taskFormData.priority}
                  onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as typeof taskFormData.priority })}
                  className="w-full px-3 py-2.5 rounded focus:outline-none text-sm"
                  style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                >
                  <option value="low" style={optionStyle}>{t('low') || '낮음'}</option>
                  <option value="medium" style={optionStyle}>{t('medium') || '보통'}</option>
                  <option value="high" style={optionStyle}>{t('high') || '높음'}</option>
                  <option value="urgent" style={optionStyle}>{t('urgent') || '긴급'}</option>
                </select>
              </div>
            </div>
            {/* 가중치 (작업만) */}
            {!isIssueType(category) && (
              <div className="flex-shrink-0">
                <label className="block text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>가중치 (%)</label>
                <input
                  type="number" min="1" max="100"
                  value={taskFormData.weight}
                  onChange={(e) => setTaskFormData({ ...taskFormData, weight: parseFloat(e.target.value) || 10 })}
                  className="w-full px-4 py-2.5 rounded focus:outline-none text-sm"
                  style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                />
                <p className="text-xs mt-1.5" style={{ color: themeColors.textSecondary }}>프로젝트 진행률 반영 비중</p>
              </div>
            )}
            {/* 설명 — flex-1로 나머지 공간 채움 */}
            <div className="flex flex-col flex-1 min-h-0">
              <label className="block text-xs font-bold mb-2 flex-shrink-0" style={{ color: themeColors.textSecondary }}>설명</label>
              <textarea
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder={isIssueType(category) ? '이슈 내용을 자세히 적어주세요' : '작업에 대한 설명을 입력하세요'}
                className="w-full px-4 py-2.5 rounded focus:outline-none text-sm resize-none flex-1"
                style={{ backgroundColor: inputBg, border: `1px solid ${themeColors.border}`, color: themeColors.text, lineHeight: '1.6' }}
              />
            </div>
          </div>
        </div>

        {/* ── 열 2: 첨부파일 ── */}
        <div className="flex-[3] min-w-0 rounded overflow-hidden flex flex-col" style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}` }}>
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
            <div className="flex items-center gap-2.5">
              <div style={{ width: '3px', height: '16px', backgroundColor: themeColors.primary, borderRadius: '2px' }} />
              <h2 className="text-base font-bold" style={{ color: themeColors.text }}>첨부파일</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: subtleBg, color: themeColors.textSecondary }}>
              {taskFormData.files.length}개
            </span>
          </div>
          <div className="p-3 flex-1 flex flex-col" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {taskFormData.files.length > 0 ? (
              <div className="space-y-2 flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-2">
                  {taskFormData.files.map((file) => (
                    <div key={file.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded transition-all" style={{ backgroundColor: subtleBg }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: file.isImage ? 'rgba(59,130,246,0.1)' : 'rgba(107,114,128,0.1)' }}>
                        {file.isImage ? <ImageIcon size={15} style={{ color: '#3B82F6' }} /> : <FileText size={15} style={{ color: '#6B7280' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>{file.name}</p>
                        <p className="text-xs" style={{ color: themeColors.textSecondary }}>{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id); }}
                        className="p-1.5 rounded-lg transition-all hover:brightness-95 flex-shrink-0"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded border-2 border-dashed transition-all flex-shrink-0"
                  style={{ borderColor: themeColors.border, color: themeColors.primary }}>
                  <Upload size={16} />
                  <span className="text-sm font-medium">파일 추가</span>
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded cursor-pointer transition-all flex-1 flex flex-col"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderColor: isDragging ? themeColors.primary : themeColors.border, backgroundColor: isDragging ? `${themeColors.primary}10` : 'transparent' }}>
                <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: subtleBg }}>
                    <Upload size={24} style={{ color: themeColors.textSecondary }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: themeColors.text }}>클릭 또는 드래그로 업로드</p>
                  <p className="text-sm" style={{ color: themeColors.textSecondary }}>이미지, PDF, 문서</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskForm;
