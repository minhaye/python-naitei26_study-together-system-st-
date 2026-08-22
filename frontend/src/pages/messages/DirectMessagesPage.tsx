import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, MessagesSquare, Send, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMessageImageAttachment, ALLOWED_IMAGE_ACCEPT } from '../../hooks/useMessageImageAttachment';
import { listDirectConversations } from '../../lib/conversation.api';
import { ApiError } from '../../lib/apiClient';
import { getDisplayName } from '../../utils/userDisplay';
import { getAvatarColor, getAvatarInitials } from '../../utils/avatarUtils';
import { useUnreadMessages } from '../../contexts/unread-messages-context';
import { MessageAttachmentImage } from '../../components/chat/MessageAttachmentImage';
import { SelectedImagePreview } from '../../components/chat/SelectedImagePreview';
import type { Conversation } from '../../lib/conversation.types';
import type { Message } from '../../lib/message.types';

/** Direct-message inbox: a conversation list (left) + the selected thread (right). Reuses
 * useRoomMessages -- despite the name, it has no Room-specific logic, it's already generic
 * over any conversation_id (fetch/send/dedupe/realtime), which is exactly what a DIRECT
 * conversation's messages need too (see message.api.ts, useChannelMessagesRealtime.ts). */
export function DirectMessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getUnread, markAsRead } = useUnreadMessages();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const reconciledIdRef = useRef<string | null>(null);

  const fetchConversations = useCallback(() => {
    setIsLoadingList(true);
    setListError(null);
    return listDirectConversations()
      .then(setConversations)
      .catch((err) => setListError(err instanceof ApiError ? err.message : 'Không thể tải danh sách hội thoại.'))
      .finally(() => setIsLoadingList(false));
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // A conversationId just created via a MessageUserTrigger elsewhere won't be in the
  // snapshot fetched above yet -- refetch once to pick it up.
  useEffect(() => {
    if (!conversationId || isLoadingList) return;
    if (conversations.some((c) => c.id === conversationId)) return;
    if (reconciledIdRef.current === conversationId) return;
    reconciledIdRef.current = conversationId;
    fetchConversations();
  }, [conversationId, conversations, isLoadingList, fetchConversations]);

  const selectedConversation = conversations.find((c) => c.id === conversationId) ?? null;

  const {
    messages,
    isLoading: isMessagesLoading,
    loadError: messagesError,
    isSending,
    sendError,
    sendMessage,
  } = useRoomMessages(conversationId ?? null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const imageAttachment = useMessageImageAttachment();
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // A new message arriving via Realtime while this thread is already open doesn't change
    // conversationId, so the effect below (keyed on conversationId) wouldn't catch it --
    // this covers that case. markAsRead is idempotent server-side.
    if (conversationId) markAsRead(conversationId);
    // Intentionally excludes conversationId/markAsRead so this only reacts to new
    // messages, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (conversationId) markAsRead(conversationId);
  }, [conversationId, markAsRead]);

  const handleSend = async () => {
    const trimmed = chatInput.trim();
    if ((!trimmed && !imageAttachment.hasImage) || !conversationId || isSending || imageAttachment.isUploading) return;
    try {
      // Upload first, create the message second -- a failed upload must never produce an
      // orphaned/misleading message record (see useMessageImageAttachment.uploadImage).
      const attachmentPath = imageAttachment.hasImage ? await imageAttachment.uploadImage(conversationId) : null;
      await sendMessage(trimmed, attachmentPath);
      setChatInput('');
      imageAttachment.clearImage();
    } catch {
      // sendError / imageAttachment.uploadError is already populated; keep the draft (and
      // any selected image) so the user can retry.
    }
  };

  const handleChatImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) imageAttachment.selectImage(picked);
    e.target.value = '';
  };

  const senderDisplay = (message: Message) => {
    const isSelf = message.sender_id === currentUser.id;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(message.sender);
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? currentUser.avatarUrl : message.sender.avatar_url,
      isSelf,
    };
  };

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: 'white' }}>
      {/* Conversation list */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: 'white' }}>
          <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessagesSquare size={18} color="#00236F" /> Tin nhắn
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoadingList && <div style={{ padding: 20, color: '#64748B', fontSize: 13 }}>Đang tải...</div>}
          {listError && (
            <div style={{ margin: 12, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
              {listError}
            </div>
          )}
          {!isLoadingList && !listError && conversations.length === 0 && (
            <div style={{ padding: 20, color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
              Bạn chưa có cuộc trò chuyện nào.
            </div>
          )}
          {conversations.map((c) => {
            const name = getDisplayName(c.other_participant);
            const initials = getAvatarInitials(name);
            const color = getAvatarColor(name);
            const isActive = c.id === conversationId;
            const unread = getUnread(c.id);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isActive ? '#E2E8F0' : 'transparent',
                  borderLeft: isActive ? '3px solid #00236F' : '3px solid transparent',
                }}
              >
                {c.other_participant?.avatar_url ? (
                  <img src={c.other_participant.avatar_url} alt={name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1, color: '#0F172A', fontSize: 14, fontWeight: unread > 0 ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                {unread > 0 && (
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      background: '#EF4444',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                      flexShrink: 0,
                    }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thread pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!conversationId || !selectedConversation ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94A3B8' }}>
            <MessageCircle size={40} color="#CBD5E1" />
            <div style={{ fontSize: 15 }}>Chọn một cuộc trò chuyện để bắt đầu nhắn tin.</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
              {selectedConversation.other_participant?.avatar_url ? (
                <img src={selectedConversation.other_participant.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: getAvatarColor(getDisplayName(selectedConversation.other_participant)),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {getAvatarInitials(getDisplayName(selectedConversation.other_participant))}
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}>{getDisplayName(selectedConversation.other_participant)}</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isMessagesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0', color: '#94A3B8', fontSize: 13 }}>
                  Đang tải tin nhắn...
                </div>
              ) : messagesError ? (
                <div style={{ margin: '16px 0', padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
                  {messagesError.message}
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0', color: '#94A3B8', fontSize: 13 }}>
                  Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
                </div>
              ) : (
                messages.map((msg) => {
                  const display = senderDisplay(msg);
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: display.isSelf ? 'row-reverse' : 'row' }}>
                      {display.avatarUrl ? (
                        <img src={display.avatarUrl} alt={display.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {display.initials}
                        </div>
                      )}
                      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: display.isSelf ? 'flex-end' : 'flex-start' }}>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: display.isSelf ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
                            background: display.isSelf ? '#00236F' : '#F1F5F9',
                            color: display.isSelf ? 'white' : '#0F172A',
                            fontSize: 14,
                            lineHeight: '1.4',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content && <div style={{ marginBottom: msg.attachment_path ? 6 : 0 }}>{msg.content}</div>}
                          {msg.attachment_path && <MessageAttachmentImage messageId={msg.id} />}
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>{formatMessageTime(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0' }}>
              {(sendError || imageAttachment.uploadError || imageAttachment.pickError) && (
                <div style={{ marginBottom: 8, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
                  {sendError?.message || imageAttachment.uploadError?.message || imageAttachment.pickError}
                </div>
              )}
              {imageAttachment.previewUrl && (
                <SelectedImagePreview
                  previewUrl={imageAttachment.previewUrl}
                  onRemove={imageAttachment.clearImage}
                  disabled={isSending || imageAttachment.isUploading}
                />
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="file"
                  accept={ALLOWED_IMAGE_ACCEPT}
                  ref={chatImageInputRef}
                  onChange={handleChatImageSelected}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => chatImageInputRef.current?.click()}
                  disabled={isSending}
                  aria-label="Đính kèm ảnh"
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    color: '#00236F',
                    padding: 10,
                    borderRadius: 8,
                    display: 'flex',
                    cursor: isSending ? 'default' : 'pointer',
                    opacity: isSending ? 0.6 : 1,
                  }}
                >
                  <ImageIcon size={16} />
                </button>
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isSending}
                  style={{ flex: 1, padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', color: '#0F172A', fontSize: 14 }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!chatInput.trim() && !imageAttachment.hasImage) || isSending || imageAttachment.isUploading}
                  style={{
                    background: '#00236F',
                    border: 'none',
                    color: 'white',
                    padding: 10,
                    borderRadius: 8,
                    cursor: (!chatInput.trim() && !imageAttachment.hasImage) || isSending || imageAttachment.isUploading ? 'default' : 'pointer',
                    opacity: (!chatInput.trim() && !imageAttachment.hasImage) || isSending || imageAttachment.isUploading ? 0.6 : 1,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
