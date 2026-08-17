import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, UserPlus, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StudyGroupItem {
    id: string;
    name: string;
    category: string;
    tag: string;
    description: string;
    coverImage: string;
    onlineCount: number;
    membersCount: number;
    isJoined?: boolean;
    role?: 'Trưởng nhóm' | 'Thành viên';
}

export function StudyRooms() {
    // State ẩn/hiện danh mục (nút mũi tên gập/mở)
    const [isMyGroupsOpen, setIsMyGroupsOpen] = useState(true);
    const [isDiscoverOpen, setIsDiscoverOpen] = useState(true);

    // Dropdown & Modal State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [groupToJoin, setGroupToJoin] = useState<StudyGroupItem | null>(null);
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

    // My Groups (Đã tham gia)
    const [myGroups] = useState<StudyGroupItem[]>([
        {
            id: '101',
            name: 'Cơ học lượng tử 101',
            category: 'KHTN',
            tag: 'Vật lý',
            description: 'Nhóm chuyên nghiên cứu bài tập Vật lý lượng tử, phương trình Schrödinger và thảo luận nhóm.',
            coverImage: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&q=80',
            onlineCount: 4,
            membersCount: 4,
            isJoined: true,
            role: 'Trưởng nhóm'
        },
        {
            id: '102',
            name: 'Lập trình Fullstack React & Python',
            category: 'CNTT',
            tag: 'FastAPI',
            description: 'Cùng nhau xây dựng sản phẩm thực tế, trao đổi code review và làm bài tập lớn.',
            coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80',
            onlineCount: 9,
            membersCount: 28,
            isJoined: true,
            role: 'Thành viên'
        }
    ]);

    // Discover Groups (Chưa tham gia)
    const [discoverGroups, setDiscoverGroups] = useState<StudyGroupItem[]>([
        {
            id: '1',
            name: 'Thuật toán & Cấu trúc dữ liệu',
            category: 'CNTT',
            tag: 'C++',
            description: 'Nhóm tự học và luyện tập các bài toán về CTDL & Thuật toán chuẩn bị.',
            coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80',
            onlineCount: 12,
            membersCount: 45,
            isJoined: false
        },
        {
            id: '2',
            name: 'IELTS Speaking Practice',
            category: 'Ngoại ngữ',
            tag: 'IELTS',
            description: 'Luyện tập speaking hàng ngày qua Google Meet. Yêu cầu đầu vào 6.0+.',
            coverImage: 'https://images.unsplash.com/photo-1546410531-bea4edad646a?w=400&q=80',
            onlineCount: 8,
            membersCount: 12,
            isJoined: false
        },
        {
            id: '3',
            name: 'Giải bài tập Vật Lý 1',
            category: 'KHTN',
            tag: 'Vật lý đại cương',
            description: 'Nhóm hỗ trợ nhau giải đáp các thắc mắc và môn Vật lý đại cương 1.',
            coverImage: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&q=80',
            onlineCount: 0,
            membersCount: 8,
            isJoined: false
        },
        {
            id: '4',
            name: 'UI/UX Design Cơ Bản',
            category: 'Thiết kế',
            tag: 'UI/UX',
            description: 'Cùng nhau học Figma và chia sẻ các case study về trải nghiệm người dùng.',
            coverImage: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80',
            onlineCount: 3,
            membersCount: 22,
            isJoined: false
        },
        {
            id: '5',
            name: 'Machine Learning & Data Science',
            category: 'CNTT',
            tag: 'AI / Python',
            description: 'Thảo luận mô hình học máy cơ bản, xử lý dữ liệu và ứng dụng AI thực tế.',
            coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80',
            onlineCount: 6,
            membersCount: 34,
            isJoined: false
        }
    ]);

    const confirmJoin = () => {
        if (groupToJoin) {
            setDiscoverGroups(prev => prev.filter(g => g.id !== groupToJoin.id));
            setGroupToJoin(null);
        }
    };

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
                                            // TODO: Thêm logic tạo nhóm
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
                            {myGroups.map((group) => (
                                <div key={group.id} style={{ background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ height: 128, position: 'relative', background: '#E5EEFF' }}>
                                        <img style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={group.coverImage} alt={group.name} />
                                        <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 8, height: 8, background: '#10B981', borderRadius: '50%' }} />
                                            <div style={{ color: '#0B1C30', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{group.onlineCount} online</div>
                                        </div>
                                    </div>
                                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <div style={{ padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{group.category}</div>
                                            <div style={{ padding: '4px 12px', background: '#DCFCE7', outline: '1px #BBF7D0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#15803D', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{group.role}</div>
                                        </div>
                                        <div style={{ color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8 }}>{group.name}</div>
                                        <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1 }}>{group.description}</div>
                                        <div style={{ paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{ width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0 }}>
                                                    <div style={{ color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600' }}>+{group.membersCount}</div>
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
                            {discoverGroups.map((group) => (
                                <div key={group.id} style={{ background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ height: 128, position: 'relative', background: '#E5EEFF' }}>
                                        <img style={{ width: '100%', height: '100%', objectFit: 'cover' }} src={group.coverImage} alt={group.name} />
                                        <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 8, height: 8, background: group.onlineCount > 0 ? '#10B981' : '#757682', borderRadius: '50%' }} />
                                            <div style={{ color: group.onlineCount > 0 ? '#0B1C30' : '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{group.onlineCount} online</div>
                                        </div>
                                    </div>
                                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <div style={{ padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600' }}>{group.category}</div>
                                            <div style={{ padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400' }}>{group.tag}</div>
                                        </div>
                                        <div style={{ color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8 }}>{group.name}</div>
                                        <div style={{ color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1 }}>{group.description}</div>
                                        <div style={{ paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{ width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0 }}>
                                                    <div style={{ color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600' }}>+{group.membersCount}</div>
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => setGroupToJoin(group)}
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

                {/* Khoảng trống chân trang vừa đủ (~1cm = 36px) */}
                <div style={{ height: 36, width: '100%', minHeight: 36, flexShrink: 0 }} />

            </div>

            {/* Modal: Tham gia nhóm bằng mã */}
            {isJoinModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: 'white', borderRadius: 12, width: 400, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                        <button 
                            onClick={() => {
                                setIsJoinModalOpen(false);
                                setJoinCode('');
                            }}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 18 }}
                        >
                            ✕
                        </button>
                        
                        <div style={{ width: 80, height: 80, backgroundColor: '#E2E8F0', borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                            <span style={{ fontSize: 40, color: '#475569', fontWeight: 300, fontFamily: 'Inter' }}>#</span>
                        </div>
                        
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 24, fontFamily: 'Inter' }}>Tham gia nhóm bằng mã</h2>
                        
                        <input 
                            type="text" 
                            placeholder="Nhập mã tham gia."
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', marginBottom: 24, boxSizing: 'border-box', fontFamily: 'Inter' }}
                            autoFocus
                        />
                        
                        <button 
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                borderRadius: 6, 
                                backgroundColor: joinCode.trim() ? '#00236F' : '#F1F5F9', 
                                color: joinCode.trim() ? 'white' : '#94A3B8', 
                                border: 'none', 
                                fontSize: 14, 
                                fontWeight: 600, 
                                cursor: joinCode.trim() ? 'pointer' : 'not-allowed', 
                                fontFamily: 'Inter',
                                transition: 'all 0.2s'
                            }}
                            disabled={!joinCode.trim()}
                            onClick={() => {
                                // TODO: Logic tham gia nhóm
                                setIsJoinModalOpen(false);
                                setJoinCode('');
                            }}
                        >
                            Thêm nhóm
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Xác nhận tham gia nhóm */}
            {groupToJoin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: 'white', borderRadius: 12, width: 400, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                        <button 
                            onClick={() => setGroupToJoin(null)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 18 }}
                        >
                            ✕
                        </button>
                        
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 12, fontFamily: 'Inter' }}>Xác nhận tham gia</h2>
                        <p style={{ color: '#475569', fontSize: 14, marginBottom: 24, fontFamily: 'Inter', lineHeight: '20px' }}>
                            Bạn có chắc chắn muốn tham gia nhóm học <strong>{groupToJoin.name}</strong> không?
                        </p>
                        
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setGroupToJoin(null)}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', transition: 'background-color 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={confirmJoin}
                                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#00236F', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', transition: 'background-color 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#001A52'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#00236F'}
                            >
                                Tham gia
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
