import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import type { Channel, Message, ChannelMember, Thread } from '../types';

interface CollaborationState {
  channels: Channel[];
  messages: Record<string, Message[]>; // channelId -> messages
  channelMembers: Record<string, ChannelMember[]>; // channelId -> members
  threads: Record<string, Thread>; // messageId -> thread
  currentChannelId: string | null;
  loadingChannelId: string | null; // 현재 메시지를 로딩 중인 채널
  typingUsers: Record<string, Set<string>>; // channelId -> Set of user IDs
  isLoading: boolean;

  // Channel 관리
  fetchChannels: () => Promise<void>;
  addChannel: (channel: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateChannel: (channelId: string, updates: { name?: string; description?: string; isArchived?: boolean }) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  archiveChannel: (channelId: string) => void;
  setCurrentChannel: (channelId: string | null) => void;

  // 멤버 관리
  addMemberToChannel: (channelId: string, userId: string, role?: ChannelMember['role']) => Promise<void>;
  removeMemberFromChannel: (channelId: string, userId: string) => Promise<void>;
  updateMemberRole: (channelId: string, userId: string, role: ChannelMember['role']) => void;
  markChannelAsRead: (channelId: string, userId: string) => void;

  // 메시지 관리
  fetchMessages: (channelId: string) => Promise<void>;
  sendMessage: (message: Omit<Message, 'id' | 'createdAt' | 'isEdited' | 'reactions' | 'isPinned' | 'isDeleted'>) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pinMessage: (messageId: string, channelId: string) => Promise<void>;
  unpinMessage: (messageId: string, channelId: string) => void;
  addReaction: (messageId: string, channelId: string, emoji: string, userId: string) => void;
  removeReaction: (messageId: string, channelId: string, emoji: string, userId: string) => void;

  // Thread 관리
  createThread: (parentMessageId: string, channelId: string) => void;
  addReplyToThread: (parentMessageId: string, message: Message) => void;

  // Typing indicator
  setUserTyping: (channelId: string, userId: string, isTyping: boolean) => void;

  // 유틸리티
  getUnreadCount: (channelId: string, userId: string) => number;
  searchMessages: (query: string, channelId?: string) => Message[];
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  channels: [],
  messages: {},
  channelMembers: {},
  threads: {},
  currentChannelId: null,
  loadingChannelId: null,
  typingUsers: {},
  isLoading: true,

  fetchChannels: async () => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(import.meta.env.VITE_API_URL + '/collaboration/channels', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const data = await response.json();
      const convertedChannels: Channel[] = data.map((channel: any) => ({
        id: channel.id.toString(),
        name: channel.name,
        description: channel.description,
        type: channel.type.toLowerCase() as 'public' | 'private' | 'direct',
        projectId: channel.projectId?.toString(),
        companyId: channel.companyId?.toString(),
        members: channel.memberIds?.map((id: number) => id.toString()) || [],
        createdBy: channel.createdBy.toString(),
        createdAt: new Date(channel.createdAt),
        updatedAt: new Date(channel.updatedAt),
        lastMessageAt: channel.lastMessageAt ? new Date(channel.lastMessageAt) : undefined,
        isArchived: channel.isArchived,
        pinnedMessages: channel.pinnedMessages?.map((id: number) => id.toString()) || [],
      }));
      set({ channels: convertedChannels });
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addChannel: async (channelData) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(import.meta.env.VITE_API_URL + '/collaboration/channels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: channelData.name,
          description: channelData.description,
          type: channelData.type.toUpperCase(),
          projectId: channelData.projectId ? parseInt(channelData.projectId) : null,
          companyId: channelData.companyId ? parseInt(channelData.companyId) : null,
          members: channelData.members.map(id => String(id)),
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create channel');
      }

      const createdChannel = await response.json();
      const convertedChannel: Channel = {
        id: createdChannel.id.toString(),
        name: createdChannel.name,
        description: createdChannel.description,
        type: createdChannel.type.toLowerCase() as 'public' | 'private' | 'direct',
        projectId: createdChannel.projectId?.toString(),
        companyId: createdChannel.companyId?.toString(),
        members: createdChannel.memberIds?.map((id: number) => id.toString()) || [],
        createdBy: createdChannel.createdBy.toString(),
        createdAt: new Date(createdChannel.createdAt),
        updatedAt: new Date(createdChannel.updatedAt),
        lastMessageAt: createdChannel.lastMessageAt ? new Date(createdChannel.lastMessageAt) : undefined,
        isArchived: createdChannel.isArchived,
        pinnedMessages: createdChannel.pinnedMessages?.map((id: number) => id.toString()) || [],
      };

      set((state) => ({
        channels: [...state.channels, convertedChannel],
        channelMembers: {
          ...state.channelMembers,
          [convertedChannel.id]: [{
            userId: currentUser.id,
            channelId: convertedChannel.id,
            role: 'owner',
            joinedAt: new Date(),
            isMuted: false,
            notificationLevel: 'all',
          }],
        },
        messages: {
          ...state.messages,
          [convertedChannel.id]: [],
        },
      }));

      // 알림 전송 (채널 멤버들에게)
      channelData.members.forEach((memberId) => {
        if (memberId !== currentUser.id) {
          useNotificationStore.getState().addNotification({
            userId: memberId,
            type: 'system_alert',
            title: '새 채널 초대',
            message: `${currentUser.name}님이 "${convertedChannel.name}" 채널에 초대했습니다.`,
            priority: 'normal',
            isRead: false,
          });
        }
      });
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    }
  },

