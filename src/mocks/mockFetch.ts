// 프론트엔드 데모용 목업 fetch — 백엔드/DB 없이 UI 시연을 위한 것입니다.
// window.fetch 를 가로채서 /api/** 요청에 대해 정적/인메모리 데이터로 응답합니다.
import { makeFakeJwt } from './jwt';
import { usersData, findUser, type MockUser } from './data/users';
import { companiesData, contactsData, serversData, vpnAccountsData } from './data/companies';
import { maintenanceData } from './data/maintenance';
import {
  projectsData, tasksByProject, issuesData, milestonesByProject,
  timelineByProject, documentsByProject, foldersByProject,
} from './data/projects';
import { auditLogsData, rolesData, reportTemplatesData, channelsData, messagesByChannel } from './data/misc';
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/permissions';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ADMIN_PASSWORD = 'admin1234';
export const DEMO_CODE = '123456';

// ── 인메모리 가변 상태 (세션 중 생성/수정/삭제 반영, 새로고침 시 초기화) ──
const users = [...usersData];
const companies = [...companiesData];
const contacts = [...contactsData];
const servers = [...serversData];
const vpnAccounts = [...vpnAccountsData];
const maintenance = maintenanceData.map((m) => ({ ...m, files: [...m.files], comments: [...m.comments], statusHistory: [...m.statusHistory] }));
const projects = [...projectsData];
const tasks: Record<number, any[]> = Object.fromEntries(Object.entries(tasksByProject).map(([k, v]) => [k, [...v]]));
const issues = [...issuesData];
const milestones: Record<number, any[]> = Object.fromEntries(Object.entries(milestonesByProject).map(([k, v]) => [k, [...v]]));
const documents: Record<number, any[]> = Object.fromEntries(Object.entries(documentsByProject).map(([k, v]) => [k, [...v]]));
const folders: Record<number, string[]> = Object.fromEntries(Object.entries(foldersByProject).map(([k, v]) => [k, [...v]]));
const auditLogs = [...auditLogsData];
const reportTemplates = [...reportTemplatesData];
const channels = [...channelsData];
const messages: Record<number, any[]> = Object.fromEntries(Object.entries(messagesByChannel).map(([k, v]) => [k, [...v]]));
let rolePermissions: Record<string, string[]> = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
let roles = [...rolesData];

let nextId = 100000; // 신규 생성 항목용 ID 시퀀스 (기존 목업 ID와 충돌 방지)
const genId = () => nextId++;
const nowIso = () => new Date().toISOString();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function empty(status = 204): Response {
  return new Response(null, { status });
}
function errorJson(message: string, status = 400): Response {
  return json({ message }, status);
}

function userToResponse(u: MockUser) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, department: u.department, position: u.position, role: u.role, active: u.active, passwordSet: u.passwordSet, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

function currentUserFromAuth(req: Request): MockUser | null {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return findUser(payload.sub) || null;
  } catch {
    return null;
  }
}

function authResponse(user: MockUser) {
  return { token: makeFakeJwt(user.id), user: userToResponse(user) };
}

async function readBody(req: Request): Promise<any> {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

type Handler = (params: Record<string, string>, req: Request, url: URL) => Promise<Response> | Response;
interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler; }

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, pattern, keys, handler });
}

// ============================== AUTH ==============================
route('POST', '/auth/login', async (_p, req) => {
  const body = await readBody(req);
  const email = body.email || '';
  const user = findUser(email);
  if (!user) return errorJson('사용자를 찾을 수 없습니다', 400);
  if (body.password !== DEMO_PASSWORD) {
    return errorJson(`비밀번호가 올바르지 않습니다 (데모 비밀번호: ${DEMO_PASSWORD})`, 400);
  }
  return json(authResponse(user));
});

route('POST', '/auth/register', async (_p, req) => {
  const body = await readBody(req);
  const email = body.email || `user${genId()}@maintenance-site.com`;
  const newUser: MockUser = {
    id: email, email, name: body.name || '신규 사용자', phone: body.phone || '',
    department: body.department || '', position: body.position || '', role: 'USER',
    active: true, passwordSet: true, createdAt: nowIso(), updatedAt: nowIso(),
  };
  users.push(newUser);
  return json(authResponse(newUser));
});

