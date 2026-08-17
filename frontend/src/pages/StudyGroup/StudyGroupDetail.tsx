import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Hash, 
    Video, 
    FileText, 
    Mic, 
    MicOff, 
    Settings, 
    Send, 
    UserPlus, 
    MoreVertical,
    ChevronDown,
    Shield,
    Globe,
    Lock,
    LogOut,
    Users
} from 'lucide-react';

export function StudyGroupDetail() {
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Dynamic States
  const [activeChannel, setActiveChannel] = useState('thao-luan-chung');
  const [chatInput, setChatInput] = useState('');
  const [mainView, setMainView] = useState<'chat' | 'rooms' | 'documents'>('chat');

  // Group Settings & Dropdown Menu States
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [ownerNote, setOwnerNote] = useState('Nhắc nhở từ Thầy Hoàng: Đọc slide Bài 4 trước 15h hôm nay!');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [newNote, setNewNote] = useState(ownerNote);
  const [userRole, setUserRole] = useState<'HOST' | 'ADMIN' | 'MEMBER'>('HOST');

  // Mock data for chat messages across channels
  const [messages, setMessages] = useState<Record<string, any[]>>({
    'thao-luan-chung': [
      { id: 1, sender: 'Thầy Hoàng', role: 'HOST', time: 'Hôm nay lúc 10:30 AM', text: 'Chào cả nhà, mình mới tham gia nhóm. Chúc mọi người học tập tốt! Nhớ đọc tài liệu chương 4 trước buổi học chiều nay nhé.', avatar: 'https://i.pravatar.cc/150?img=12' },
      { id: 2, sender: 'Minh Anh', time: 'Hôm nay lúc 10:32 AM', text: 'Dạ vâng ạ. Mọi người đã xem tài liệu chương 4 chưa? Có phần phương trình Schrödinger hơi khó hiểu, ai giải thích giúp mình được không?', avatar: 'https://i.pravatar.cc/150?img=11' },
      { id: 3, sender: 'Tuấn Kiệt', time: 'Hôm nay lúc 10:35 AM', text: 'Mình cũng đang kẹt phần đó đây 😭 Hay lát nữa vào phòng Live anh em cùng thảo luận luôn đi?', avatar: 'https://i.pravatar.cc/150?img=13' }
    ],
    'chia-se-tai-lieu': [
      { id: 1, sender: 'Lan Phương', time: 'Hôm qua lúc 08:00 PM', text: 'Mình vừa upload slide bài giảng tuần trước, mọi người tải về tham khảo nhé!', avatar: 'https://i.pravatar.cc/150?img=9' }
    ]
  });

  // Auto-scroll chat to bottom on new message or channel change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel, mainView]);

  // Mock data for multiple live rooms
  const rooms = [
    { id: '101', name: 'Phòng 101', isLive: true, members: 6, subject: 'Cơ học lượng tử' },
    { id: '103', name: 'Phòng 103', isLive: true, members: 3, subject: 'Giải bài tập nhóm' },
    { id: '104', name: 'Phòng 104', isLive: true, members: 8, subject: 'Ôn tập giữa kỳ' },
    { id: '105', name: 'Phòng 105', isLive: true, members: 15, subject: 'Thảo luận tự do' },
    { id: '106', name: 'Phòng 106', isLive: true, members: 2, subject: 'Hỏi đáp bài tập' },
    { id: '102', name: 'Phòng 102', isLive: false, members: 12, subject: '' }
  ];

  const liveRooms = rooms.filter(r => r.isLive);

  const handleJoinRoom = (roomId: string) => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    navigate(`/room/${roomId}`);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      sender: 'Minh Anh (Bạn)',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: chatInput,
      avatar: 'https://i.pravatar.cc/150?img=11'
    };

    setMessages(prev => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] || []), newMessage]
    }));
    
    setChatInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', width: '100%', overflow: 'hidden'}}>
        {/* Main Content - Discord-like 3-pane layout */}
        <div style={{display: 'flex', flex: 1, overflow: 'hidden', background: 'white', width: '100%'}}>
            
            {/* Left Sidebar - Channels & Rooms */}
            <div style={{width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderRight: '1px solid #E2E8F0'}}>
                {/* Group Info Header with Discord-style Menu */}
                <div style={{position: 'relative', borderBottom: '1px solid #E2E8F0'}}>
                    <div 
                        onClick={() => setShowGroupMenu(!showGroupMenu)}
                        style={{
                            padding: '16px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            justify: 'space-between', 
                            alignItems: 'center',
                            background: showGroupMenu ? '#F1F5F9' : 'transparent',
                            transition: 'background 0.2s'
                        }}
                    >
                        <div style={{flex: 1, minWidth: 0, paddingRight: 8}}>
                            <div style={{color: '#0B1C30', fontSize: 16, fontFamily: 'Inter', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                Cơ học lượng tử 101
                            </div>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                                <span style={{padding: '2px 6px', background: isPublic ? '#DCFCE7' : '#FEF3C7', color: isPublic ? '#15803D' : '#B45309', borderRadius: 4, fontSize: 10, fontWeight: '700'}}>
                                    {isPublic ? 'Public' : 'Private'}
                                </span>
                                <span>• 4 thành viên</span>
                            </div>
                        </div>
                        <ChevronDown size={18} color="#64748B" style={{transform: showGroupMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}} />
                    </div>

                    {/* Discord-style Dropdown Menu */}
                    {showGroupMenu && (
                        <div 
                            style={{
                                position: 'absolute', 
                                top: '100%', 
                                left: 8, 
                                right: 8, 
                                zIndex: 50, 
                                background: 'white', 
                                borderRadius: 8, 
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', 
                                border: '1px solid #E2E8F0', 
                                padding: '6px', 
                                marginTop: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2
                            }}
                        >
                            <div 
                                onClick={() => { alert('Mở bảng Cài đặt nhóm học'); setShowGroupMenu(false); }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Settings size={16} color="#475569" /> Cài đặt nhóm
                            </div>

                            {userRole === 'HOST' && (
                                <>
                                    <div 
                                        onClick={() => { alert('Phân quyền và quản lý danh sách vai trò'); setShowGroupMenu(false); }}
                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Shield size={16} color="#475569" /> Phân quyền & Vai trò
                                    </div>

                                    <div 
                                        onClick={() => { setIsPublic(!isPublic); setShowGroupMenu(false); }}
                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {isPublic ? <Lock size={16} color="#475569" /> : <Globe size={16} color="#475569" />} 
                                        {isPublic ? 'Chuyển sang Riêng tư' : 'Chuyển sang Công khai'}
                                    </div>
                                </>
                            )}

                            <div 
                                onClick={() => { alert('Đã sao chép liên kết mời tham gia nhóm học!'); setShowGroupMenu(false); }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <UserPlus size={16} color="#475569" /> Mời thêm người
                            </div>

                            <div style={{height: 1, background: '#E2E8F0', margin: '4px 0'}} />

                            <div 
                                onClick={() => { navigate('/groups'); }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#DC2626', cursor: 'pointer'}}
                                onMouseOver={e => e.currentTarget.style.background = '#FEF2F2'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <LogOut size={16} color="#DC2626" /> Rời nhóm học
                            </div>
                        </div>
                    )}
                </div>

                {/* Owner Note / Announcement Banner */}
                <div style={{
                    margin: '12px 12px 4px 12px',
                    padding: '12px 14px',
                    background: '#F0F9FF',
                    borderRadius: '8px',
                    border: '1px solid #BAE6FD',
                    borderLeft: '4px solid #0284C7',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6}}>
                        <span style={{fontSize: 11, fontWeight: '700', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                            Ghi chú
                        </span>
                        {userRole === 'HOST' && (
                            <span 
                                onClick={(e) => { e.stopPropagation(); setIsEditingNote(!isEditingNote); }} 
                                style={{fontSize: 11, fontWeight: '600', color: '#0284C7', cursor: 'pointer', textDecoration: 'underline'}}
                            >
                                {isEditingNote ? 'Hủy' : 'Sửa'}
                            </span>
                        )}
                    </div>
                    {isEditingNote ? (
                        <div style={{marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6}}>
                            <textarea 
                                value={newNote} 
                                onChange={e => setNewNote(e.target.value)}
                                style={{
                                    padding: '6px 8px', 
                                    fontSize: 12, 
                                    borderRadius: 6, 
                                    border: '1px solid #7DD3FC', 
                                    outline: 'none',
                                    resize: 'vertical',
                                    minHeight: '54px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <button 
                                onClick={() => { setOwnerNote(newNote); setIsEditingNote(false); }}
                                style={{
                                    padding: '4px 12px', 
                                    background: '#0284C7', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: 4, 
                                    fontSize: 11, 
                                    fontWeight: '600', 
                                    cursor: 'pointer', 
                                    alignSelf: 'flex-end',
                                    transition: 'background 0.2s'
                                }}
                            >
                                Lưu
                            </button>
                        </div>
                    ) : (
                        <div style={{fontSize: 12.5, color: '#0F172A', lineHeight: '1.5', fontWeight: '450'}}>
                            {ownerNote}
                        </div>
                    )}
                </div>

                {/* Scrollable Channels List */}
                <div style={{flex: 1, overflowY: 'auto', padding: '16px 8px'}}>
                    
                    {/* Text Channels */}
                    <div style={{marginBottom: 24}}>
                        <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8}}>Kênh Chat</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            <div 
                                onClick={() => { setActiveChannel('thao-luan-chung'); setMainView('chat'); }}
                                style={{padding: '8px 12px', background: activeChannel === 'thao-luan-chung' && mainView === 'chat' ? '#E2E8F0' : 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: activeChannel === 'thao-luan-chung' && mainView === 'chat' ? '#0F172A' : '#475569', fontWeight: activeChannel === 'thao-luan-chung' && mainView === 'chat' ? '600' : '500', cursor: 'pointer'}}
                                onMouseOver={e => (activeChannel !== 'thao-luan-chung' || mainView !== 'chat') && (e.currentTarget.style.background = '#F1F5F9')} 
                                onMouseOut={e => (activeChannel !== 'thao-luan-chung' || mainView !== 'chat') && (e.currentTarget.style.background = 'transparent')}
                            >
                                <Hash size={18} color={activeChannel === 'thao-luan-chung' && mainView === 'chat' ? '#64748B' : '#94A3B8'} /> thao-luan-chung
                            </div>
                            <div 
                                onClick={() => { setActiveChannel('chia-se-tai-lieu'); setMainView('chat'); }}
                                style={{padding: '8px 12px', background: activeChannel === 'chia-se-tai-lieu' && mainView === 'chat' ? '#E2E8F0' : 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: activeChannel === 'chia-se-tai-lieu' && mainView === 'chat' ? '#0F172A' : '#475569', fontWeight: activeChannel === 'chia-se-tai-lieu' && mainView === 'chat' ? '600' : '500', cursor: 'pointer'}}
                                onMouseOver={e => (activeChannel !== 'chia-se-tai-lieu' || mainView !== 'chat') && (e.currentTarget.style.background = '#F1F5F9')} 
                                onMouseOut={e => (activeChannel !== 'chia-se-tai-lieu' || mainView !== 'chat') && (e.currentTarget.style.background = 'transparent')}
                            >
                                <Hash size={18} color={activeChannel === 'chia-se-tai-lieu' ? '#64748B' : '#94A3B8'} /> chia-se-tai-lieu
                            </div>
                        </div>
                    </div>

                    {/* Voice / Video Rooms */}
                    <div style={{marginBottom: 24}}>
                        <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8}}>Phòng học đang Live</div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {/* Limit Live Rooms to top 2 for Sidebar */}
                            {liveRooms.slice(0, 2).map(room => (
                                <div key={room.id} style={{padding: '10px 12px', background: '#E0E7FF', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', border: '1px solid #C7D2FE'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#4338CA', fontWeight: '600'}}>
                                            <Video size={16} /> {room.name}
                                        </div>
                                        <div style={{background: '#10B981', color: 'white', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4}}>LIVE</div>
                                    </div>
                                    {room.subject && (
                                        <div style={{fontSize: 12, color: '#475569', paddingLeft: 24}}>
                                            Chủ đề: {room.subject} ({room.members} tv)
                                        </div>
                                    )}
                                    <div 
                                      onClick={() => handleJoinRoom(room.id)}
                                      style={{padding: '8px 0', background: 'white', borderRadius: 6, textAlign: 'center', color: '#4338CA', fontSize: 12, fontWeight: '600', border: '1px solid #C7D2FE', cursor: 'pointer', transition: 'all 0.2s'}}
                                      onMouseOver={e => e.currentTarget.style.background = '#EEF2FF'} 
                                      onMouseOut={e => e.currentTarget.style.background = 'white'}
                                    >
                                        Tham gia ngay
                                    </div>
                                </div>
                            ))}

                            {/* View All Live Rooms Button */}
                            {liveRooms.length > 2 && (
                                <div 
                                    onClick={() => setMainView('rooms')}
                                    style={{padding: '8px', textAlign: 'center', color: '#4338CA', fontSize: 13, fontWeight: '600', cursor: 'pointer', borderRadius: 6, background: '#EEF2FF', border: '1px dashed #C7D2FE', transition: 'all 0.2s'}}
                                    onMouseOver={e => e.currentTarget.style.background = '#E0E7FF'} 
                                    onMouseOut={e => e.currentTarget.style.background = '#EEF2FF'}
                                >
                                    Xem tất cả {liveRooms.length} phòng Live
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Resources */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8}}>Tài liệu đính kèm</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            <div style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <FileText size={18} color="#3B82F6" style={{marginTop: 2}} />
                                <div>
                                    <div style={{color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 2}}>Bai_Giang_Chuong_1.pdf</div>
                                    <div style={{color: '#94A3B8', fontSize: 11}}>2.4 MB • Tải xuống</div>
                                </div>
                            </div>
                            <div style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <FileText size={18} color="#10B981" style={{marginTop: 2}} />
                                <div>
                                    <div style={{color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 2}}>Ghi_chep_nhom.docx</div>
                                    <div style={{color: '#94A3B8', fontSize: 11}}>Đang cùng chỉnh sửa</div>
                                </div>
                            </div>
                        </div>
                        {/* Nút Xem tất cả tài liệu đính kèm */}
                        <div style={{marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12}}>
                            <div 
                                onClick={() => setMainView('documents')}
                                style={{padding: '8px', textAlign: 'center', color: '#4338CA', fontSize: 13, fontWeight: '600', cursor: 'pointer', borderRadius: 6, background: '#EEF2FF', border: '1px dashed #C7D2FE', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6}}
                                onMouseOver={e => e.currentTarget.style.background = '#E0E7FF'} 
                                onMouseOut={e => e.currentTarget.style.background = '#EEF2FF'}
                            >
                                Xem tất cả tài liệu
                            </div>
                        </div>
                    </div>

                </div>


            </div>

            {/* Center - Main Area */}
            {mainView === 'chat' ? (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white'}}>
                    
                    {/* Chat Header */}
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A', fontSize: 18, fontWeight: '700'}}>
                            <Hash size={24} color="#64748B" /> {activeChannel}
                        </div>
                        <div style={{display: 'flex', gap: 16, color: '#64748B'}}>
                        </div>
                    </div>

                    {/* Messages List */}
                    <div style={{flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20}}>
                        
                        {/* Welcome Message */}
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0', color: '#94A3B8'}}>
                            <Hash size={48} color="#CBD5E1" style={{marginBottom: 16}} />
                            <div style={{fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8}}>Chào mừng đến với #{activeChannel}!</div>
                            <div style={{fontSize: 14}}>Đây là sự khởi đầu của kênh #{activeChannel}.</div>
                        </div>

                        {/* Map through active channel messages */}
                        {(messages[activeChannel] || []).map((msg) => (
                            <div key={msg.id} style={{display: 'flex', gap: 16}}>
                                <img style={{width: 40, height: 40, borderRadius: '50%'}} src={msg.avatar} alt="Avatar" />
                                <div>
                                    <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4}}>
                                        <span style={{color: '#0F172A', fontSize: 15, fontWeight: '600'}}>{msg.sender}</span>
                                        {msg.role === 'HOST' && (
                                            <span style={{background: '#EEF2FF', color: '#4338CA', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4}}>HOST</span>
                                        )}
                                        <span style={{color: '#94A3B8', fontSize: 12}}>{msg.time}</span>
                                    </div>
                                    <div style={{color: '#334155', fontSize: 15, lineHeight: '1.5', wordBreak: 'break-word'}}>
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div style={{padding: '0 24px 24px 24px'}}>
                        <div style={{background: '#F1F5F9', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '12px 16px', border: '1px solid #E2E8F0', transition: 'border-color 0.2s'}}>
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={`Nhắn tin cho #${activeChannel}...`} 
                                style={{border: 'none', background: 'transparent', flex: 1, outline: 'none', fontSize: 15, color: '#0F172A'}} 
                            />
                            <button onClick={handleSendMessage} style={{background: 'transparent', border: 'none', padding: 0, display: 'flex', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', opacity: chatInput.trim() ? 1 : 0.5}}>
                              <Send size={20} color="#00236F" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : mainView === 'rooms' ? (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC'}}>
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', color: '#0F172A', fontSize: 18, fontWeight: '700', background: 'white'}}>
                        Danh sách Phòng học Live ({liveRooms.length})
                    </div>
                    <div style={{flex: 1, overflowY: 'auto', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24, alignContent: 'flex-start'}}>
                        {liveRooms.map(room => (
                            <div key={room.id} style={{background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column'}}>
                                <div style={{height: 100, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #E2E8F0'}}>
                                    <Video size={36} color="#60A5FA" />
                                    <div style={{position: 'absolute', top: 12, right: 12, background: '#10B981', color: 'white', fontSize: 10, fontWeight: '700', padding: '4px 8px', borderRadius: 4, letterSpacing: 0.5}}>LIVE</div>
                                    <div style={{position: 'absolute', bottom: 12, left: 16, color: '#334155', fontSize: 12, fontWeight: '600', display: 'flex', alignItems: 'center', gap: 6}}>
                                        <div style={{width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'}}></div>
                                        {room.members} đang học
                                    </div>
                                </div>
                                <div style={{padding: 20, flex: 1, display: 'flex', flexDirection: 'column'}}>
                                    <div style={{fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6}}>{room.name}</div>
                                    <div style={{fontSize: 14, color: '#64748B', marginBottom: 20, flex: 1}}>Chủ đề: <span style={{color: '#334155', fontWeight: '500'}}>{room.subject || 'Đang cập nhật'}</span></div>
                                    <button 
                                        onClick={() => handleJoinRoom(room.id)} 
                                        style={{width: '100%', padding: '12px 0', background: '#3B82F6', color: 'white', borderRadius: 8, border: 'none', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#2563EB'} 
                                        onMouseOut={e => e.currentTarget.style.background = '#3B82F6'}
                                    >
                                        Tham gia phòng
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white'}}>
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', color: '#0F172A', fontSize: 18, fontWeight: '700', background: 'white'}}>
                        Tất cả dữ liệu đính kèm
                    </div>
                    {/* Bảng danh sách tài liệu (Zalo Style) */}
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#64748B', fontWeight: '500', background: '#F8FAFC'}}>
                        <div>Tên</div>
                        <div>Kích thước</div>
                        <div>Ngày gửi</div>
                    </div>
                    {/* Danh sách file */}
                    <div style={{flex: 1, overflowY: 'auto'}}>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', transition: 'background 0.2s', cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <div style={{width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <FileText size={20} color="#3B82F6" />
                                </div>
                                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>Bai_Giang_Chuong_1.pdf</div>
                            </div>
                            <div style={{color: '#64748B', fontSize: 13}}>2.4 MB</div>
                            <div style={{color: '#64748B', fontSize: 13}}>22/07/2026</div>
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', transition: 'background 0.2s', cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <div style={{width: 36, height: 36, borderRadius: 8, background: '#ECFDF5', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <FileText size={20} color="#10B981" />
                                </div>
                                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>Ghi_chep_nhom.docx</div>
                            </div>
                            <div style={{color: '#64748B', fontSize: 13}}>261 KB</div>
                            <div style={{color: '#64748B', fontSize: 13}}>22/07/2026</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Sidebar - Members */}
            <div style={{width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderLeft: '1px solid #E2E8F0'}}>
                
                {/* Header */}
                <div style={{padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white'}}>
                    <div style={{color: '#0F172A', fontWeight: '700', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%'}}>
                        <Users size={18} color="#00236F" /> Thành viên (4)
                    </div>
                </div>

                {/* Members List */}
                <div style={{flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24}}>
                    
                    {/* Role Group: Host */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12}}>Giảng viên / Trưởng nhóm</div>
                        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{position: 'relative'}}>
                                <img style={{width: 36, height: 36, borderRadius: '50%'}} src="https://i.pravatar.cc/150?img=12" alt="Avatar" />
                                <div style={{position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#10B981', borderRadius: '50%', border: '2px solid #F8FAFC'}}></div>
                            </div>
                            <div style={{flex: 1}}>
                                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>Thầy Hoàng</div>
                                <div style={{color: '#64748B', fontSize: 12}}>Host</div>
                            </div>
                        </div>
                    </div>

                    {/* Role Group: Members */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12}}>Thành viên</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                            
                            {/* Member 1 (You) */}
                            <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{position: 'relative'}}>
                                    <img style={{width: 36, height: 36, borderRadius: '50%'}} src="https://i.pravatar.cc/150?img=11" alt="Avatar" />
                                    <div style={{position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#10B981', borderRadius: '50%', border: '2px solid #F8FAFC'}}></div>
                                </div>
                                <div style={{flex: 1}}>
                                    <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>Minh Anh <span style={{color: '#94A3B8', fontWeight: '400'}}>(Bạn)</span></div>
                                    <div style={{color: '#10B981', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4}}><Mic size={12}/> Đang nói</div>
                                </div>
                            </div>

                            {/* Member 2 */}
                            <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{position: 'relative'}}>
                                    <img style={{width: 36, height: 36, borderRadius: '50%'}} src="https://i.pravatar.cc/150?img=13" alt="Avatar" />
                                    <div style={{position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#EF4444', borderRadius: '50%', border: '2px solid #F8FAFC'}}></div>
                                </div>
                                <div style={{flex: 1}}>
                                    <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>Tuấn Kiệt</div>
                                    <div style={{color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4}}><MicOff size={12}/> Tắt mic</div>
                                </div>
                            </div>

                            {/* Member 3 (Offline) */}
                            <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'pointer', opacity: 0.6}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <div style={{position: 'relative'}}>
                                    <div style={{width: 36, height: 36, borderRadius: '50%', background: '#CBD5E1', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700'}}>L</div>
                                    <div style={{position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#94A3B8', borderRadius: '50%', border: '2px solid #F8FAFC'}}></div>
                                </div>
                                <div style={{flex: 1}}>
                                    <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>Lan Phương</div>
                                    <div style={{color: '#64748B', fontSize: 12}}>Ngoại tuyến</div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

                {/* Invite Button */}
                <div style={{padding: '16px', borderTop: '1px solid #E2E8F0', background: 'white'}}>
                    <button style={{width: '100%', padding: '10px', background: '#00236F', color: 'white', border: 'none', borderRadius: 6, fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                        <UserPlus size={18} /> Mời thêm người
                    </button>
                </div>
            </div>

        </div>
    </div>
  );
}
