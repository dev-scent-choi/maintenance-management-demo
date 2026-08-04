export interface ProjectAssignment {
  projectName: string;
  role: 'admin' | 'pm' | 'assignee' | 'readonly';
  workType: 'maintenance' | 'installation' | 'repair' | 'inspection';
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  phone: string;
  department: string;
  position: string;
  profileImage?: string;
  projectAssignments: ProjectAssignment[];
  accountStatus: 'active' | 'inactive' | 'suspended';
}

export interface SourceControl {
  type: 'svn' | 'git';
  url: string;
  username: string;
  password: string;
}

export interface DocumentStorage {
  type: 'nas' | 'cloud' | 'svn';
  url: string;
  path: string;
}

export interface ProjectMember {
  name: string;
  role: string;
  startDate: string;
  endDate: string;
}

export interface Company {
  id: string;
  name: string;
  businessNumber: string;
  representative: string;
  contact: string;
  contactRole?: string;
  email: string;
  companyEmail?: string;
  phone: string;
  mobile?: string;
  address: string;
  logoUrl?: string;
  notes: string;
  projectStartDate: string;
  projectEndDate: string;
  projectStatus: 'active' | 'completed' | 'onHold';
  contractStatus?: 'maintenance' | 'project' | 'ended';
  maintenanceContract: boolean;
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  maintenanceCycle: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  maintenanceType: 'onsite' | 'remote' | 'hybrid';
  remoteAccessMethod: string;
  assignedManagerId?: string;
  assignedManagerName?: string;
  projectMembers: ProjectMember[];
  sourceControl: SourceControl;
  documentStorage: DocumentStorage;
  status?: 'active' | 'inactive'; // 업체 활성화 상태
  createdAt: Date;
}

export interface StatusHistory {
  id: string;
  status: 'pending' | 'in-progress' | 'completed' | 'urgent' | 'on-hold';
  comment: string;
  changedAt: Date;
  changedBy: string;
  changedById: string;
}

export interface PriorityHistory {
  id: string;
  previousPriority: 'low' | 'medium' | 'high' | 'urgent';
  newPriority: 'low' | 'medium' | 'high' | 'urgent';
  comment: string;
  changedAt: Date;
  changedBy: string;
  changedById: string;
}

export interface MaintenanceRecord {
  id: string;
  companyId?: string;
  companyName: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'urgent' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedToName?: string;
  assignedToId?: string;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  expectedCompletionDate?: Date;
  actualCompletionDate?: Date;
  requestDate?: Date;
  completedDate?: Date;
  scheduledDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  category?: string;
  workType?: string;
  requesterName?: string;
  completionResult?: string;
  testStatus?: string;
  deploymentLocation?: string;
  files: MaintenanceFile[];
  comments: MaintenanceComment[];
  attachments?: MaintenanceFile[];
  createdBy?: string;
  statusHistory?: StatusHistory[];
  priorityHistory?: PriorityHistory[];
}

export interface MaintenanceFile {
  id: string;
  maintenanceId: string;
  filename: string;
  fileUrl: string;
  fileType: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedById: string;
  isImage: boolean;
  version: number;
  versions?: FileVersion[];
  canEdit?: boolean;
  file?: File; // 신규 등록 시 업로드용 원본 File 객체
}

export interface FileVersion {
  versionNumber: number;
  fileUrl: string;
  modifiedAt: Date;
  modifiedBy: string;
  modifiedById: string;
  changeDescription?: string;
  size: number;
}

export interface MaintenanceComment {
  id: string;
  maintenanceId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  createdById: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'download' | 'upload';
  resourceType: 'user' | 'company' | 'maintenance' | 'project' | 'file' | 'system';
  resourceId?: string;
  resourceName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'maintenance_created' | 'maintenance_assigned' | 'maintenance_status_changed' | 'maintenance_completed' | 'user_created' | 'user_updated' | 'company_created' | 'company_updated' | 'system_alert' | 'task_assigned' | 'system';
  title: string;
  message: string;
  relatedResourceType?: 'maintenance' | 'user' | 'company' | 'project' | 'task';
  relatedResourceId?: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  priority: 'low' | 'normal' | 'high';
  actionUrl?: string;
}

