import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Hash, Lock, Users, Plus, Search, MoreVertical, Pin, Paperclip, Send, Smile, Edit2, Trash2, Reply, X } from 'lucide-react';
import { useCollaborationStore } from '../store/collaborationStore';
import { useAuthStore } from '../store/authStore';
import { isAdminAccount } from '../utils/permissions';
import { useSettingsStore } from '../store/settingsStore';
import { useMaintenanceStore } from '../store/maintenanceStore';
import { themeConfigs } from '../utils/themeConfig';
import { useToast } from '../hooks/useToast';
import ProtectedComponent from '../components/ProtectedComponent';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useLanguage } from '../contexts/LanguageContext';
import type { Channel, Message } from '../types';

const Collaboration: React.FC = () => {
  const { user } = useAuthStore();
  const theme = useSettingsStore((state) => state.settings.theme);
  const themeColors = themeConfigs[theme];
  const isDark = theme !== 'light';
  const toast = useToast();
  const t = useLanguage();

  const {
    channels,
    messages,
    channelMembers,
    currentChannelId,
    setCurrentChannel,
    fetchChannels,
    fetchMessages,
    addChannel,
    updateChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteChannel,
    pinMessage,
    unpinMessage,
    addReaction,
    markChannelAsRead,
    getUnreadCount,
    addMemberToChannel,
    removeMemberFromChannel,
    isLoading,
    loadingChannelId,
  } = useCollaborationStore();

  const messagesLoading = !!currentChannelId && loadingChannelId === currentChannelId;

  const { users, fetchUsers } = useMaintenanceStore();

  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [messageInput, setMessageInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = (messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  const currentChannel = channels.find((c) => c.id === currentChannelId);
  const currentMessages = currentChannelId ? (messages[currentChannelId] || []) : [];
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [isEditingChannel, setIsEditingChannel] = useState(false);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDescription, setEditChannelDescription] = useState('');

  const handleSaveChannel = async () => {
    if (!currentChannelId || !editChannelName.trim()) return;
    try {
      await updateChannel(currentChannelId, { name: editChannelName, description: editChannelDescription });
      setIsEditingChannel(false);
      toast.success('채널 정보가 수정됐습니다.');
    } catch {
      toast.error('채널 수정에 실패했습니다.');
    }
  };

  // 컴포넌트 마운트 시 채널 목록 및 사용자 목록 불러오기
  useEffect(() => {
    fetchChannels();
    fetchUsers();
    setCurrentChannel(null); // 진입 시 항상 초기 화면
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 채널 변경 시 메시지 불러오기
  useEffect(() => {
    if (currentChannelId) {
      fetchMessages(currentChannelId);
    }
  }, [currentChannelId, fetchMessages]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // 이모티콘 피커 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error(t('channelNameRequired'));
      return;
    }

    if (!user) return;

    try {
      await addChannel({
        name: newChannelName,
        description: newChannelDescription,
        type: newChannelType,
        members: [user.id, ...selectedMembers],
        createdBy: user.id,
        isArchived: false,
      });

      setShowNewChannelModal(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setSelectedMembers([]);
      toast.success(t('channelCreated'));
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast.error(t('channelCreateFailed') || '채널 생성에 실패했습니다.');
    }
  };

  const handleAddMembers = () => {
    if (!currentChannelId || selectedNewMembers.length === 0) {
      toast.error(t('selectMembersToAdd'));
      return;
    }

    selectedNewMembers.forEach((userId) => {
      addMemberToChannel(currentChannelId, userId, 'member');
    });

    setShowAddMemberModal(false);
    setSelectedNewMembers([]);
    toast.success(t('membersAdded', { count: selectedNewMembers.length }));
  };

  const handleDeleteChannel = async () => {
    if (!currentChannelId) return;

    if (!window.confirm(t('deleteChannelConfirm'))) return;

    try {
      await deleteChannel(currentChannelId);
      setShowChannelSettings(false);
      toast.success(t('channelDeleted'));
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast.error(t('channelDeleteFailed'));
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentChannelId || !user) return;

    if (editingMessageId) {
      try {
        await editMessage(editingMessageId, messageInput);
        setEditingMessageId(null);
        toast.success(t('messageEdited'));
      } catch {
        toast.error(t('messageEditFailed') || '메시지 수정에 실패했습니다.');
      }
      setMessageInput('');
      return;
    } else {
      // 멘션 추출 (@username)
      const mentions: string[] = [];
      const mentionRegex = /@(\w+)/g;
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(messageInput)) !== null) {
        const mentionedUser = users.find((u) => u.name === match![1]);
        if (mentionedUser) {
          mentions.push(mentionedUser.id);
        }
      }

      sendMessage({
        channelId: currentChannelId,
        content: messageInput,
        senderId: user.id,
        senderName: user.name,
        attachments: [],
        mentions,
        replyToId: replyingTo?.id,
      });

      if (replyingTo) {
        setReplyingTo(null);
      }
    }

    setMessageInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentChannelId || !user) return;

    // 파일 업로드 로직 (실제로는 서버에 업로드 후 URL 받아옴)
    const file = files[0];
    const fileUrl = URL.createObjectURL(file);

    sendMessage({
      channelId: currentChannelId,
      content: t('fileUploaded', { fileName: file.name }),
      senderId: user.id,
      senderName: user.name,
      attachments: [
        {
          id: Date.now().toString(),
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          url: fileUrl,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date(),
        },
      ],
      mentions: [],
    });

    toast.success(t('fileUploadSuccess'));
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!currentChannelId || !user) return;
    addReaction(messageId, currentChannelId, emoji, user.id);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { count: minutes });
    if (hours < 24) return t('hoursAgo', { count: hours });
    if (days < 7) return t('daysAgo', { count: days });
    return new Date(date).toLocaleDateString();
  };

  return (
    <ProtectedComponent permission="view_collaboration">
      <div className="flex h-full overflow-hidden">
      <div className="flex h-full overflow-hidden w-full">
      {/* 채널 사이드바 */}
      <div
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          backgroundColor: themeColors.surface,
          borderRight: `1px solid ${themeColors.border}`,
        }}
      >
        {/* 채널 헤더 (검색) */}
        <div className="px-4 h-14 flex items-center flex-shrink-0" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={16} style={{ color: themeColors.textSecondary }} />
            <input
              type="text"
              placeholder={t('searchChannel')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${themeColors.border}`,
                color: themeColors.text,
              }}
            />
          </div>
        </div>

        {/* 채널 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.textSecondary }}>
              {t('channel')}
            </span>
            <button
              onClick={() => !isLoading && setShowNewChannelModal(true)}
              className="p-1 rounded hover:opacity-70 transition-all"
              style={{ color: themeColors.textSecondary, opacity: isLoading ? 0.3 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              title="새 채널 만들기"
              disabled={isLoading}
            >
              <Plus size={14} />
            </button>
          </div>
          {channels
            .filter((channel) => channel.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((channel) => {
              const unreadCount = user ? getUnreadCount(channel.id, user.id) : 0;
              const isActive = channel.id === currentChannelId;

              return (
                <button
                  key={channel.id}
                  onClick={() => {
                    if (channel.id === currentChannelId) return;
                    setCurrentChannel(channel.id);
                    if (user) markChannelAsRead(channel.id, user.id);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded mb-1 transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: isActive
                      ? themeColors.primary
                      : theme === 'dark'
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)',
                    color: isActive ? '#fff' : themeColors.text,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {channel.type === 'private' ? (
                      <Lock size={16} />
                    ) : channel.type === 'direct' ? (
                      <MessageSquare size={16} />
                    ) : (
                      <Hash size={16} />
                    )}
                    <span className="font-medium truncate">{channel.name}</span>
                  </div>
                  {unreadCount > 0 && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ backgroundColor: '#ef4444', color: '#fff' }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}

          {!isLoading && channels.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center">
              <MessageSquare size={48} className="mx-auto mb-4" style={{ color: themeColors.textSecondary, opacity: 0.5 }} />
              <p className="text-sm font-medium" style={{ color: themeColors.text }}>
                {t('noChannels')}
              </p>
              <p className="text-xs mt-1 mb-4" style={{ color: themeColors.textSecondary }}>
                {t('createNewChannel')}
              </p>
              <button
                onClick={() => setShowNewChannelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}>
                <Plus size={15} />
                {t('createChannel')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentChannel ? (
          <>
            {/* 채널 헤더 */}
            <div
              className="px-4 h-14 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: `1px solid ${themeColors.border}` }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  {currentChannel.type === 'private' ? (
                    <Lock size={20} style={{ color: themeColors.text }} />
                  ) : currentChannel.type === 'direct' ? (
                    <MessageSquare size={20} style={{ color: themeColors.text }} />
                  ) : (
                    <Hash size={20} style={{ color: themeColors.text }} />
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold truncate" style={{ color: themeColors.text }}>
                    {currentChannel.name}
                  </h3>
                  {currentChannel.description && (
                    <span className="text-sm truncate" style={{ color: themeColors.textSecondary }}>
                      · {currentChannel.description}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChannelSettings(!showChannelSettings)}
                  className="p-2 rounded-lg hover:opacity-80 transition-all"
                  style={{
                    backgroundColor: showChannelSettings ? themeColors.primary : 'transparent',
                    color: showChannelSettings ? '#fff' : themeColors.text,
                  }}
                  title={t('channelSettings')}
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 relative overflow-hidden">
              {messagesLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-xl"
                    style={{
                      backgroundColor: themeColors.surface,
                      border: `1px solid ${themeColors.border}`,
                      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.08)',
                    }}>
                    <svg className="animate-spin" style={{ width: '1.75rem', height: '1.75rem', color: themeColors.primary }} viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12h-4z" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>불러오는 중...</span>
                  </div>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="absolute inset-0 flex flex-col justify-end p-4 pb-2">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 mb-1">
                      {currentChannel?.type === 'private' ? (
                        <Lock size={18} style={{ color: themeColors.textSecondary, opacity: 0.5 }} />
                      ) : (
                        <Hash size={18} style={{ color: themeColors.textSecondary, opacity: 0.5 }} />
                      )}
                      <span className="text-base font-bold" style={{ color: themeColors.text }}>{currentChannel?.name}</span>
                    </div>
                    <p className="text-sm" style={{ color: themeColors.textSecondary }}>
                      <span className="font-semibold" style={{ color: themeColors.text }}>#{currentChannel?.name}</span>{' '}{t('channelWelcomeText')}
                    </p>
                  </div>
                </div>
              ) : (
              <div className="absolute inset-0 overflow-y-auto p-4 space-y-4">
              {currentMessages.map((message) => {
                const isMine = message.senderId === user?.id;

                return (
                  <div
                    key={message.id}
                    ref={(el) => { if (el) messageRefs.current.set(message.id, el); else messageRefs.current.delete(message.id); }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} transition-all duration-300`}
                    style={highlightedMessageId === message.id ? { backgroundColor: `${themeColors.primary}18`, borderRadius: '12px', padding: '4px' } : {}}
                  >
                    <div className={`max-w-2xl ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* 보낸 사람 및 시간 */}
                      {!isMine && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base" style={{ color: themeColors.text }}>
                            {message.senderName}
                          </span>
                          <span className="text-sm" style={{ color: themeColors.textSecondary }}>
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* 답장 표시 */}
                      {message.replyToId && (
                        <div
                          className="text-xs px-3 py-1 rounded mb-1"
                          style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: themeColors.textSecondary }}
                        >
                          <Reply size={12} className="inline mr-1" />
                          {t('reply')}
                        </div>
                      )}

                      {/* 메시지 내용 */}
                      <div
                        className="px-4 py-3 rounded"
                        style={{
                          backgroundColor: isMine ? themeColors.primary : theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          color: isMine ? '#fff' : themeColors.text,
                          fontSize: '1rem',
                        }}
                      >
                        {message.isDeleted ? (
                          <p className="italic opacity-50">{message.content}</p>
                        ) : (
                          <p>{message.content}</p>
                        )}
                        {message.isEdited && !message.isDeleted && (
                          <span className="text-sm opacity-70 ml-2">({t('edited')})</span>
                        )}

                        {/* 첨부 파일 */}
                        {message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((attachment) => (
                              <div key={attachment.id}>
                                {attachment.type === 'image' ? (
                                  <img
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className="rounded-lg max-w-sm"
                                  />
                                ) : (
                                  <a
                                    href={attachment.url}
                                    download={attachment.name}
                                    className="flex items-center gap-2 p-2 rounded hover:opacity-80"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
                                  >
                                    <Paperclip size={16} />
                                    <span className="text-sm">{attachment.name}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 리액션 */}
                      {message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.reactions.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              onClick={() => handleReaction(message.id, reaction.emoji)}
                              className="px-2 py-1 rounded-full text-sm hover:opacity-80"
                              style={{
                                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                color: themeColors.text,
                              }}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 메시지 액션 버튼 (본인 메시지만) */}
                      {isMine && !message.isDeleted && (
                        <div className="flex gap-0 mt-1">
                          <button
                            onClick={() => {
                              setEditingMessageId(message.id);
                              setMessageInput(message.content);
                            }}
                            className="p-1 hover:opacity-80"
                            style={{ color: themeColors.textSecondary }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="p-1 hover:opacity-80"
                            style={{ color: themeColors.textSecondary }}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                if (message.isPinned) {
                                  unpinMessage(message.id, currentChannelId!);
                                } else {
                                  await pinMessage(message.id, currentChannelId!);
                                  toast.success(t('messagePinned') || '메시지가 고정됐습니다.');
                                }
                              } catch {
                                toast.error(t('messagePinFailed') || '고정에 실패했습니다.');
                              }
                            }}
                            className="p-1 hover:opacity-80"
                            style={{ color: message.isPinned ? themeColors.primary : themeColors.textSecondary }}
                            title={message.isPinned ? (t('unpin') || '고정 해제') : (t('pin') || '고정')}
                          >
                            <Pin size={16} />
                          </button>
                        </div>
                      )}

                      {isMine && (
                        <span className="text-sm mt-1" style={{ color: themeColors.textSecondary }}>
                          {formatTime(message.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            )}
            </div>

            {/* 입력 영역 */}
            <div className="p-4 flex-shrink-0" style={{ borderTop: `1px solid ${themeColors.border}` }}>
              {/* 수정 중 표시 */}
              {editingMessageId && (
                <div
                  className="mb-2 p-2 rounded flex items-center justify-between"
                  style={{ backgroundColor: theme === 'dark' ? 'rgba(88,166,255,0.1)' : 'rgba(96,107,223,0.1)', border: `1px solid ${themeColors.primary}40` }}
                >
                  <div className="flex items-center gap-2">
                    <Edit2 size={14} style={{ color: themeColors.primary }} />
                    <span className="text-sm font-medium" style={{ color: themeColors.primary }}>
                      {t('editingMessage') || '메시지 수정 중...'}
                    </span>
                  </div>
                  <button onClick={() => { setEditingMessageId(null); setMessageInput(''); }} style={{ color: themeColors.textSecondary }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* 답장 중 표시 */}
              {replyingTo && (
                <div
                  className="mb-2 p-2 rounded flex items-center justify-between"
                  style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                  <div className="flex items-center gap-2">
                    <Reply size={16} style={{ color: themeColors.textSecondary }} />
                    <span className="text-sm" style={{ color: themeColors.textSecondary }}>
                      {t('replyingTo', { name: replyingTo.senderName })}
                    </span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ color: themeColors.textSecondary }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:opacity-80"
                  style={{ color: themeColors.text }}
                >
                  <Paperclip size={20} />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={t('sendMessageTo', { channelName: currentChannel.name })}
                  className="flex-1 px-4 py-3 rounded focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${themeColors.border}`,
                    color: themeColors.text,
                  }}
                />

                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 rounded-lg hover:opacity-80"
                    style={{ color: showEmojiPicker ? themeColors.primary : themeColors.text }}
                  >
                    <Smile size={20} />
                  </button>
                  {showEmojiPicker && (
                    <div
                      className="absolute bottom-full right-0 mb-2 p-2 rounded shadow-lg z-50 grid grid-cols-6 gap-0.5"
                      style={{ backgroundColor: themeColors.surface, border: `1px solid ${themeColors.border}`, width: '228px' }}
                    >
                      {['😀','😂','😍','🤔','👍','👏','🎉','❤️','🔥','✅','😊','😅','🙏','💪','😭','🤣','😎','🥳','👋','🤝','⭐','💡','🚀','✨','😢','😤','🎯','💯','🤞','👌'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setMessageInput((prev) => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="p-1.5 rounded hover:opacity-70 transition-all text-center"
                          style={{ fontSize: '1.25rem', lineHeight: 1 }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="flex items-center justify-center rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                  style={{ width: '36px', height: '36px', backgroundColor: themeColors.primary, color: theme === 'yellow' ? '#333' : '#fff' }}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="채팅 내용을 불러오는 중..." />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare size={48} className="mb-3 opacity-20" style={{ color: themeColors.textSecondary }} />
            <p className="text-sm font-medium" style={{ color: themeColors.text }}>
              {t('selectChannel')}
            </p>
            <p className="text-xs mt-1 mb-5" style={{ color: themeColors.textSecondary }}>
              {t('selectOrCreateChannel')}
            </p>
            <button
              onClick={() => setShowNewChannelModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
            >
              <Plus size={15} />
              {t('createChannel')}
            </button>
          </div>
        )}
      </div>

      {/* 멤버 패널 */}
      {showMembersPanel && currentChannel && (
        <div
          className="w-64 flex-shrink-0 p-4 overflow-y-auto"
          style={{
            backgroundColor: themeColors.surface,
            borderLeft: `1px solid ${themeColors.border}`,
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: themeColors.text }}>
            {t('members')} ({currentChannel.members.length})
          </h3>

          <div className="space-y-2">
            {currentChannel.members.map((memberId) => {
              const memberInfo = channelMembers[currentChannel.id]?.find((m) => m.userId === memberId);
              const userInfo = users.find((u) => u.id === memberId) || user;

              return (
                <div
                  key={memberId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:opacity-80"
                  style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    {userInfo?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: themeColors.text }}>
                      {userInfo?.name || t('user')}
                    </p>
                    <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                      {memberInfo?.role === 'owner' ? t('owner') : memberInfo?.role === 'admin' ? t('admin') : t('member')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 채널 설정 패널 */}
      {showChannelSettings && currentChannel && (() => {
        const isDark = theme !== 'light';
        const panelBg = isDark ? 'rgba(0,0,0,0.15)' : '#F5F5F7';
        const cardBg = themeColors.surface;
        const cardStyle = {
          backgroundColor: cardBg,
          border: `1px solid ${themeColors.border}`,
          borderRadius: '12px',
          padding: '14px',
        };
        const pinnedMsgs = (currentChannel.pinnedMessages || [])
          .map((id) => currentMessages.find((m) => m.id === id))
          .filter(Boolean);
        const PINNED_PREVIEW = 2;

        return (
          <div
            className="w-80 flex-shrink-0 flex flex-col overflow-hidden"
            style={{ backgroundColor: panelBg, borderLeft: `1px solid ${themeColors.border}` }}
          >
            {/* 패널 헤더 */}
            <div
              className="flex items-center justify-between px-4 h-14 flex-shrink-0"
              style={{ borderBottom: `1px solid ${themeColors.border}`, backgroundColor: themeColors.surface }}
            >
              <span className="font-bold text-base" style={{ color: themeColors.text }}>
                채널 설정
              </span>
              <button onClick={() => setShowChannelSettings(false)} className="p-1 rounded-lg hover:opacity-70" style={{ color: themeColors.textSecondary }}>
                <X size={18} />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

              {/* ── 채널 정보 카드 ── */}
              <div style={cardStyle}>
                {/* 채널 아이콘 + 이름 헤더 */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
                  >
                    {currentChannel.type === 'private' ? <Lock size={18} color="#fff" /> : currentChannel.type === 'direct' ? <MessageSquare size={18} color="#fff" /> : <Hash size={18} color="#fff" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight truncate" style={{ color: themeColors.text }}>
                      {currentChannel.name}
                    </p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${themeColors.primary}20`, color: themeColors.primary }}>
                      {currentChannel.type === 'public' ? '공개' : currentChannel.type === 'private' ? '비공개' : 'DM'}
                    </span>
                  </div>
                  {!isEditingChannel && (
                    <button
                      onClick={() => { setEditChannelName(currentChannel.name); setEditChannelDescription(currentChannel.description || ''); setIsEditingChannel(true); }}
                      className="p-1.5 rounded-lg hover:opacity-70 flex-shrink-0"
                      style={{ color: themeColors.textSecondary }}
                      title="채널 정보 수정"
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </div>

                <div style={{ height: 1, backgroundColor: themeColors.border, marginBottom: 10 }} />

                {isEditingChannel ? (
                  /* 편집 모드 */
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-xs mb-1 font-medium" style={{ color: themeColors.textSecondary }}>채널명 *</p>
                      <input
                        value={editChannelName}
                        onChange={(e) => setEditChannelName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded text-sm"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1 font-medium" style={{ color: themeColors.textSecondary }}>설명</p>
                      <textarea
                        value={editChannelDescription}
                        onChange={(e) => setEditChannelDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-1.5 rounded text-sm resize-none"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${themeColors.border}`, color: themeColors.text }}
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={handleSaveChannel}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                        style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setIsEditingChannel(false)}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: themeColors.text, border: `1px solid ${themeColors.border}`, borderRadius: '4px' }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <>
                    <p className="text-xs mb-1 font-medium" style={{ color: themeColors.textSecondary }}>설명</p>
                    <p className="text-sm" style={{ color: currentChannel.description ? themeColors.text : themeColors.textSecondary }}>
                      {currentChannel.description || '설명이 없습니다.'}
                    </p>
                  </>
                )}
              </div>

              {/* ── 멤버 카드 ── */}
              <div style={cardStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={15} style={{ color: themeColors.primary }} />
                    <span className="text-xs font-bold" style={{ color: themeColors.text }}>
                      멤버 ({currentChannel.members.length})
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-all"
                    style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}
                  >
                    <Plus size={12} />
                    추가
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                {[...currentChannel.members].sort((a, b) => {
                      const userA =
                      users.find((u) => u.id === a) || (a === user?.id ? user : null);
                      const userB =
                      users.find((u) => u.id === b) || (b === user?.id ? user : null);
                    
                      const nameA = userA?.name?.toLowerCase() || '';
                      const nameB = userB?.name?.toLowerCase() || '';
                    
                      return nameA.localeCompare(nameB);
                    }).map((memberId) => {
                    const memberInfo = channelMembers[currentChannel.id]?.find((m) => m.userId === memberId);
                    const userInfo = users.find((u) => u.id === memberId) || (memberId === user?.id ? user : null);
                    const isOwner = memberInfo?.role === 'owner';
                    const isSelf = memberId === user?.id;
                    const canRemove = !isOwner && !isSelf;
                    return (
                      <div key={memberId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})` }}>
                          {userInfo?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: themeColors.text }}>
                            {userInfo?.name || memberId}
                          </p>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${themeColors.primary}18`, color: themeColors.primary }}>
                          {isOwner ? '소유자' : memberInfo?.role === 'admin' ? '관리자' : '멤버'}
                        </span>
                        {canRemove && (
                          <button
                            onClick={() => removeMemberFromChannel(currentChannel.id, memberId)}
                            className="px-2 py-0.5 rounded-md text-xs font-medium hover:opacity-80 transition-all flex-shrink-0"
                            style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
                          >
                            추방
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── 알림 설정 카드 ── */}
              {user && channelMembers[currentChannel.id]?.find((m) => m.userId === user.id) && (
                <div style={cardStyle}>
                  <p className="text-xs font-bold mb-2" style={{ color: themeColors.textSecondary }}>알림 설정</p>
                  <p className="text-sm font-medium" style={{ color: themeColors.text }}>
                    {channelMembers[currentChannel.id].find((m) => m.userId === user.id)?.notificationLevel === 'all'
                      ? '모든 메시지'
                      : channelMembers[currentChannel.id].find((m) => m.userId === user.id)?.notificationLevel === 'mentions'
                      ? '멘션만'
                      : '알림 없음'}
                  </p>
                </div>
              )}

              {/* ── 고정 메시지 카드 ── */}
              <div style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <Pin size={15} style={{ color: themeColors.primary }} />
                  <span className="text-xs font-bold" style={{ color: themeColors.text }}>
                    고정 메시지 {pinnedMsgs.length > 0 ? `(${pinnedMsgs.length})` : ''}
                  </span>
                </div>

                {pinnedMsgs.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: themeColors.textSecondary }}>
                    고정된 메시지가 없습니다
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      {pinnedMsgs.slice(0, PINNED_PREVIEW).map((msg) => msg && (
                        <button
                          key={msg.id}
                          onClick={() => scrollToMessage(msg.id)}
                          className="w-full text-left rounded-lg px-3 py-2 hover:opacity-80 transition-all"
                          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderLeft: `3px solid ${themeColors.primary}` }}
                        >
                          <p className="text-xs font-bold mb-0.5" style={{ color: themeColors.primary }}>
                            {msg.senderName}
                          </p>
                          <p className="text-sm leading-snug" style={{ color: themeColors.text }}>
                            {msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content}
                          </p>
                        </button>
                      ))}
                    </div>
                    {pinnedMsgs.length > PINNED_PREVIEW && (
                      <button
                        className="w-full mt-2 text-xs font-medium py-1.5 rounded-lg hover:opacity-80 transition-all"
                        style={{ color: themeColors.primary, backgroundColor: `${themeColors.primary}12` }}
                      >
                        전체 보기 ({pinnedMsgs.length}개)
                      </button>
                    )}
                  </>
                )}
              </div>


            </div>

            {/* ── 채널 삭제 (관리자) - 하단 고정 ── */}
            {isAdminAccount(user) && (
              <div className="flex-shrink-0 p-3" style={{ borderTop: `1px solid ${themeColors.border}` }}>
                <button
                  onClick={handleDeleteChannel}
                  className="w-full py-2.5 rounded-lg font-semibold text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  <Trash2 size={16} />
                  채널 삭제
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 새 채널 모달 */}
      {showNewChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="rounded p-6 w-full max-w-md"
            style={{ backgroundColor: themeColors.surface }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: themeColors.text }}>
              {t('createNewChannel')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                  {t('channelName')} *
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder={t('channelNamePlaceholder')}
                  className="w-full px-4 py-2 rounded focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${themeColors.border}`,
                    color: themeColors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                  {t('description')} ({t('optional')})
                </label>
                <textarea
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder={t('channelDescriptionPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 rounded focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${themeColors.border}`,
                    color: themeColors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                  {t('channelType')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewChannelType('public')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: newChannelType === 'public' ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                      color: newChannelType === 'public' ? '#fff' : themeColors.text,
                      border: `1px solid ${newChannelType === 'public' ? 'transparent' : themeColors.border}`,
                      borderRadius: '4px',
                    }}
                  >
                    <Hash size={15} />
                    {t('public')}
                  </button>
                  <button
                    onClick={() => setNewChannelType('private')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: newChannelType === 'private' ? themeColors.primary : (theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                      color: newChannelType === 'private' ? '#fff' : themeColors.text,
                      border: `1px solid ${newChannelType === 'private' ? 'transparent' : themeColors.border}`,
                      borderRadius: '4px',
                    }}
                  >
                    <Lock size={15} />
                    {t('private')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateChannel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
              >
                {t('create')}
              </button>
              <button
                onClick={() => {
                  setShowNewChannelModal(false);
                  setNewChannelName('');
                  setNewChannelDescription('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
                style={{
                  backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: themeColors.text,
                  border: `1px solid ${themeColors.border}`,
                  borderRadius: '4px',
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 추가 모달 */}
      {showAddMemberModal && currentChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded p-6 w-full max-w-md"
            style={{ backgroundColor: themeColors.surface }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: themeColors.text }}>
                {t('addMember')}
              </h3>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedNewMembers([]);
                }}
                className="p-2 rounded-lg hover:opacity-80"
                style={{ color: themeColors.text }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: themeColors.textSecondary }}>
                {t('channel')}: <span className="font-medium" style={{ color: themeColors.text }}>{currentChannel.name}</span>
              </p>
              <p className="text-sm" style={{ color: themeColors.textSecondary }}>
                {t('currentMembers')}: {currentChannel.members.length}{t('people')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                {t('selectMembersToAdd')}
              </label>
              <div
                className="border rounded-lg p-2 max-h-64 overflow-y-auto"
                style={{ borderColor: themeColors.border }}
              >
                {users
                  .filter((u) => !currentChannel.members.includes(u.id) && u.id !== user?.id)
                  .map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:opacity-80 cursor-pointer transition-all"
                      style={{
                        backgroundColor: selectedNewMembers.includes(u.id)
                          ? theme === 'dark'
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.1)'
                          : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNewMembers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNewMembers([...selectedNewMembers, u.id]);
                          } else {
                            setSelectedNewMembers(selectedNewMembers.filter((id) => id !== u.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        {u.name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: themeColors.text }}>
                          {u.name}
                        </p>
                        <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                          {u.email}
                        </p>
                      </div>
                    </label>
                  ))}
                {users.filter((u) => !currentChannel.members.includes(u.id) && u.id !== user?.id).length === 0 && (
                  <p className="text-center py-8 text-sm" style={{ color: themeColors.textSecondary }}>
                    {t('noMembersToAdd')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddMembers}
                disabled={selectedNewMembers.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: themeColors.primary, color: '#fff', borderRadius: '4px' }}
              >
                {t('add')} ({selectedNewMembers.length})
              </button>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedNewMembers([]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-60"
                style={{
                  backgroundColor: theme !== 'light' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: themeColors.text,
                  border: `1px solid ${themeColors.border}`,
                  borderRadius: '4px',
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      </div>
    </ProtectedComponent>
  );
};

export default Collaboration;
