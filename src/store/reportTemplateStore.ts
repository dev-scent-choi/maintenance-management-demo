import { create } from 'zustand';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiClient';

export interface TemplateColumn {
  key: string;
  label: string;
  order: number;
}

export interface TemplateFilters {
  action?: string | null;
  resourceType?: string | null;
}

export interface TemplateAggregation {
  groupBy: string;
  metric: 'COUNT' | 'COUNT_DISTINCT';
  label: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  columns: TemplateColumn[];
  defaultFilters: TemplateFilters;
  aggregations: TemplateAggregation[];
  isShared: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

// 서버에서 받은 raw 형태 (JSON string 필드) → 파싱 후 ReportTemplate
const parseTemplate = (raw: any): ReportTemplate => ({
  ...raw,
  columns:       raw.columns       ? JSON.parse(raw.columns)       : [],
  defaultFilters: raw.defaultFilters ? JSON.parse(raw.defaultFilters) : {},
  aggregations:  raw.aggregations  ? JSON.parse(raw.aggregations)  : [],
});

const serializeTemplate = (t: Partial<ReportTemplate>): Record<string, any> => ({
  ...t,
  columns:        t.columns       ? JSON.stringify(t.columns)       : null,
  defaultFilters: t.defaultFilters ? JSON.stringify(t.defaultFilters) : null,
  aggregations:   t.aggregations  ? JSON.stringify(t.aggregations)  : null,
});

interface TemplateState {
  templates: ReportTemplate[];
  loading: boolean;
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: Omit<ReportTemplate, 'id' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>) => Promise<ReportTemplate>;
  updateTemplate: (id: string, data: Partial<ReportTemplate>) => Promise<ReportTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
}

const API = `${import.meta.env.VITE_API_URL}/report-templates`;

export const useReportTemplateStore = create<TemplateState>()((set, get) => ({
  templates: [],
  loading: false,

  fetchTemplates: async () => {
    set({ loading: true });
    try {
      const res = await apiGet(API);
      if (!res.ok) throw new Error('fetch failed');
      const data: any[] = await res.json();
      set({ templates: data.map(parseTemplate) });
    } catch (e) {
      console.error('[reportTemplateStore] fetchTemplates:', e);
    } finally {
      set({ loading: false });
    }
  },

  createTemplate: async (data) => {
    const res = await apiPost(API, serializeTemplate(data));
    if (!res.ok) throw new Error('create failed');
    const created = parseTemplate(await res.json());
    set(s => ({ templates: [created, ...s.templates] }));
    return created;
  },

  updateTemplate: async (id, data) => {
    const res = await apiPut(`${API}/${id}`, serializeTemplate(data));
    if (!res.ok) throw new Error('update failed');
    const updated = parseTemplate(await res.json());
    set(s => ({ templates: s.templates.map(t => t.id === id ? updated : t) }));
    return updated;
  },

  deleteTemplate: async (id) => {
    const res = await apiDelete(`${API}/${id}`);
    if (!res.ok) throw new Error('delete failed');
    set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
  },
}));