route('POST', '/auth/login-password', async (_p, req) => {
  const body = await readBody(req);
  const emailId = (body.emailId || '').trim();
  const email = emailId.includes('@') ? emailId : `${emailId}@maintenance-site.com`;
  const user = findUser(email);
  if (!user) return errorJson('사용자를 찾을 수 없습니다', 400);
  if (body.password === undefined) {
    // 상태 체크 모드
    return json({ passwordSet: user.passwordSet });
  }
  if (body.password !== DEMO_PASSWORD) {
    return errorJson(`비밀번호가 올바르지 않습니다 (데모 비밀번호: ${DEMO_PASSWORD})`, 400);
  }
  return json(authResponse(user));
});

route('POST', '/auth/set-initial-password', async (_p, req) => {
  const body = await readBody(req);
  const emailId = (body.emailId || '').trim();
  const email = emailId.includes('@') ? emailId : `${emailId}@maintenance-site.com`;
  const user = findUser(email);
  if (!user) return errorJson('사용자를 찾을 수 없습니다', 400);
  user.passwordSet = true;
  return json(authResponse(user));
});

route('POST', '/auth/send-code', async (_p, req) => {
  const body = await readBody(req);
  return json({ message: `인증코드가 전송되었습니다. (데모 코드: ${DEMO_CODE})`, email: body.email });
});

route('POST', '/auth/verify-code', async (_p, req) => {
  const body = await readBody(req);
  const user = findUser(body.email);
  if (!user) return errorJson('인증코드가 올바르지 않거나 만료되었습니다.', 400);
  if (body.code !== DEMO_CODE) return errorJson(`인증코드가 올바르지 않습니다 (데모 코드: ${DEMO_CODE})`, 400);
  return json(authResponse(user));
});

route('POST', '/auth/admin-login', async (_p, req) => {
  const body = await readBody(req);
  if (String(body.emailId).toLowerCase() !== 'admin') return errorJson('관리자 계정이 아닙니다', 400);
  if (body.password !== DEMO_ADMIN_PASSWORD) return errorJson(`비밀번호가 올바르지 않습니다 (데모 비밀번호: ${DEMO_ADMIN_PASSWORD})`, 400);
  const admin = findUser('admin@maintenance-site.com')!;
  return json(authResponse(admin));
});

route('POST', '/auth/refresh-token', async (_p, req) => {
  const user = currentUserFromAuth(req);
  if (!user) return errorJson('토큰이 유효하지 않습니다', 400);
  return json(authResponse(user));
});

route('POST', '/auth/logout', async () => json({ message: '로그아웃되었습니다.' }));