  updateChannel: async (channelId, updates) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/channels/${channelId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update channel');
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, ...updates, updatedAt: new Date() } : c
      ),
    }));
  },

  deleteChannel: async (channelId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/channels/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete channel');
      }

      set((state) => {
        const newMessages = { ...state.messages };
        const newChannelMembers = { ...state.channelMembers };
        delete newMessages[channelId];
        delete newChannelMembers[channelId];

        return {
          channels: state.channels.filter((c) => c.id !== channelId),
          messages: newMessages,
          channelMembers: newChannelMembers,
          currentChannelId: state.currentChannelId === channelId ? null : state.currentChannelId,
        };
      });
    } catch (error) {
      console.error('Error deleting channel:', error);
      throw error;
    }
  },

  archiveChannel: (channelId) => {
    get().updateChannel(channelId, { isArchived: true });
  },

  setCurrentChannel: (channelId) => {
    set({ currentChannelId: channelId, loadingChannelId: channelId });
  },

  addMemberToChannel: async (channelId, userId, role = 'member') => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/channels/${channelId}/members/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to add member to channel');
      }

      const newMember: ChannelMember = {
        userId,
        channelId,
        role,
        joinedAt: new Date(),
        isMuted: false,
        notificationLevel: 'all',
      };

      set((state) => ({
        channelMembers: {
          ...state.channelMembers,
          [channelId]: [...(state.channelMembers[channelId] || []), newMember],
        },
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, members: [...c.members, userId] } : c
        ),
      }));
    } catch (error) {
      console.error('Error adding member to channel:', error);
      throw error;
    }
  },

  removeMemberFromChannel: async (channelId, userId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove member from channel');
      }
    } catch (error) {
      console.error('Error removing member from channel:', error);
    }

    set((state) => ({
      channelMembers: {
        ...state.channelMembers,
        [channelId]: (state.channelMembers[channelId] || []).filter((m) => m.userId !== userId),
      },
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, members: c.members.filter((id) => id !== userId) } : c
      ),
    }));
  },

  updateMemberRole: (channelId, userId, role) => {
    set((state) => ({
      channelMembers: {
        ...state.channelMembers,
        [channelId]: (state.channelMembers[channelId] || []).map((m) =>
          m.userId === userId ? { ...m, role } : m
        ),
      },
    }));
  },

  markChannelAsRead: (channelId, userId) => {
    set((state) => ({
      channelMembers: {
        ...state.channelMembers,
        [channelId]: (state.channelMembers[channelId] || []).map((m) =>
          m.userId === userId ? { ...m, lastReadAt: new Date() } : m
        ),
      },
    }));
  },

  fetchMessages: async (channelId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      const convertedMessages: Message[] = data.map((msg: any) => ({
        id: msg.id.toString(),
        channelId: msg.channelId.toString(),
        content: msg.content,
        senderId: msg.senderId.toString(),
        senderName: msg.senderName,
        senderAvatar: msg.senderAvatar,
        createdAt: new Date(msg.createdAt),
        updatedAt: msg.updatedAt ? new Date(msg.updatedAt) : undefined,
        editedAt: msg.editedAt ? new Date(msg.editedAt) : undefined,
        isEdited: msg.isEdited,
        replyToId: msg.replyToId?.toString(),
        reactions: [],
        attachments: [],
        mentions: msg.mentions?.map((id: number) => id.toString()) || [],
        isPinned: msg.isPinned,
        isDeleted: msg.isDeleted,
      }));

      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: convertedMessages,
        },
        // 이 채널이 아직 로딩 대상이면 로딩 완료 처리
        loadingChannelId: state.loadingChannelId === channelId ? null : state.loadingChannelId,
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      set((state) => state.loadingChannelId === channelId ? { loadingChannelId: null } : {});
    }
  },

  sendMessage: async (messageData) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(import.meta.env.VITE_API_URL + '/collaboration/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelId: parseInt(messageData.channelId),
          content: messageData.content,
          replyToId: messageData.replyToId ? parseInt(messageData.replyToId) : null,
          mentions: messageData.mentions?.map(id => parseInt(id)) || [],
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const sentMessage = await response.json();
      const convertedMessage: Message = {
        id: sentMessage.id.toString(),
        channelId: sentMessage.channelId.toString(),
        content: sentMessage.content,
        senderId: sentMessage.senderId.toString(),
        senderName: sentMessage.senderName,
        senderAvatar: sentMessage.senderAvatar,
        createdAt: new Date(sentMessage.createdAt),
        updatedAt: sentMessage.updatedAt ? new Date(sentMessage.updatedAt) : undefined,
        editedAt: sentMessage.editedAt ? new Date(sentMessage.editedAt) : undefined,
        isEdited: sentMessage.isEdited,
        replyToId: sentMessage.replyToId?.toString(),
        reactions: [],
        attachments: messageData.attachments,
        mentions: sentMessage.mentions?.map((id: number) => id.toString()) || [],
        isPinned: sentMessage.isPinned,
        isDeleted: sentMessage.isDeleted,
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [messageData.channelId]: [...(state.messages[messageData.channelId] || []), convertedMessage],
        },
        channels: state.channels.map((c) =>
          c.id === messageData.channelId ? { ...c, lastMessageAt: new Date() } : c
        ),
      }));

      // 멘션된 사용자들에게 알림
      messageData.mentions?.forEach((userId) => {
        if (userId !== currentUser.id) {
          const channel = get().channels.find((c) => c.id === messageData.channelId);
          useNotificationStore.getState().addNotification({
            userId,
            type: 'system_alert',
            title: '새 멘션',
            message: `${messageData.senderName}님이 "${channel?.name}"에서 회원님을 멘션했습니다.`,
            priority: 'high',
            isRead: false,
          });
        }
      });

      // 채널 멤버들에게 알림 (멘션된 사용자 제외)
      const channel = get().channels.find((c) => c.id === messageData.channelId);
      channel?.members.forEach((memberId) => {
      const member = get().channelMembers[messageData.channelId]?.find((m) => m.userId === memberId);
      if (
        memberId !== currentUser.id &&
        !messageData.mentions?.includes(memberId) &&
        member?.notificationLevel === 'all'
      ) {
        useNotificationStore.getState().addNotification({
          userId: memberId,
          type: 'system_alert',
          title: `새 메시지 - ${channel.name}`,
          message: `${messageData.senderName}: ${messageData.content.substring(0, 50)}...`,
          priority: 'low',
          isRead: false,
        });
      }
    });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  editMessage: async (messageId, content) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      set((state) => {
        const newMessages = { ...state.messages };
        for (const channelId in newMessages) {
          newMessages[channelId] = newMessages[channelId].map((m) =>
            m.id === messageId
              ? { ...m, content, isEdited: true, editedAt: new Date(), updatedAt: new Date() }
              : m
          );
        }
        return { messages: newMessages };
      });
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      set((state) => {
        const newMessages = { ...state.messages };
        for (const channelId in newMessages) {
          newMessages[channelId] = newMessages[channelId].map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, content: '삭제된 메시지입니다.' } : m
          );
        }
        return { messages: newMessages };
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  pinMessage: async (messageId, channelId) => {
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/collaboration/messages/${messageId}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to pin message');
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: state.messages[channelId]?.map((m) =>
            m.id === messageId ? { ...m, isPinned: true } : m
          ),
        },
        channels: state.channels.map((c) =>
          c.id === channelId
            ? { ...c, pinnedMessages: [...(c.pinnedMessages || []), messageId] }
            : c
        ),
      }));
    } catch (error) {
      console.error('Error pinning message:', error);
      throw error;
    }
  },

  unpinMessage: (messageId, channelId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: state.messages[channelId]?.map((m) =>
          m.id === messageId ? { ...m, isPinned: false } : m
        ),
      },
      channels: state.channels.map((c) =>
        c.id === channelId
          ? { ...c, pinnedMessages: (c.pinnedMessages || []).filter((id) => id !== messageId) }
          : c
      ),
    }));
  },

  addReaction: (messageId, channelId, emoji, userId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: state.messages[channelId]?.map((m) => {
          if (m.id !== messageId) return m;

          const existingReaction = m.reactions.find((r) => r.emoji === emoji);
          if (existingReaction) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, userIds: [...r.userIds, userId], count: r.count + 1 }
                  : r
              ),
            };
          } else {
            return {
              ...m,
              reactions: [...m.reactions, { emoji, userIds: [userId], count: 1 }],
            };
          }
        }),
      },
    }));
  },

  removeReaction: (messageId, channelId, emoji, userId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: state.messages[channelId]?.map((m) => {
          if (m.id !== messageId) return m;

          return {
            ...m,
            reactions: m.reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, userIds: r.userIds.filter((id) => id !== userId), count: r.count - 1 }
                  : r
              )
              .filter((r) => r.count > 0),
          };
        }),
      },
    }));
  },

  createThread: (parentMessageId, channelId) => {
    const newThread: Thread = {
      id: `thread-${parentMessageId}`,
      parentMessageId,
      channelId,
      replyCount: 0,
      participants: [],
      lastReplyAt: new Date(),
    };

    set((state) => ({
      threads: {
        ...state.threads,
        [parentMessageId]: newThread,
      },
    }));
  },

  addReplyToThread: (parentMessageId, message) => {
    set((state) => {
      const thread = state.threads[parentMessageId];
      if (!thread) return state;

      return {
        threads: {
          ...state.threads,
          [parentMessageId]: {
            ...thread,
            replyCount: thread.replyCount + 1,
            participants: Array.from(new Set([...thread.participants, message.senderId])),
            lastReplyAt: new Date(),
          },
        },
      };
    });
  },

  setUserTyping: (channelId, userId, isTyping) => {
    set((state) => {
      const newTypingUsers = { ...state.typingUsers };
      if (!newTypingUsers[channelId]) {
        newTypingUsers[channelId] = new Set();
      }

      if (isTyping) {
        newTypingUsers[channelId].add(userId);
      } else {
        newTypingUsers[channelId].delete(userId);
      }

      return { typingUsers: newTypingUsers };
    });
  },

  getUnreadCount: (channelId, userId) => {
    const state = get();
    const member = state.channelMembers[channelId]?.find((m) => m.userId === userId);
    if (!member) return 0;

    const messages = state.messages[channelId] || [];
    const lastReadAt = member.lastReadAt || new Date(0);

    return messages.filter((m) => new Date(m.createdAt) > lastReadAt).length;
  },

  searchMessages: (query, channelId) => {
    const state = get();
    const lowercaseQuery = query.toLowerCase();

    if (channelId) {
      return (state.messages[channelId] || []).filter(
        (m) =>
          m.content.toLowerCase().includes(lowercaseQuery) ||
          m.senderName.toLowerCase().includes(lowercaseQuery)
      );
    } else {
      const allMessages: Message[] = [];
      Object.values(state.messages).forEach((msgs) => {
        allMessages.push(
          ...msgs.filter(
            (m) =>
              m.content.toLowerCase().includes(lowercaseQuery) ||
              m.senderName.toLowerCase().includes(lowercaseQuery)
          )
        );
      });
      return allMessages;
    }
  },
}));
