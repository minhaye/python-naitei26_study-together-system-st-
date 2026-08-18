import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, UserPlus, Users, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getGroups, listGroupMembers, createGroup, joinGroup } from '../../lib/group.api';
import { ApiError } from '../../lib/apiClient';
import { JoinByCodeModal } from '../../components/invitations/JoinByCodeModal';
import type { Group, GroupMember, GroupMemberRole } from '../../lib/group.types';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';

interface GroupWithMembership {
    group: Group;
    activeMembersCount: number;
    isMember: boolean;
    role: GroupMemberRole | null;
}

function roleLabel(role: GroupMemberRole | null): string {
    if (role === 'owner') return 'Trưởng nhóm';
    if (role === 'moderator') return 'Điều hành viên';
    return 'Thành viên';
}

/** Group has no decorative cover image field beyond avatar_url — fall back to a
 * deterministic color block (from the group id) rather than fabricating one. */
function GroupCover({ group }: { group: Group }) {
    if (group.avatar_url) {
        return <img style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={group.avatar_url} alt={group.name} />;
    }
    return (
        <div style={{ width: '100%', height: '100%', background: getAvatarColor(group.id), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 32, fontWeight: 700, fontFamily: 'Inter' }}>{getAvatarInitials(group.name)}</span>
        </div>
    );
}