// ============================== USERS ==============================
route('GET', '/users', async () => json(users.map(userToResponse)));
route('GET', '/users/:id', async (p) => {
  const u = findUser(decodeURIComponent(p.id));
  return u ? json(userToResponse(u)) : errorJson('사용자를 찾을 수 없습니다', 404);
});
route('POST', '/users', async (_p, req) => {
  const body = await readBody(req);
  const newUser: MockUser = {
    id: body.email, email: body.email, name: body.name, phone: body.phone || '',
    department: body.department || '', position: body.position || '',
    role: (body.role || 'USER').toUpperCase(), active: true,
    passwordSet: !!body.password, createdAt: nowIso(), updatedAt: nowIso(),
  };
  users.push(newUser);
  return json(userToResponse(newUser));
});
route('PUT', '/users/:id', async (p, req) => {
  const u = findUser(decodeURIComponent(p.id));
  if (!u) return errorJson('사용자를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  Object.assign(u, { name: body.name ?? u.name, phone: body.phone ?? u.phone, department: body.department ?? u.department, position: body.position ?? u.position, role: body.role ? body.role.toUpperCase() : u.role, active: body.active ?? u.active, updatedAt: nowIso() });
  return json(userToResponse(u));
});
route('PATCH', '/users/:id/password', async (p) => {
  const u = findUser(decodeURIComponent(p.id));
  if (!u) return errorJson('사용자를 찾을 수 없습니다', 404);
  u.passwordSet = true;
  return json({ message: '비밀번호가 재설정되었습니다', passwordSet: true });
});
route('PATCH', '/users/me/email-notification', async (_p, req) => {
  const body = await readBody(req);
  return json({ emailNotificationEnabled: body.emailEnabled ?? true });
});
route('DELETE', '/users/:id', async (p) => {
  const u = findUser(decodeURIComponent(p.id));
  if (!u) return errorJson('사용자를 찾을 수 없습니다', 404);
  u.active = false;
  return json({ message: '사용자가 비활성화되었습니다' });
});

// ============================== COMPANIES ==============================
route('GET', '/companies', async () => json(companies));
route('GET', '/companies/search', async (_p, _req, url) => {
  const kw = (url.searchParams.get('keyword') || '').toLowerCase();
  return json(companies.filter((c) => c.name.toLowerCase().includes(kw)));
});
route('GET', '/companies/:id', async (p) => {
  const c = companies.find((c) => c.id === Number(p.id));
  return c ? json(c) : errorJson('업체를 찾을 수 없습니다', 404);
});
route('POST', '/companies', async (_p, req) => {
  const body = await readBody(req);
  const newCompany = { id: genId(), status: 'active', createdAt: nowIso(), ...body };
  companies.push(newCompany);
  return json(newCompany, 201);
});
route('PUT', '/companies/:id', async (p, req) => {
  const idx = companies.findIndex((c) => c.id === Number(p.id));
  if (idx === -1) return errorJson('업체를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  companies[idx] = { ...companies[idx], ...body };
  return json(companies[idx]);
});
route('PATCH', '/companies/:id', async (p, req) => {
  const idx = companies.findIndex((c) => c.id === Number(p.id));
  if (idx === -1) return errorJson('업체를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  if (body.status) companies[idx].status = body.status;
  return json(companies[idx]);
});
route('DELETE', '/companies/:id', async (p) => {
  const idx = companies.findIndex((c) => c.id === Number(p.id));
  if (idx !== -1) companies.splice(idx, 1);
  return empty();
});

function subResourceRoutes(name: string, store: any[]) {
  route('GET', `/companies/:id/${name}`, async (p) => json(store.filter((x) => x.companyId === Number(p.id))));
  route('POST', `/companies/:id/${name}`, async (p, req) => {
    const body = await readBody(req);
    const item = { id: genId(), companyId: Number(p.id), ...body };
    store.push(item);
    return json(item, 201);
  });
  const idKey = name === 'contacts' ? 'contactId' : name === 'servers' ? 'serverId' : 'vpnId';
  route('PUT', `/companies/:id/${name}/:${idKey}`, async (p, req) => {
    const idx = store.findIndex((x) => x.id === Number((p as any)[idKey]));
    if (idx === -1) return errorJson('항목을 찾을 수 없습니다', 404);
    const body = await readBody(req);
    store[idx] = { ...store[idx], ...body };
    return json(store[idx]);
  });
  route('DELETE', `/companies/:id/${name}/:${idKey}`, async (p) => {
    const idx = store.findIndex((x) => x.id === Number((p as any)[idKey]));
    if (idx !== -1) store.splice(idx, 1);
    return empty();
  });
}
subResourceRoutes('contacts', contacts);
subResourceRoutes('servers', servers);
subResourceRoutes('vpn-accounts', vpnAccounts);

// ============================== MAINTENANCE ==============================
route('GET', '/maintenance', async () => json(maintenance));
route('GET', '/maintenance/search', async (_p, _req, url) => {
  const kw = (url.searchParams.get('keyword') || '').toLowerCase();
  return json(maintenance.filter((m) => m.title.toLowerCase().includes(kw)));
});
route('GET', '/maintenance/:id', async (p) => {
  const m = maintenance.find((m) => m.id === Number(p.id));
  return m ? json(m) : errorJson('유지보수 기록을 찾을 수 없습니다', 404);
});
route('POST', '/maintenance', async (_p, req) => {
  const body = await readBody(req);
  const assignedTo = body.assignedToId ? findUser(body.assignedToId)?.name ?? null : null;
  const record = { id: genId(), status: body.status || 'PENDING', priority: body.priority || 'MEDIUM', files: [], comments: [], statusHistory: [], createdAt: nowIso(), updatedAt: nowIso(), ...body, assignedTo };
  maintenance.push(record);
  return json(record, 201);
});
route('PUT', '/maintenance/:id', async (p, req) => {
  const idx = maintenance.findIndex((m) => m.id === Number(p.id));
  if (idx === -1) return errorJson('유지보수 기록을 찾을 수 없습니다', 404);
  const body = await readBody(req);
  const assignedTo = 'assignedToId' in body ? (body.assignedToId ? findUser(body.assignedToId)?.name ?? null : null) : maintenance[idx].assignedTo;
  maintenance[idx] = { ...maintenance[idx], ...body, assignedTo, updatedAt: nowIso() };
  return json(maintenance[idx]);
});
route('DELETE', '/maintenance/:id', async (p) => {
  const idx = maintenance.findIndex((m) => m.id === Number(p.id));
  if (idx !== -1) maintenance.splice(idx, 1);
  return empty();
});
route('POST', '/maintenance/:id/comments', async (p, req) => {
  const m = maintenance.find((m) => m.id === Number(p.id));
  if (!m) return errorJson('유지보수 기록을 찾을 수 없습니다', 404);
  const body = await readBody(req);
  const comment = { id: genId(), maintenanceId: m.id, content: body.content, createdAt: nowIso(), createdBy: body.createdBy || '', createdById: body.createdById || '' };
  m.comments.push(comment);
  return json(comment, 201);
});
route('DELETE', '/maintenance/comments/:commentId', async (p) => {
  for (const m of maintenance) {
    const idx = m.comments.findIndex((c: any) => c.id === Number(p.commentId));
    if (idx !== -1) { m.comments.splice(idx, 1); break; }
  }
  return empty();
});
route('POST', '/maintenance/:id/files', async (p, req) => {
  const m = maintenance.find((m) => m.id === Number(p.id));
  if (!m) return errorJson('유지보수 기록을 찾을 수 없습니다', 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  const f = { id: genId(), maintenanceId: m.id, filename: file?.name || 'file', fileUrl: `/mock-files/upload-${genId()}`, fileType: file?.type || 'application/octet-stream', size: file?.size || 0, uploadedAt: nowIso(), uploadedBy: '', uploadedById: '', isImage: !!file?.type.startsWith('image/'), version: 1 };
  m.files.push(f);
  return json(f, 201);
});
route('DELETE', '/maintenance/files/:fileId', async (p) => {
  for (const m of maintenance) {
    const idx = m.files.findIndex((f: any) => f.id === Number(p.fileId));
    if (idx !== -1) { m.files.splice(idx, 1); break; }
  }
  return empty();
});

// ============================== PROJECTS ==============================
route('GET', '/projects', async () => json(projects));
route('GET', '/projects/:id', async (p) => {
  const proj = projects.find((x) => x.id === Number(p.id));
  return proj ? json(proj) : errorJson('프로젝트를 찾을 수 없습니다', 404);
});
route('POST', '/projects', async (_p, req) => {
  const body = await readBody(req);
  const proj = { id: genId(), progress: 0, members: [], createdAt: nowIso(), updatedAt: nowIso(), ...body };
  projects.push(proj);
  tasks[proj.id] = []; milestones[proj.id] = []; documents[proj.id] = []; folders[proj.id] = [];
  return json(proj, 201);
});
route('PUT', '/projects/:id', async (p, req) => {
  const idx = projects.findIndex((x) => x.id === Number(p.id));
  if (idx === -1) return errorJson('프로젝트를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  projects[idx] = { ...projects[idx], ...body, updatedAt: nowIso() };
  return json(projects[idx]);
});
route('DELETE', '/projects/:id', async (p) => {
  const idx = projects.findIndex((x) => x.id === Number(p.id));
  if (idx !== -1) projects.splice(idx, 1);
  return empty();
});
route('PATCH', '/projects/:id/progress', async (p) => {
  const proj = projects.find((x) => x.id === Number(p.id));
  if (!proj) return errorJson('프로젝트를 찾을 수 없습니다', 404);
  const list = tasks[proj.id] || [];
  const done = list.filter((t) => t.status === 'DONE').length;
  proj.progress = list.length ? Math.round((done / list.length) * 100) : proj.progress;
  proj.updatedAt = nowIso();
  return json(proj);
});
route('PATCH', '/projects/:id/progress/manual', async (p, req) => {
  const proj = projects.find((x) => x.id === Number(p.id));
  if (!proj) return errorJson('프로젝트를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  proj.progress = body.progress ?? proj.progress;
  return json(proj);
});

// Tasks
route('GET', '/projects/:projectId/tasks', async (p) => json(tasks[Number(p.projectId)] || []));
route('GET', '/projects/tasks/:taskId', async (p) => {
  for (const list of Object.values(tasks)) {
    const t = list.find((x: any) => x.id === Number(p.taskId));
    if (t) return json(t);
  }
  return errorJson('작업을 찾을 수 없습니다', 404);
});
route('POST', '/projects/:projectId/tasks', async (p, req) => {
  const body = await readBody(req);
  const projectId = Number(p.projectId);
  const t = { id: genId(), projectId, status: 'TODO', priority: 'MEDIUM', labels: [], attachments: [], checklistItems: [], comments: [], createdAt: nowIso(), updatedAt: nowIso(), ...body };
  tasks[projectId] = [...(tasks[projectId] || []), t];
  return json(t, 201);
});
route('PATCH', '/projects/tasks/:taskId', async (p, req) => {
  const body = await readBody(req);
  for (const key of Object.keys(tasks)) {
    const idx = tasks[Number(key)].findIndex((x: any) => x.id === Number(p.taskId));
    if (idx !== -1) {
      tasks[Number(key)][idx] = { ...tasks[Number(key)][idx], ...body, updatedAt: nowIso() };
      return json(tasks[Number(key)][idx]);
    }
  }
  return errorJson('작업을 찾을 수 없습니다', 404);
});
route('DELETE', '/projects/tasks/:taskId', async (p) => {
  for (const key of Object.keys(tasks)) {
    const idx = tasks[Number(key)].findIndex((x: any) => x.id === Number(p.taskId));
    if (idx !== -1) { tasks[Number(key)].splice(idx, 1); break; }
  }
  return empty();
});
route('POST', '/projects/tasks/:taskId/checklist', async (p, req) => {
  const body = await readBody(req);
  const item = { id: genId(), text: body.text, completed: false };
  return json(item, 201);
});
route('PATCH', '/projects/checklist/:itemId/toggle', async () => json({ completed: true, completedBy: null, completedAt: nowIso() }));
route('POST', '/projects/tasks/:taskId/comments', async (p, req) => {
  const body = await readBody(req);
  return json({ id: genId(), taskId: Number(p.taskId), content: body.content, authorId: '', authorName: '', createdAt: nowIso() }, 201);
});

// Issues
route('GET', '/projects/:projectId/issues', async (p) => json(issues.filter((i) => i.projectId === Number(p.projectId))));
route('POST', '/projects/issues', async (_p, req) => {
  const body = await readBody(req);
  const issue = { id: genId(), status: 'OPEN', attachments: [], createdAt: nowIso(), updatedAt: nowIso(), ...body };
  issues.push(issue);
  return json(issue, 201);
});
route('PATCH', '/projects/issues/:issueId', async (p, req) => {
  const idx = issues.findIndex((i) => i.id === Number(p.issueId));
  if (idx === -1) return errorJson('이슈를 찾을 수 없습니다', 404);
  const body = await readBody(req);
  issues[idx] = { ...issues[idx], ...body, updatedAt: nowIso() };
  return json(issues[idx]);
});
route('DELETE', '/projects/issues/:issueId', async (p) => {
  const idx = issues.findIndex((i) => i.id === Number(p.issueId));
  if (idx !== -1) issues.splice(idx, 1);
  return empty();
});
route('POST', '/projects/issues/:issueId/resolve', async (p) => {
  const issue = issues.find((i) => i.id === Number(p.issueId));
  if (!issue) return errorJson('이슈를 찾을 수 없습니다', 404);
  issue.status = 'RESOLVED'; issue.resolvedAt = nowIso(); issue.updatedAt = nowIso();
  return json(issue);
});
route('POST', '/projects/issues/:issueId/close', async (p) => {
  const issue = issues.find((i) => i.id === Number(p.issueId));
  if (!issue) return errorJson('이슈를 찾을 수 없습니다', 404);
  issue.status = 'CLOSED'; issue.closedAt = nowIso(); issue.updatedAt = nowIso();
  return json(issue);
});

// Timeline & milestones
route('GET', '/projects/:projectId/timeline', async (p) => json(timelineByProject[Number(p.projectId)] || []));
route('GET', '/projects/:projectId/milestones', async (p) => json(milestones[Number(p.projectId)] || []));
route('POST', '/projects/:projectId/milestones', async (p, req) => {
  const body = await readBody(req);
  const projectId = Number(p.projectId);
  const m = { id: genId(), projectId, milestoneStatus: body.status || 'upcoming', milestoneDate: body.date, title: body.title, description: body.description, actorId: '', actorName: '', createdAt: nowIso() };
  milestones[projectId] = [...(milestones[projectId] || []), m];
  return json(m, 201);
});
route('PATCH', '/projects/milestones/:milestoneId', async (p, req) => {
  const body = await readBody(req);
  for (const key of Object.keys(milestones)) {
    const idx = milestones[Number(key)].findIndex((x: any) => x.id === Number(p.milestoneId));
    if (idx !== -1) {
      const updated = { ...milestones[Number(key)][idx], ...body, milestoneStatus: body.status || milestones[Number(key)][idx].milestoneStatus, projectId: Number(key) };
      milestones[Number(key)][idx] = updated;
      return json(updated);
    }
  }
  return errorJson('마일스톤을 찾을 수 없습니다', 404);
});
route('DELETE', '/projects/milestones/:milestoneId', async (p) => {
  for (const key of Object.keys(milestones)) {
    const idx = milestones[Number(key)].findIndex((x: any) => x.id === Number(p.milestoneId));
    if (idx !== -1) { milestones[Number(key)].splice(idx, 1); break; }
  }
  return empty();
});

// Documents & folders
route('GET', '/projects/:projectId/documents', async (p) => json(documents[Number(p.projectId)] || []));
route('POST', '/projects/:projectId/documents', async (p, req) => {
  const projectId = Number(p.projectId);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  const folder = form?.get('folder') as string | null;
  const doc = { id: genId(), projectId, fileName: file?.name || 'file', fileUrl: `/mock-files/doc-${genId()}`, fileType: file?.type || '', fileSize: file?.size || 0, folderName: folder || null, uploadedBy: '', uploadedByName: '', uploadedAt: nowIso() };
  documents[projectId] = [...(documents[projectId] || []), doc];
  return json(doc, 201);
});
route('DELETE', '/projects/:projectId/documents/:documentId', async (p) => {
  const projectId = Number(p.projectId);
  documents[projectId] = (documents[projectId] || []).filter((d: any) => d.id !== Number(p.documentId));
  return empty();
});
route('PATCH', '/projects/:projectId/documents/:documentId/rename', async (p, req) => {
  const projectId = Number(p.projectId);
  const body = await readBody(req);
  const doc = (documents[projectId] || []).find((d: any) => d.id === Number(p.documentId));
  if (!doc) return errorJson('문서를 찾을 수 없습니다', 404);
  doc.fileName = body.name;
  return json(doc);
});
route('GET', '/projects/:projectId/folders', async (p) => json((folders[Number(p.projectId)] || []).map((name) => ({ name }))));
route('POST', '/projects/:projectId/folders', async (p, req) => {
  const projectId = Number(p.projectId);
  const body = await readBody(req);
  folders[projectId] = [...(folders[projectId] || []), body.name];
  return json({ name: body.name }, 201);
});
route('PATCH', '/projects/:projectId/folders/rename', async (p, req) => {
  const projectId = Number(p.projectId);
  const body = await readBody(req);
  folders[projectId] = (folders[projectId] || []).map((n) => (n === body.oldName ? body.newName : n));
  return json({ ok: true });
});
route('DELETE', '/projects/:projectId/folders', async (p, _req, url) => {
  const projectId = Number(p.projectId);
  const name = url.searchParams.get('name');
  folders[projectId] = (folders[projectId] || []).filter((n) => n !== name);
  return empty();
});

// ============================== AUDIT LOGS ==============================
route('GET', '/audit-logs', async (_p, _req, url) => {
  let list = auditLogs;
  const userId = url.searchParams.get('userId');
  const action = url.searchParams.get('action');
  const resourceType = url.searchParams.get('resourceType');
  if (userId) list = list.filter((l) => l.userId === userId);
  if (action) list = list.filter((l) => l.action === action);
  if (resourceType) list = list.filter((l) => l.resourceType === resourceType);
  return json(list);
});
route('GET', '/audit-logs/stats', async () => json({
  total: auditLogs.length,
  byAction: auditLogs.reduce((acc: Record<string, number>, l) => { acc[l.action] = (acc[l.action] || 0) + 1; return acc; }, {}),
}));
route('POST', '/audit-logs', async (_p, req) => {
  const body = await readBody(req);
  const log = { id: genId(), timestamp: nowIso(), ...body };
  auditLogs.unshift(log);
  return json(log);
});
route('DELETE', '/audit-logs', async () => { auditLogs.length = 0; return empty(); });

// ============================== ROLE PERMISSIONS ==============================
route('GET', '/role-permissions', async () => json({ permissions: rolePermissions, roles }));
route('PUT', '/role-permissions', async (_p, req) => {
  const body = await readBody(req);
  rolePermissions = body.permissions ?? rolePermissions;
  roles = body.roles ?? roles;
  return empty();
});

// ============================== REPORT TEMPLATES ==============================
route('GET', '/report-templates', async () => json(reportTemplates));
route('GET', '/report-templates/:id', async (p) => {
  const t = reportTemplates.find((t) => t.id === p.id);
  return t ? json(t) : errorJson('템플릿을 찾을 수 없습니다', 404);
});
route('POST', '/report-templates', async (_p, req) => {
  const body = await readBody(req);
  const t = { id: `tpl-${genId()}`, isShared: false, createdBy: '', createdByName: '', createdAt: nowIso(), updatedAt: nowIso(), ...body };
  reportTemplates.unshift(t);
  return json(t);
});
route('PUT', '/report-templates/:id', async (p, req) => {
  const idx = reportTemplates.findIndex((t) => t.id === p.id);
  if (idx === -1) return errorJson('템플릿을 찾을 수 없습니다', 404);
  const body = await readBody(req);
  reportTemplates[idx] = { ...reportTemplates[idx], ...body, updatedAt: nowIso() };
  return json(reportTemplates[idx]);
});
route('DELETE', '/report-templates/:id', async (p) => {
  const idx = reportTemplates.findIndex((t) => t.id === p.id);
  if (idx !== -1) reportTemplates.splice(idx, 1);
  return empty();
});

// ============================== COLLABORATION (간단 정적 샘플) ==============================
route('GET', '/collaboration/channels', async () => json(channels));
route('POST', '/collaboration/channels', async (_p, req) => {
  const body = await readBody(req);
  const c = { id: genId(), memberIds: body.members || [], isArchived: false, pinnedMessages: [], createdAt: nowIso(), updatedAt: nowIso(), ...body };
  channels.push(c);
  messages[c.id] = [];
  return json(c, 201);
});
route('PATCH', '/collaboration/channels/:id', async (p, req) => {
  const c = channels.find((c) => c.id === Number(p.id));
  if (!c) return errorJson('채널을 찾을 수 없습니다', 404);
  Object.assign(c, await readBody(req), { updatedAt: nowIso() });
  return json(c);
});
route('DELETE', '/collaboration/channels/:id', async (p) => {
  const idx = channels.findIndex((c) => c.id === Number(p.id));
  if (idx !== -1) channels.splice(idx, 1);
  return empty();
});
route('GET', '/collaboration/channels/:channelId/messages', async (p) => json(messages[Number(p.channelId)] || []));
route('POST', '/collaboration/messages', async (_p, req) => {
  const body = await readBody(req);
  const m = { id: genId(), isEdited: false, isPinned: false, isDeleted: false, mentions: body.mentions || [], createdAt: nowIso(), ...body };
  const channelId = Number(body.channelId);
  messages[channelId] = [...(messages[channelId] || []), m];
  return json(m, 201);
});
route('PUT', '/collaboration/messages/:id', async (p, req) => {
  const body = await readBody(req);
  for (const list of Object.values(messages)) {
    const m = list.find((x: any) => x.id === Number(p.id));
    if (m) { m.content = body.content; m.isEdited = true; m.editedAt = nowIso(); return json(m); }
  }
  return errorJson('메시지를 찾을 수 없습니다', 404);
});
route('DELETE', '/collaboration/messages/:id', async () => empty());
route('POST', '/collaboration/messages/:id/pin', async () => empty());
route('DELETE', '/collaboration/messages/:id/pin', async () => empty());
route('POST', '/collaboration/channels/:channelId/members/:userId', async () => empty());
route('DELETE', '/collaboration/channels/:channelId/members/:userId', async () => empty());

// ============================== 파일/OCR/PPT/Excel/DWG — 정적 샘플 ==============================
route('POST', '/files/inline-image', async () => json({ url: '/mock-files/inline-sample.png' }));
route('POST', '/ocr/extract', async () => json({ jobId: 'mock-ocr-1', status: 'PROCESSING' }));
route('GET', '/ocr/status/:jobId', async () => json({ status: 'COMPLETED', progress: 100 }));
route('GET', '/ocr/result/:jobId', async () => json({ status: 'COMPLETED', text: '(데모 모드) OCR 추출 결과 샘플 텍스트입니다.', pages: 1 }));
route('DELETE', '/ocr/:jobId', async () => empty());
route('POST', '/ppt/convert-to-pdf', async () => new Response(new Blob(['mock pdf']), { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
route('POST', '/dwg/convert-to-image', async () => json({ imageUrl: '/mock-files/dwg-sample.png' }));
route('POST', '/excel/get-sheets', async () => json({ sheets: ['Sheet1'] }));
route('POST', '/excel/convert-to-html', async () => json({ html: '<table><tr><td>(데모) 엑셀 미리보기 샘플</td></tr></table>' }));
route('GET', '/address/search', async () => json({ results: [] }));

// ============================== 라우터 진입점 ==============================
function normalizePath(rawUrl: string): { pathname: string; url: URL } {
  const url = new URL(rawUrl, window.location.origin);
  let pathname = url.pathname;
  // '/api' 프리픽스 제거 (VITE_API_URL이 '/api' 또는 'http://host/api' 형태이므로)
  pathname = pathname.replace(/^\/api/, '');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  return { pathname, url };
}

export async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : new Request(input.toString(), init);
  const rawUrl = input instanceof Request ? input.url : input.toString();
  const method = (init?.method || req.method || 'GET').toUpperCase();

  // 외부 리소스(카카오맵 SDK 등 절대 URL 중 우리 origin이 아닌 것)는 실제 fetch로 통과
  const isAbsoluteExternal = /^https?:\/\//.test(rawUrl) && !rawUrl.startsWith(window.location.origin) && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1');
  if (isAbsoluteExternal) {
    return window.__originalFetch__(input as any, init);
  }

  const { pathname, url } = normalizePath(rawUrl);

  // 업로드/미리보기 파일 요청 — 실제 파일이 없으므로 간단한 플레이스홀더 반환
  if (pathname.startsWith('/uploads') || pathname.startsWith('/mock-files')) {
    return new Response(new Blob(['(데모 모드) 샘플 파일입니다. 실제 파일 저장소가 연결되어 있지 않습니다.'], { type: 'text/plain' }), { status: 200 });
  }

  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = m[i + 1]));
    try {
      return await r.handler(params, req, url);
    } catch (e) {
      console.error('[mockFetch] handler error', pathname, e);
      return errorJson('목업 서버 오류', 500);
    }
  }

  console.warn('[mockFetch] 처리되지 않은 요청 — 빈 응답 반환:', method, pathname);
  return json(method === 'GET' ? [] : { message: '(데모 모드) 처리되지 않은 요청입니다.' });
}

declare global {
  interface Window { __originalFetch__: typeof fetch; __mockFetchInstalled__?: boolean; }
}

export function installMockFetch() {
  if (typeof window === 'undefined' || window.__mockFetchInstalled__) return;
  window.__originalFetch__ = window.fetch.bind(window);
  window.fetch = mockFetch as typeof fetch;
  window.__mockFetchInstalled__ = true;
  console.info('[mock] 데모 모드 활성화 — 모든 API 요청은 목업 데이터로 응답합니다.');
}
