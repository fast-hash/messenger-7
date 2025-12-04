import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import VkStyleInput from './VkStyleInput';
import { formatRole } from '../utils/roleLabels';
import { ensureNotificationPermission } from '../utils/notifications';
import { formatMessageDate } from '../utils/dateUtils';

const ChatWindow = ({
  chat,
  messages,
  lastReadAt,
  currentUserId,
  typingUsers,
  onToggleNotifications,
  onOpenManage,
  onSend,
  onTypingStart,
  onTypingStop,
  socketConnected,
  onBlock,
  onUnblock,
}) => {
  const listRef = useRef(null);
  const typingTimer = useRef(null);
  const typingActive = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadSeparatorMessageId, setUnreadSeparatorMessageId] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [separatorCleared, setSeparatorCleared] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    setShowSettings(false);
    setUnreadSeparatorMessageId(null);
    setShowManageModal(false);
    setSeparatorCleared(false);
    setMessageText('');
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    if (typingActive.current && onTypingStop) {
      onTypingStop(chat.id);
    }
    typingActive.current = false;
  }, [chat.id, onTypingStop]);

  const getSenderId = (message) =>
    message?.senderId || message?.sender?.id || message?.sender?._id || message?.sender || null;

  useEffect(
    () => () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      if (typingActive.current && onTypingStop) {
        onTypingStop(chat.id);
      }
      typingActive.current = false;
    },
    [chat.id, onTypingStop]
  );

  useEffect(() => {
    if (!chat || unreadSeparatorMessageId || separatorCleared) return;
    if (!messages || !messages.length) return;

    const threshold = lastReadAt || chat.lastReadAt;
    const currentUserIdStr = currentUserId?.toString();

    const separatorId = messages.find((message) => {
      const senderId = getSenderId(message);
      const isOwnMessage = senderId && currentUserIdStr && senderId.toString() === currentUserIdStr;
      if (isOwnMessage) return false;

      if (!threshold) {
        return true;
      }

      return new Date(message.createdAt) > new Date(threshold);
    });

    if (separatorId) {
      setUnreadSeparatorMessageId(separatorId.id || separatorId._id || null);
    }
  }, [chat, messages, lastReadAt, unreadSeparatorMessageId, separatorCleared, currentUserId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const participantIds = useMemo(
    () => (chat.participants || []).map((p) => (p.id || p._id || p).toString()),
    [chat.participants]
  );

  const otherUser = useMemo(() => {
    if (chat.type !== 'direct') return null;
    return chat.otherUser || chat.participants.find((p) => p.id !== currentUserId) || null;
  }, [chat.otherUser, chat.participants, chat.type, currentUserId]);

  const currentId = currentUserId?.toString();
  const isRemovedFromGroup =
    chat.type === 'group' &&
    (!participantIds.includes(currentId) ||
      (chat.removedParticipants || []).some((id) => (id?.toString?.() || id) === currentId) ||
      chat.removed);

  const isBlockedByMe =
    chat.type === 'direct' &&
    (chat.blocks || []).some((b) => b.by === currentUserId && b.target === otherUser?.id);
  const isBlockedMe =
    chat.type === 'direct' &&
    (chat.blocks || []).some((b) => b.by === otherUser?.id && b.target === currentUserId);
  const chatBlocked = chat.type === 'direct' && (isBlockedByMe || isBlockedMe);

  const typingHint = useMemo(() => {
    if (isRemovedFromGroup || chatBlocked) return '';
    if (chat.type === 'group') {
      if (typingUsers?.length) {
        const names = chat.participants
          ?.filter((p) => typingUsers.includes(p.id))
          .map((p) => p.displayName || p.username);
        if (names?.length) {
          return `${names.join(', ')} печатает...`;
        }
      }
      return '';
    }
    const isOtherTyping = typingUsers?.includes(otherUser?.id);
    return isOtherTyping
      ? `Пользователь ${otherUser?.displayName || otherUser?.username || 'собеседник'} печатает...`
      : '';
  }, [chat.participants, chat.type, typingUsers, otherUser, isRemovedFromGroup, chatBlocked]);

  const canManageGroup =
    chat.type === 'group' &&
    (chat.createdBy === currentUserId || (chat.admins || []).includes(currentUserId));

  const headerTitle =
    chat.type === 'group'
      ? chat.title || 'Групповой чат'
      : otherUser?.displayName || otherUser?.username;
  const headerMeta =
    chat.type === 'group'
      ? `Участников: ${chat.participants?.length || 0}`
      : `${formatRole(otherUser?.role)} · ${otherUser?.department || 'Отдел не указан'} · ${
          chat.isOnline ? 'онлайн' : 'офлайн'
        }`;

  const bottomNotice = useMemo(() => {
    if (isRemovedFromGroup) {
      return 'Вы удалены из этой группы. Вы можете просматривать историю сообщений, но отправка новых сообщений недоступна.';
    }

    if (!chatBlocked) return '';

    if (isBlockedByMe && isBlockedMe) {
      return 'Вы с этим пользователем заблокировали друг друга. Переписка в этом чате недоступна, пока хотя бы один из вас не снимет блокировку.';
    }

    if (isBlockedByMe) {
      return 'Вы заблокировали этого пользователя. Переписка в этом чате временно недоступна. Чтобы продолжить, разблокируйте пользователя в разделе "Управление".';
    }

    if (isBlockedMe) {
      return 'Этот пользователь заблокировал вас. Вы не можете отправлять сообщения в этом чате.';
    }

    return '';
  }, [chatBlocked, isBlockedByMe, isBlockedMe, isRemovedFromGroup]);

  const handleInputChange = (value) => {
    setMessageText(value);
    const hasText = value.trim().length > 0;

    if (hasText && !typingActive.current) {
      onTypingStart && onTypingStart(chat.id);
      typingActive.current = true;
    }

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    typingTimer.current = setTimeout(() => {
      if (typingActive.current) {
        onTypingStop && onTypingStop(chat.id);
      }
      typingActive.current = false;
    }, 1200);

    if (!hasText) {
      if (typingActive.current) {
        onTypingStop && onTypingStop(chat.id);
      }
      typingActive.current = false;
    }
  };

  const handleSend = () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    setUnreadSeparatorMessageId(null);
    setSeparatorCleared(true);
    onSend(trimmed);
    setMessageText('');
    if (typingActive.current) {
      onTypingStop && onTypingStop(chat.id);
    }
    typingActive.current = false;
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
  };

  const showInput = !isRemovedFromGroup && !chatBlocked;
  const typingHintVisible = showInput && typingHint;

  useEffect(() => {
    if (!showInput && typingActive.current) {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      onTypingStop && onTypingStop(chat.id);
      typingActive.current = false;
    }
  }, [showInput, onTypingStop, chat.id]);

  return (
    <div className="chat-window">
      <div className="chat-window__header">
        <div>
          <div className="chat-window__title">{headerTitle}</div>
          <div className="chat-window__meta">{headerMeta}</div>
        </div>
        <div className="chat-window__actions">
          {(canManageGroup || chat.type === 'direct') && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                if (chat.type === 'group') {
                  onOpenManage(chat.id);
                } else {
                  setShowManageModal(true);
                }
              }}
            >
              Управление
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={() => setShowSettings((prev) => !prev)}>
            Настройки
          </button>
          {showSettings && (
            <div className="chat-window__settings">
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={chat.notificationsEnabled}
                  onChange={async () => {
                    if (!chat.notificationsEnabled) {
                      await ensureNotificationPermission();
                    }
                    onToggleNotifications(chat.id);
                  }}
                />
                Получать уведомления по этому чату
              </label>
            </div>
          )}
        </div>
      </div>
      <div className="chat-window__messages" ref={listRef}>
        {messages.length === 0 && <p className="empty-state">Нет сообщений. Напишите первым.</p>}
        {messages.map((message) => {
          const messageId = message.id || message._id;
          const isMine = getSenderId(message)?.toString() === currentUserId?.toString();
          const sender = message.sender || {};
          const authorName = sender.displayName || sender.username || 'Участник';
          const metaParts = [];
          const formattedRole = formatRole(sender.role);
          if (formattedRole) metaParts.push(formattedRole);
          if (sender.department) metaParts.push(sender.department);
          const authorMeta = metaParts.join(' · ');

          return (
            <div key={messageId || message.id}>
              {unreadSeparatorMessageId &&
                (messageId === unreadSeparatorMessageId || message._id === unreadSeparatorMessageId) && (
                  <div className="unread-separator">
                    <span>— Непрочитанные сообщения —</span>
                  </div>
                )}
              <div className={`message-row ${isMine ? 'message-row--mine' : 'message-row--incoming'}`}>
                <div className="message-content">
                  <div className="message-author">
                    <span className="message-author__name">{authorName}</span>
                    {authorMeta && <span className="message-author__meta">{authorMeta}</span>}
                  </div>
                  <div className="message-text">{message.text}</div>
                </div>
                <div className="message-time">{formatMessageDate(message.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {typingHintVisible && <div className="typing-hint">{typingHint}</div>}
      <div className="chat-input-bar">
        {bottomNotice ? (
          <div className="chat-input-banner">{bottomNotice}</div>
        ) : (
          <VkStyleInput
            value={messageText}
            onChange={handleInputChange}
            onSend={handleSend}
            disabled={!socketConnected}
          />
        )}
      </div>
      {showManageModal && chat.type === 'direct' && (
        <div className="modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Управление чатом</h3>
              <button type="button" className="secondary-btn" onClick={() => setShowManageModal(false)}>
                Закрыть
              </button>
            </div>
            <p className="muted">
              {isBlockedByMe
                ? 'Вы заблокировали этого пользователя. Чтобы снова начать переписку, разблокируйте его.'
                : 'Вы можете заблокировать этого пользователя. В этом случае оба участника не смогут отправлять сообщения в этом чате.'}
            </p>
            <div className="btn-row">
              {isBlockedByMe ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={async () => {
                    await onUnblock(chat.id);
                    setShowManageModal(false);
                  }}
                >
                  Разблокировать
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={async () => {
                    await onBlock(chat.id);
                    setShowManageModal(false);
                  }}
                >
                  Заблокировать
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ChatWindow.propTypes = {
  chat: PropTypes.shape({
    id: PropTypes.string.isRequired,
    otherUser: PropTypes.object,
    isOnline: PropTypes.bool,
    notificationsEnabled: PropTypes.bool,
    type: PropTypes.string,
    title: PropTypes.string,
    participants: PropTypes.array,
    removed: PropTypes.bool,
    createdBy: PropTypes.string,
    admins: PropTypes.arrayOf(PropTypes.string),
    lastReadAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    removedParticipants: PropTypes.array,
    blocks: PropTypes.array,
  }).isRequired,
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
      chatId: PropTypes.string.isRequired,
      senderId: PropTypes.string.isRequired,
      sender: PropTypes.object,
      text: PropTypes.string.isRequired,
      createdAt: PropTypes.string,
    })
  ).isRequired,
  lastReadAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  currentUserId: PropTypes.string.isRequired,
  typingUsers: PropTypes.arrayOf(PropTypes.string),
  onToggleNotifications: PropTypes.func,
  onOpenManage: PropTypes.func,
  onSend: PropTypes.func,
  onTypingStart: PropTypes.func,
  onTypingStop: PropTypes.func,
  socketConnected: PropTypes.bool,
  onBlock: PropTypes.func,
  onUnblock: PropTypes.func,
};

ChatWindow.defaultProps = {
  typingUsers: [],
  onToggleNotifications: () => {},
  onOpenManage: () => {},
  onSend: () => {},
  onTypingStart: () => {},
  onTypingStop: () => {},
  socketConnected: false,
  lastReadAt: null,
  onBlock: () => {},
  onUnblock: () => {},
};

export default ChatWindow;