export function StudyRooms() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentUserId = user?.id ?? null;

    // State ẩn/hiện danh mục (nút mũi tên gập/mở)
    const [isMyGroupsOpen, setIsMyGroupsOpen] = useState(true);
    const [isDiscoverOpen, setIsDiscoverOpen] = useState(true);

    // Dropdown & Modal State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Join-by-code (real invitation redemption -- see app/invitations/ and
    // JoinByCodeModal, which handles resolve -> preview/mismatch -> redeem -> navigate).
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [groupToJoin, setGroupToJoin] = useState<Group | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [joinActionError, setJoinActionError] = useState<string | null>(null);

    // Create Group modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createIsPublic, setCreateIsPublic] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Real groups from GET /groups (public_only=true), enriched with real membership
    // from GET /groups/{id}/members so "Nhóm học của tôi" vs "Khám phá" reflects backend truth.
    const [groups, setGroups] = useState<GroupWithMembership[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadGroups = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const list = await getGroups(true);
            const enriched = await Promise.all(
                list.map(async (group): Promise<GroupWithMembership> => {
                    let members: GroupMember[] = [];
                    try {
                        members = await listGroupMembers(group.id);
                    } catch {
                        // Membership is supplementary here (role badge / My-Groups split);
                        // a failure to load it shouldn't hide the group itself.
                    }
                    const activeMembers = members.filter((m) => m.status === 'active');
                    const mine = currentUserId ? activeMembers.find((m) => m.user_id === currentUserId) : undefined;
                    return {
                        group,
                        activeMembersCount: activeMembers.length,
                        isMember: !!mine,
                        role: mine?.role ?? null,
                    };
                })
            );
            setGroups(enriched);
        } catch (err) {
            setLoadError(err instanceof ApiError ? err.message : 'Không thể tải danh sách nhóm học.');
            setGroups(null);
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!cancelled) await loadGroups();
        })();
        return () => {
            cancelled = true;
        };
    }, [loadGroups]);

    async function handleConfirmJoin() {
        if (!groupToJoin || isJoining) return;
        setIsJoining(true);
        setJoinActionError(null);
        try {
            await joinGroup(groupToJoin.id);
            setGroupToJoin(null);
            await loadGroups();
        } catch (err) {
            setJoinActionError(
                err instanceof ApiError ? err.message : 'Không thể tham gia nhóm học.'
            );
        } finally {
            setIsJoining(false);
        }
    }

    async function handleCreateGroup() {
        if (!createName.trim() || isCreating) return;
        setIsCreating(true);
        setCreateError(null);
        try {
            const newGroup = await createGroup({
                name: createName.trim(),
                description: createDescription.trim() || null,
                is_public: createIsPublic,
            });
            setIsCreateModalOpen(false);
            setCreateName('');
            setCreateDescription('');
            setCreateIsPublic(true);
            navigate(`/groups/${newGroup.id}`);
        } catch (err) {
            setCreateError(err instanceof ApiError ? err.message : 'Không thể tạo nhóm học.');
        } finally {
            setIsCreating(false);
        }
    }

    const myGroups = groups?.filter((g) => g.isMember) ?? [];
    const discoverGroups = groups?.filter((g) => !g.isMember) ?? [];

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 64px)', overflowY: 'auto', background: 'linear-gradient(0deg, #F8FAFC 0%, #F8FAFC 100%), white', display: 'flex', justifyContent: 'center' }}>

            {/* Responsive Grid Rules (Tối đa 5 nhóm học trên 1 hàng ngang) */}
            <style>{`
          .study-groups-grid {
            display: grid;
            grid-template-columns: repeat(1, 1fr);
            gap: 24px;
            width: 100%;
          }
          @media (min-width: 580px) {
            .study-groups-grid { grid-template-columns: repeat(2, 1fr); }
          }
          @media (min-width: 860px) {
            .study-groups-grid { grid-template-columns: repeat(3, 1fr); }
          }
          @media (min-width: 1180px) {
            .study-groups-grid { grid-template-columns: repeat(4, 1fr); }
          }
          @media (min-width: 1480px) {
            .study-groups-grid { grid-template-columns: repeat(5, 1fr); }
          }
        `}</style>

            <div style={{ width: '100%', maxWidth: '100%', paddingLeft: 32, paddingRight: 32, paddingTop: 32, paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 36 }}>

                {/* TOP HEADER CONTROLS (Thanh điều hướng & nút Tạo nhóm ở đầu trang) */}
                <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 24 }}>
                    <div style={{ flexDirection: 'column', gap: 4, display: 'flex' }}>
                        <div style={{ color: '#0B1C30', fontSize: 28, fontFamily: 'Inter', fontWeight: '600', lineHeight: '36px' }}>
                            Quản lý & Khám phá nhóm học
                        </div>
                        <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px' }}>
                            Tham gia, khởi tạo và theo dõi tiến độ các nhóm học tập của bạn.
                        </div>
                    </div>
                    <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex' }}>
                        <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <div style={{ color: '#0B1C30', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px' }}>Sắp xếp: Mới nhất</div>
                            <ChevronDown size={16} color="#6B7280" />
                        </div>
                        <div style={{ position: 'relative' }} ref={menuRef}>
                            <div
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: '#00236F', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                                <UserPlus size={16} color="white" />
                                <div style={{ color: 'white', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', lineHeight: '20px' }}>Tham gia hoặc tạo nhóm</div>
                            </div>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 220, background: 'white', borderRadius: 8, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden' }}>
                                    <div
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setCreateError(null);
                                            setIsCreateModalOpen(true);
                                        }}
                                        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <UserPlus size={18} color="#475569" />
                                        <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 500, fontFamily: 'Inter' }}>Tạo nhóm</span>
                                    </div>
                                    <div
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setIsJoinModalOpen(true);
                                        }}
                                        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <UserPlus size={18} color="#475569" />
                                        <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 500, fontFamily: 'Inter' }}>Tham gia nhóm</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div style={{ color: '#64748B', fontSize: 14, padding: '24px 0' }}>Đang tải danh sách nhóm học...</div>
                )}

                {!isLoading && loadError && (
                    <div style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 16, fontSize: 14 }}>
                        {loadError}
                    </div>
                )}

                {!isLoading && !loadError && groups && groups.length === 0 && (
                    <div style={{ color: '#64748B', fontSize: 14, padding: '24px 0' }}>Chưa có nhóm học công khai nào.</div>
                )}

                {!isLoading && !loadError && groups && (
                <>
                {/* SECTION 1: NHÓM HỌC CỦA TÔI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Header Row kèm nút ẩn/hiện (Mũi tên không đuôi) */}
                    <div
                        onClick={() => setIsMyGroupsOpen(!isMyGroupsOpen)}
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isMyGroupsOpen ? <ChevronDown size={22} color="#0B1C30" /> : <ChevronRight size={22} color="#0B1C30" />}
                            <div style={{ color: '#0B1C30', fontSize: 24, fontFamily: 'Inter', fontWeight: '600', lineHeight: '32px' }}>
                                Nhóm học của tôi ({myGroups.length})
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                            {isMyGroupsOpen ? 'Ẩn danh sách' : 'Mở danh sách'}
                        </div>
                    </div>
                    <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', marginTop: -8, paddingLeft: 32 }}>
                        Các nhóm học bạn đã tham gia và đang hoạt động.
                    </div>

                    {/* My Groups Grid */}
                    {isMyGroupsOpen && (
                        <div className="study-groups-grid" style={{ marginTop: 8 }}>
                            {myGroups.map(({ group, activeMembersCount, role }) => (
                                <div key={group.id} style={{ background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ height: 128, position: 'relative', background: '#E5EEFF' }}>
                                        <GroupCover group={group} />
                                    </div>
                                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <div style={{ padding: '4px 12px', background: '#DCFCE7', outline: '1px #BBF7D0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#15803D', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{roleLabel(role)}</div>
                                        </div>
                                        <div style={{ color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8 }}>{group.name}</div>
                                        <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1 }}>{group.description || 'Chưa có mô tả.'}</div>
                                        <div style={{ paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{ width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0 }}>
                                                    <div style={{ color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600' }}>+{activeMembersCount}</div>
                                                </div>
                                            </div>
                                            <Link to={`/groups/${group.id}`} style={{ color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2, textDecoration: 'none' }}>
                                                Vào nhóm <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SECTION 2: KHÁM PHÁ NHÓM HỌC */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Header Row kèm nút ẩn/hiện (Mũi tên không đuôi) */}
                    <div
                        onClick={() => setIsDiscoverOpen(!isDiscoverOpen)}
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isDiscoverOpen ? <ChevronDown size={22} color="#0B1C30" /> : <ChevronRight size={22} color="#0B1C30" />}
                            <div style={{ color: '#0B1C30', fontSize: 24, fontFamily: 'Inter', fontWeight: '600', lineHeight: '32px' }}>
                                Khám phá nhóm học ({discoverGroups.length})
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                            {isDiscoverOpen ? 'Ẩn danh sách' : 'Mở danh sách'}
                        </div>
                    </div>
                    <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', marginTop: -8, paddingLeft: 32 }}>
                        Tìm và tham gia các nhóm học tập phù hợp với bạn.
                    </div>

                    {/* Discover Grid Section */}
                    {isDiscoverOpen && (
                        <div className="study-groups-grid" style={{ marginTop: 8 }}>
                            {discoverGroups.map(({ group, activeMembersCount }) => (
                                <div key={group.id} style={{ background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ height: 128, position: 'relative', background: '#E5EEFF' }}>
                                        <GroupCover group={group} />
                                    </div>
                                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <div style={{ padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400' }}>{group.is_public ? 'Công khai' : 'Riêng tư'}</div>
                                        </div>
                                        <div style={{ color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8 }}>{group.name}</div>
                                        <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1 }}>{group.description || 'Chưa có mô tả.'}</div>
                                        <div style={{ paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{ width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0 }}>
                                                    <div style={{ color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600' }}>+{activeMembersCount}</div>
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => { setJoinActionError(null); setGroupToJoin(group); }}
                                                style={{ color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2 }}
                                            >
                                                <Users size={16} /> Tham gia
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </>
                )}

                {/* Khoảng trống chân trang vừa đủ (~1cm = 36px) */}
                <div style={{ height: 36, width: '100%', minHeight: 36, flexShrink: 0 }} />

            </div>

            {/* Join Group by code -- real invitation redemption (see app/invitations/ and
                JoinByCodeModal, shared with the Study Room/Private Channel entry points on
                StudyGroupDetail.tsx). A room/channel code entered here is rejected with a
                clear mismatch message, not silently treated as a Group join. */}
            <JoinByCodeModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} expectedTarget="group" />

            {/* Modal: Xác nhận tham gia nhóm */}
            {groupToJoin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: 'white', borderRadius: 12, width: 400, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                        <button
                            onClick={() => { setGroupToJoin(null); setJoinActionError(null); }}
                            disabled={isJoining}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isJoining ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                        >
                            ✕
                        </button>

                        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 12, fontFamily: 'Inter' }}>Tham gia nhóm</h2>
                        <p style={{ color: '#475569', fontSize: 14, marginBottom: 16, fontFamily: 'Inter', lineHeight: '20px' }}>
                            Bạn muốn tham gia nhóm học <strong>{groupToJoin.name}</strong>.
                        </p>

                        {joinActionError && (
                            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                                {joinActionError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setGroupToJoin(null); setJoinActionError(null); }}
                                disabled={isJoining}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isJoining ? 'not-allowed' : 'pointer', fontFamily: 'Inter', transition: 'background-color 0.2s' }}
                                onMouseOver={e => !isJoining && (e.currentTarget.style.backgroundColor = '#E2E8F0')}
                                onMouseOut={e => !isJoining && (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmJoin}
                                disabled={isJoining}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: isJoining ? '#93A4C7' : '#00236F', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: isJoining ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                            >
                                {isJoining ? 'Đang tham gia...' : 'Tham gia'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Tạo nhóm học mới */}
            {isCreateModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: 'white', borderRadius: 12, width: 440, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                        <button
                            onClick={() => { if (!isCreating) { setIsCreateModalOpen(false); setCreateError(null); } }}
                            disabled={isCreating}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isCreating ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                        >
                            ✕
                        </button>

                        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 20, fontFamily: 'Inter' }}>Tạo nhóm học mới</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Tên nhóm học *</label>
                            <input
                                type="text"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                placeholder="VD: Nhóm ôn thi Toán rời rạc"
                                disabled={isCreating}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter' }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Mô tả</label>
                            <textarea
                                value={createDescription}
                                onChange={(e) => setCreateDescription(e.target.value)}
                                placeholder="Mô tả ngắn về mục tiêu của nhóm học (không bắt buộc)"
                                disabled={isCreating}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter', resize: 'vertical', minHeight: 72 }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                            <input
                                type="checkbox"
                                id="create-group-public"
                                checked={createIsPublic}
                                onChange={(e) => setCreateIsPublic(e.target.checked)}
                                disabled={isCreating}
                                style={{ width: 16, height: 16, cursor: isCreating ? 'not-allowed' : 'pointer' }}
                            />
                            <label htmlFor="create-group-public" style={{ fontSize: 13, color: '#334155', fontFamily: 'Inter', cursor: isCreating ? 'not-allowed' : 'pointer' }}>
                                Nhóm công khai (mọi người có thể tìm và tham gia)
                            </label>
                        </div>

                        {createError && (
                            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                                {createError}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { if (!isCreating) { setIsCreateModalOpen(false); setCreateError(null); } }}
                                disabled={isCreating}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isCreating ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateGroup}
                                disabled={isCreating || !createName.trim()}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: (isCreating || !createName.trim()) ? '#93A4C7' : '#00236F', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: (isCreating || !createName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                            >
                                {isCreating ? 'Đang tạo...' : 'Tạo nhóm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