export interface NotificationSettings {
  userId: string;
  emailEnabled: boolean;
  webEnabled: boolean;
  notificationTypes: {
    maintenanceCreated: boolean;
    maintenanceAssigned: boolean;
    maintenanceStatusChanged: boolean;
    maintenanceCompleted: boolean;
    userChanges: boolean;
    companyChanges: boolean;
    systemAlerts: boolean;
  };
  emailAddress?: string;
}

// 협업 기능 타입 정의

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'direct';
  projectId?: string;
  companyId?: string;
  members: string[]; // User IDs
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  isArchived: boolean;
  pinnedMessages?: string[]; // Message IDs
}

export interface Message {
  id: string;
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: Date;
  updatedAt?: Date;
  editedAt?: Date;
  isEdited: boolean;
  replyToId?: string; // Thread/Reply 기능
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  mentions: string[]; // User IDs
  isPinned: boolean;
  isDeleted: boolean;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'video' | 'link';
  name: string;
  url: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

export interface ChannelMember {
  userId: string;
  channelId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  lastReadAt?: Date;
  isMuted: boolean;
  notificationLevel: 'all' | 'mentions' | 'none';
}

export interface Thread {
  id: string;
  parentMessageId: string;
  channelId: string;
  replyCount: number;
  participants: string[]; // User IDs
  lastReplyAt: Date;
}

export interface TypingIndicator {
  channelId: string;
  userId: string;
  userName: string;
  startedAt: Date;
}

// 프로젝트 관리 타입 정의

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  folderName?: string | null;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  channelId?: string; // 연결된 채널
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  companyId?: string; // 업체 ID
  companyName?: string; // 업체명
  managerName?: string; // 담당 PM 이름
  ownerId: string;
  memberIds: string[];
  documents?: ProjectDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string | null;
  reporterId: string;
  dueDate?: Date;
  completedAt?: Date;
  estimatedHours?: number;
  actualHours?: number;
  weight?: number; // 작업 가중치 (진행률 계산용)
  tags: string[];
  checklistItems: ChecklistItem[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Issue {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'bug' | 'issue' | 'question' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity?: 'minor' | 'major' | 'critical' | 'blocker';
  assigneeId?: string | null;
  reporterId: string;
  labels: string[];
  dueDate?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

// 업체 담당자 (복수)
export interface CompanyContact {
  id: string;
  companyId: string;
  name: string;
  role: string;       // 역할/직책
  phone?: string;
  mobile?: string;
  email?: string;
  notes?: string;
}

// 서버 접속 정보
export type ServerType =
  | 'windows' | 'linux' | 'mac'
  | 'mysql' | 'mssql' | 'oracle' | 'postgresql' | 'mariadb' | 'mongodb' | 'redis'
  | 'other';

export interface ServerInfo {
  id: string;
  companyId: string;
  name: string;          // 서버명
  serverType: ServerType;
  hostname: string;      // IP 또는 호스트명
  port?: number;
  osVersion?: string;    // OS 버전
  dbName?: string;       // DB명 (DB 서버)
  username: string;
  password: string;
  description?: string;
  notes?: string;
}

// VPN 접속 정보
export interface VpnAccount {
  id: string;
  companyId: string;
  name: string;          // 계정명/설명
  vpnType: string;       // Cisco, FortiClient, OpenVPN, 기타
  server: string;        // VPN 서버 주소
  port?: number;
  username: string;
  password: string;
  notes?: string;
}

export interface Timeline {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: 'milestone' | 'event' | 'deadline' | 'release';
  date: Date;
  status: 'upcoming' | 'in_progress' | 'completed' | 'missed';
  relatedTaskIds: string[];
  createdBy: string;
  actorName?: string; // 액션 수행자 이름
  createdAt: Date;
}
