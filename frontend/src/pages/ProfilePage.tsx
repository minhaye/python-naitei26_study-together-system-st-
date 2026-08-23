import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, MessageCircle, Flag, ShieldAlert, FileText } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { ReportUserModal } from '../components/ui/ReportUserModal';
import { BanUserModal } from './forum/moderation/components/BanUserModal';
import { fetchProfile } from '../lib/profile.api';
import type { Profile } from '../lib/profile.types';
import { createOrGetDirectConversation } from '../lib/conversation.api';
import { forumApi } from './forum/lib/forum.api';
import type { Post } from './forum/types/forum.types';
import { getDisplayName } from '../utils/userDisplay';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/apiClient';

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: 16,
  padding: 24,
};

/** Public profile page (/users/:id) -- shows the target user's identity, up to 10 of
 * their most recent forum posts, and the "Nhắn tin"/"Báo cáo" actions that used to live
 * in MessageUserTrigger's inline popover. Reached by clicking a user's avatar/name
 * anywhere it's rendered via MessageUserTrigger. */
export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, isLoggedIn, isModerator, requireAuth } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);
    setActionError(null);
    Promise.all([
      fetchProfile(id).catch(() => null),
      forumApi.getPosts(null, 0, 10, null, id).catch(() => []),
    ]).then(([fetchedProfile, fetchedPosts]) => {
      if (!fetchedProfile) {
        setNotFound(true);
        return;
      }
      setProfile(fetchedProfile);
      setPosts(fetchedPosts);
    }).finally(() => setIsLoading(false));
  }, [id]);

  const isSelf = isLoggedIn && currentUser.id === id;

  const handleMessage = () => {
    if (!id) return;
    requireAuth(async () => {
      setIsMessaging(true);
      setActionError(null);
      try {
        const conversation = await createOrGetDirectConversation(id);
        navigate(`/messages/${conversation.id}`);
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Không thể mở cuộc trò chuyện.');
      } finally {
        setIsMessaging(false);
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: '#64748B' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={{ maxWidth: 640, margin: '48px auto', padding: '0 24px', textAlign: 'center', color: '#64748B' }}>
        Không tìm thấy người dùng này.
      </div>
    );
  }

  const name = getDisplayName(profile);

  return (
    <div style={{ width: '100%', background: '#F8FAFC', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Profile header */}
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Avatar name={name} src={profile.avatar_url} size="xl" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{name}</h1>
              {(profile.role === 'moderator' || profile.role === 'admin') && (
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: '#EDE9FE', color: '#7C3AED', fontSize: 11.5, fontWeight: 700 }}>
                  {profile.role === 'admin' ? 'Admin' : 'Kiểm duyệt viên'}
                </span>
              )}
            </div>
            {profile.organization && <div style={{ marginTop: 4, color: '#64748B', fontSize: 13.5 }}>{profile.organization}</div>}
            {profile.bio && <p style={{ margin: '8px 0 0', color: '#334155', fontSize: 14, lineHeight: 1.5 }}>{profile.bio}</p>}
          </div>

          {!isSelf && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="primary" onClick={handleMessage} disabled={isMessaging}>
                <MessageCircle size={15} />
                {isMessaging ? 'Đang mở...' : 'Nhắn tin'}
              </Button>
              <Button variant="outline" onClick={() => requireAuth(() => setIsReportModalOpen(true))}>
                <Flag size={15} />
                Báo cáo
              </Button>
              {/* Moderator/Admin-only shortcut -- backend independently re-checks this on
                  every /moderation/* endpoint, this is UI-only. */}
              {isModerator && (
                <Button variant="danger" onClick={() => setIsBanModalOpen(true)}>
                  <ShieldAlert size={15} />
                  Hạn chế
                </Button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
            {actionError}
          </div>
        )}

        {/* Recent posts */}
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={17} color="#00236F" /> Bài viết gần đây
          </h2>

          {posts.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 13.5, padding: '8px 0' }}>
              {name} chưa có bài viết nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {posts.map((post) => (
                <a
                  key={post.id}
                  href={`/forum/post/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0F172A' }}>{post.title}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {stripHtml(post.content)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#94A3B8' }}>{post.categoryName} • {post.timeAgo}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {isReportModalOpen && id && (
        <ReportUserModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportedUserId={id} />
      )}

      {isModerator && isBanModalOpen && (
        <BanUserModal
          isOpen={isBanModalOpen}
          onClose={() => setIsBanModalOpen(false)}
          onCreated={() => setIsBanModalOpen(false)}
          presetUser={profile}
        />
      )}
    </div>
  );
};
