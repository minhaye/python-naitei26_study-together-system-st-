import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  Monitor, 
  Hand, 
  PhoneOff, 
  MessageSquare, 
  Users, 
  FileText, 
  Send, 
  Pencil, 
  Type, 
  Eraser, 
  Square, 
  RotateCcw, 
  Trash2, 
  ArrowLeft,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';

export function StudyRoom() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Room states
  const [activeMode, setActiveMode] = useState<'video' | 'whiteboard'>('video');
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'participants' | 'notes'>('chat');
  const [activeBoardTab, setActiveBoardTab] = useState<'whiteboard' | 'presentation'>('whiteboard');
  
  // Media controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Whiteboard tools
  const [selectedTool, setSelectedTool] = useState<'pen' | 'text' | 'eraser' | 'shape'>('pen');
  const [penColor, setPenColor] = useState('#00236F');

  const handleLeaveRoom = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    navigate(`/groups/${id || 1}`);
  };

  // Timer simulation
  const [seconds, setSeconds] = useState(6322); // ~01:45:22

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Participant mock data
  const [participants, setParticipants] = useState([
    { id: 1, name: 'Minh Anh (Bạn)', initial: 'MA', color: '#2563EB', isHost: false, isMuted: isMuted, isCameraOn: isCameraOn, handRaised: isHandRaised, isSpeaking: true },
    { id: 2, name: 'Thầy Hoàng', initial: 'TH', color: '#7C3AED', isHost: true, isMuted: false, isCameraOn: true, handRaised: false, isSpeaking: false },
    { id: 3, name: 'David Chen', initial: 'DC', color: '#059669', isHost: false, isMuted: true, isCameraOn: true, handRaised: false, isSpeaking: false },
    { id: 4, name: 'Elena Rodriguez', initial: 'ER', color: '#D97706', isHost: false, isMuted: false, isCameraOn: false, handRaised: true, isSpeaking: false },
    { id: 5, name: 'Marcus Johnson', initial: 'MJ', color: '#DC2626', isHost: false, isMuted: true, isCameraOn: false, handRaised: false, isSpeaking: false },
    { id: 6, name: 'Priya Patel', initial: 'PP', color: '#DB2777', isHost: false, isMuted: false, isCameraOn: true, handRaised: false, isSpeaking: false }
  ]);

  // Sync user state with participants list
  useEffect(() => {
    setParticipants(prev => prev.map(p => p.id === 1 ? { ...p, isMuted, isCameraOn, handRaised: isHandRaised } : p));
  }, [isMuted, isCameraOn, isHandRaised]);

  // Chat mock data
  const [messages, setMessages] = useState([
    { id: 1, sender: 'David Chen', initial: 'DC', time: '1:12 PM', text: 'Mọi người đã có slide bài giảng chương 4 chưa?', color: '#059669' },
    { id: 2, sender: 'Minh Anh (Bạn)', initial: 'MA', time: '1:15 PM', text: 'Có chứ, lát nữa tớ sẽ bật Bảng trắng chia sẻ ghi chú cho nhé!', color: '#2563EB', isSelf: true },
    { id: 3, sender: 'Elena Rodriguez', initial: 'ER', time: '1:16 PM', text: 'Cảm ơn Sarah! Liam đang có thắc mắc ở phần phương trình Schrödinger đấy.', color: '#D97706' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: 'Minh Anh (Bạn)',
        initial: 'MA',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: chatInput,
        color: '#2563EB',
        isSelf: true
      }
    ]);
    setChatInput('');
  };

  return (
    <div style={{width: '100vw', height: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, sans-serif'}}>
      
      {/* Top Header Bar */}
      <header style={{height: 64, background: '#1E293B', borderBottom: '1px solid #334155', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20, position: 'relative'}}>
        
        {/* Left Info & Back button */}
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button 
            onClick={handleLeaveRoom} 
            style={{background: '#334155', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: '500'}}
          >
            <ArrowLeft size={16} /> Rời phòng
          </button>
          
          <div style={{height: 24, width: 1, background: '#475569'}} />

          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981'}} />
            <h1 style={{fontSize: 16, fontWeight: '600', color: 'white', margin: 0, whiteSpace: 'nowrap'}}>
              Advanced Physics Study Group • <span style={{color: '#94A3B8', fontWeight: '400'}}>Phòng học 101</span>
            </h1>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: '#0F172A', padding: 4, borderRadius: 10, border: '1px solid #334155', display: 'flex', gap: 4}}>
          <button 
            onClick={() => setActiveMode('video')}
            style={{
              padding: '6px 16px', 
              borderRadius: 8, 
              border: 'none', 
              background: activeMode === 'video' ? '#2563EB' : 'transparent', 
              color: activeMode === 'video' ? 'white' : '#94A3B8', 
              fontSize: 13, 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <VideoIcon size={16} /> Gọi Video ({participants.length})
          </button>
          <button 
            onClick={() => setActiveMode('whiteboard')}
            style={{
              padding: '6px 16px', 
              borderRadius: 8, 
              border: 'none', 
              background: activeMode === 'whiteboard' ? '#2563EB' : 'transparent', 
              color: activeMode === 'whiteboard' ? 'white' : '#94A3B8', 
              fontSize: 13, 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <Pencil size={16} /> Bảng Trắng & Ghi Chú
          </button>
        </div>

        {/* Right Timer & Status */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div style={{background: '#334155', padding: '6px 14px', borderRadius: 8, color: '#38BDF8', fontSize: 14, fontFamily: 'monospace', fontWeight: '600'}}>
            {formatTime(seconds)}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{flex: 1, display: 'flex', overflow: 'hidden', position: 'relative'}}>
        
        {/* MODE A: VIDEO GRID CALL VIEW & FOCUS SCREEN SHARE VIEW */}
        {activeMode === 'video' && (
          <div style={{flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', background: '#0F172A'}}>
            
            {/* FOCUS MODE: SCREEN SHARING ACTIVE */}
            {isScreenSharing ? (
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16, height: '100%'}}>
                
                {/* Top Filmstrip of Participants */}
                <div style={{display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, flexShrink: 0}}>
                  {participants.map((p) => (
                    <div 
                      key={p.id}
                      style={{
                        width: 160,
                        height: 96,
                        flexShrink: 0,
                        position: 'relative',
                        background: p.isCameraOn ? '#334155' : '#1E293B',
                        borderRadius: 10,
                        border: p.isSpeaking ? '2px solid #10B981' : '1px solid #334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{width: 40, height: 40, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14}}>
                        {p.initial}
                      </div>

                      {/* Compact Name Tag */}
                      <div style={{position: 'absolute', bottom: 4, left: 6, right: 6, background: 'rgba(15, 23, 42, 0.8)', padding: '2px 6px', borderRadius: 4, color: 'white', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        {p.name}
                      </div>

                      {/* Mic Status */}
                      <div style={{position: 'absolute', top: 4, right: 6, background: p.isMuted ? '#EF4444' : '#10B981', color: 'white', padding: 3, borderRadius: '50%', display: 'flex'}}>
                        {p.isMuted ? <MicOff size={10} /> : <Mic size={10} />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main Focus Screen Spotlight View */}
                <div style={{flex: 1, background: '#1E293B', borderRadius: 16, border: '2px solid #2563EB', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', position: 'relative'}}>
                  
                  {/* Shared Screen Header Bar */}
                  <div style={{height: 44, background: '#0F172A', borderBottom: '1px solid #334155', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <div style={{width: 8, height: 8, borderRadius: '50%', background: '#3B82F6'}} />
                      <span style={{color: 'white', fontSize: 13, fontWeight: '600'}}>Màn hình của Minh Anh (Bạn) • Đang phát trực tiếp</span>
                    </div>

                    <div style={{display: 'flex', gap: 12}}>
                      <button 
                        onClick={() => setIsScreenSharing(false)}
                        style={{padding: '4px 12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: '600', cursor: 'pointer'}}
                      >
                        Dừng chia sẻ
                      </button>
                    </div>
                  </div>

                  {/* Simulated Screen Content (VS Code / Python Study Code) */}
                  <div style={{flex: 1, background: '#090D16', padding: 24, fontFamily: 'Consolas, monospace', color: '#E2E8F0', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8}}>
                    <div style={{color: '#64748B', fontSize: 13}}># Python Code Simulation - Quantum Mechanics Simulation</div>
                    <div style={{color: '#F59E0B', fontSize: 14}}>import <span style={{color: '#38BDF8'}}>numpy</span> as <span style={{color: '#38BDF8'}}>np</span></div>
                    <div style={{color: '#F59E0B', fontSize: 14}}>import <span style={{color: '#38BDF8'}}>matplotlib.pyplot</span> as <span style={{color: '#38BDF8'}}>plt</span></div>
                    <br />
                    <div style={{color: '#3B82F6', fontSize: 14}}>def <span style={{color: '#10B981'}}>schrodinger_wavefunction</span>(x, n, L):</div>
                    <div style={{color: '#E2E8F0', fontSize: 14, paddingLeft: 24}}>return np.sqrt(2 / L) * np.sin(n * np.pi * x / L)</div>
                    <br />
                    <div style={{color: '#64748B', fontSize: 13}}># Plotting the 1D Infinite Potential Well</div>
                    <div style={{color: '#E2E8F0', fontSize: 14}}>L = 1.0  <span style={{color: '#64748B'}}># Width of the box</span></div>
                    <div style={{color: '#E2E8F0', fontSize: 14}}>x = np.linspace(0, L, 1000)</div>
                    <div style={{color: '#EC4899', fontSize: 14}}>print(<span style={{color: '#10B981'}}>&quot;[Live Study Session] Wavefunction rendered successfully.&quot;</span>)</div>

                    {/* Visual graph mockup inside code */}
                    <div style={{marginTop: 16, padding: 16, background: '#1E293B', borderRadius: 8, border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180}}>
                      <div style={{textAlign: 'center', color: '#38BDF8'}}>
                        📊 [Đang trình chiếu Đồ thị Sóng Schrödinger n=1, n=2 trên màn hình học tập]
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              /* STANDARD GRID VIEW WHEN NOT SCREEN SHARING */
              <div style={{
                flex: 1, 
                display: 'grid', 
                gridTemplateColumns: participants.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
                gap: 16,
                alignContent: 'center'
              }}>
                {participants.map((p) => (
                  <div 
                    key={p.id}
                    style={{
                      position: 'relative',
                      aspectRatio: '16/9',
                      background: p.isCameraOn ? '#334155' : '#1E293B',
                      borderRadius: 16,
                      border: p.isSpeaking ? '3px solid #10B981' : '1px solid #334155',
                      boxShadow: p.isSpeaking ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      transition: 'all 0.3s'
                    }}
                  >
                    {/* Camera simulated view or Avatar */}
                    {p.isCameraOn ? (
                      <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <div style={{width: 80, height: 80, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28, fontWeight: 'bold', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'}}>
                          {p.initial}
                        </div>
                      </div>
                    ) : (
                      <div style={{width: 80, height: 80, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28, fontWeight: 'bold'}}>
                        {p.initial}
                      </div>
                    )}

                    {/* Name Tag Overlay */}
                    <div style={{position: 'absolute', bottom: 12, left: 12, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontSize: 13, fontWeight: '500'}}>
                      <span>{p.name}</span>
                      {p.isHost && (
                        <span style={{background: '#3B82F6', color: 'white', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4}}>HOST</span>
                      )}
                    </div>

                    {/* Status Badges (Mic / Hand) */}
                    <div style={{position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6}}>
                      {p.handRaised && (
                        <div style={{background: '#F59E0B', color: 'white', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'bounce 1s infinite'}}>
                          <Hand size={16} />
                        </div>
                      )}
                      <div style={{background: p.isMuted ? '#EF4444' : '#10B981', color: 'white', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        {p.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* MODE B: WHITEBOARD & PRESENTATION VIEW */}
        {activeMode === 'whiteboard' && (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC'}}>
            
            {/* Board Sub-header */}
            <div style={{height: 48, background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', gap: 8}}>
                <button 
                  onClick={() => setActiveBoardTab('whiteboard')}
                  style={{padding: '6px 14px', borderRadius: 6, border: 'none', background: activeBoardTab === 'whiteboard' ? '#EFF6FF' : 'transparent', color: activeBoardTab === 'whiteboard' ? '#1D4ED8' : '#64748B', fontWeight: '600', fontSize: 13, cursor: 'pointer'}}
                >
                  🎨 Bảng trắng chung
                </button>
                <button 
                  onClick={() => setActiveBoardTab('presentation')}
                  style={{padding: '6px 14px', borderRadius: 6, border: 'none', background: activeBoardTab === 'presentation' ? '#EFF6FF' : 'transparent', color: activeBoardTab === 'presentation' ? '#1D4ED8' : '#64748B', fontWeight: '600', fontSize: 13, cursor: 'pointer'}}
                >
                  📄 Slide Bài giảng (Chương 4.pdf)
                </button>
              </div>

              {/* Action buttons */}
              <div style={{display: 'flex', gap: 12}}>
                <button style={{display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontWeight: '500', color: '#334155', cursor: 'pointer'}}>
                  <Download size={14} /> Tải bảng (PNG)
                </button>
                <button style={{display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontWeight: '500', color: '#334155', cursor: 'pointer'}}>
                  <Share2 size={14} /> Chia sẻ link
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div style={{flex: 1, position: 'relative', background: '#FFFFFF', backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '24px 24px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              
              {activeBoardTab === 'whiteboard' ? (
                <div style={{width: '90%', maxWidth: 900, background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 20}}>
                  <h2 style={{color: '#0F172A', fontSize: 24, fontWeight: '700', margin: 0, borderBottom: '2px solid #E2E8F0', paddingBottom: 12}}>
                    Chủ đề 4: Phương trình Schrödinger trong Giếng thế 1D
                  </h2>

                  {/* Formula display box */}
                  <div style={{background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 20, textAlign: 'center'}}>
                    <div style={{color: '#0369A1', fontSize: 22, fontFamily: 'serif', fontWeight: 'bold'}}>
                      iℏ (∂Ψ / ∂t) = ĤΨ
                    </div>
                    <div style={{color: '#0284C7', fontSize: 13, marginTop: 6}}>
                      Phương trình trạng thái cơ học lượng tử phụ thuộc thời gian
                    </div>
                  </div>

                  {/* Notes cards */}
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16}}>
                    <div style={{background: '#FEF9C3', border: '1px solid #FDE047', padding: 16, borderRadius: 10, color: '#854D0E', fontSize: 14, lineHeight: '1.5'}}>
                      <strong>Ghi chú từ Thầy Hoàng:</strong><br />
                      Chú ý điều kiện biên Ψ(0) = 0 và Ψ(L) = 0 đối với giếng thế vô hạn chiều rộng L!
                    </div>
                    <div style={{background: '#ECFDF5', border: '1px solid #6EE7B7', padding: 16, borderRadius: 10, color: '#065F46', fontSize: 14, lineHeight: '1.5'}}>
                      <strong>Giải thích của Tuấn Kiệt:</strong><br />
                      Toán tử Ĥ bao gồm động năng (-ℏ²/2m ∇²) cộng với thế năng V(r).
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{width: '80%', height: '90%', background: 'white', borderRadius: 12, border: '1px solid #CBD5E1', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32}}>
                  <FileText size={64} color="#3B82F6" style={{marginBottom: 16}} />
                  <h3 style={{fontSize: 20, fontWeight: '700', color: '#0F172A', margin: '0 0 8px 0'}}>Slide Bài Giảng Chương 4: Cơ Học Lượng Tử</h3>
                  <p style={{color: '#64748B', fontSize: 14, margin: 0}}>Trang 12 / 45 • Đang trình chiếu trực tiếp bởi Thầy Hoàng</p>
                </div>
              )}

              {/* Floating Drawing Toolbar */}
              <div style={{position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '8px 16px', borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12}}>
                <button 
                  onClick={() => setSelectedTool('pen')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'pen' ? '#EFF6FF' : 'transparent', color: selectedTool === 'pen' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Bút vẽ"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('text')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'text' ? '#EFF6FF' : 'transparent', color: selectedTool === 'text' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Nhập văn bản"
                >
                  <Type size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('shape')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'shape' ? '#EFF6FF' : 'transparent', color: selectedTool === 'shape' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Hình học"
                >
                  <Square size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('eraser')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'eraser' ? '#EFF6FF' : 'transparent', color: selectedTool === 'eraser' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Tẩy xóa"
                >
                  <Eraser size={18} />
                </button>

                <div style={{height: 20, width: 1, background: '#CBD5E1'}} />

                {/* Color Palette */}
                {['#00236F', '#10B981', '#EF4444', '#F59E0B'].map(c => (
                  <div 
                    key={c}
                    onClick={() => setPenColor(c)}
                    style={{
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      background: c, 
                      cursor: 'pointer', 
                      outline: penColor === c ? '2px solid #2563EB' : 'none',
                      outlineOffset: 2
                    }}
                  />
                ))}

                <div style={{height: 20, width: 1, background: '#CBD5E1'}} />

                <button style={{padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer'}} title="Hoàn tác">
                  <RotateCcw size={18} />
                </button>
                <button style={{padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer'}} title="Xóa bảng">
                  <Trash2 size={18} />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* RIGHT COLLAPSIBLE SIDEBAR WITH SLEEK EDGE TOGGLE */}
        {isSidebarOpen ? (
          <aside style={{width: 340, background: '#1E293B', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', zIndex: 10, position: 'relative'}}>
            
            {/* Collapse Edge Handle */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              style={{
                position: 'absolute',
                top: '50%',
                left: -14,
                transform: 'translateY(-50%)',
                background: '#1E293B',
                border: '1px solid #334155',
                borderRight: 'none',
                color: '#94A3B8',
                width: 26,
                height: 48,
                borderRadius: '8px 0 0 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 25,
                boxShadow: '-2px 0 8px rgba(0,0,0,0.2)'
              }}
              title="Thu gọn thanh bên"
            >
              <ChevronRight size={18} />
            </button>

            {/* Sidebar Tabs */}
            <div style={{display: 'flex', borderBottom: '1px solid #334155', background: '#0F172A'}}>
              <button 
                onClick={() => setActiveRightTab('chat')}
                style={{
                  flex: 1, 
                  padding: '14px 0', 
                  border: 'none', 
                  background: 'transparent', 
                  color: activeRightTab === 'chat' ? '#38BDF8' : '#94A3B8', 
                  borderBottom: activeRightTab === 'chat' ? '2px solid #38BDF8' : '2px solid transparent',
                  fontWeight: '600', 
                  fontSize: 13, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <MessageSquare size={16} /> Trò chuyện
              </button>
              <button 
                onClick={() => setActiveRightTab('participants')}
                style={{
                  flex: 1, 
                  padding: '14px 0', 
                  border: 'none', 
                  background: 'transparent', 
                  color: activeRightTab === 'participants' ? '#38BDF8' : '#94A3B8', 
                  borderBottom: activeRightTab === 'participants' ? '2px solid #38BDF8' : '2px solid transparent',
                  fontWeight: '600', 
                  fontSize: 13, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Users size={16} /> Thành viên ({participants.length})
              </button>
              <button 
                onClick={() => setActiveRightTab('notes')}
                style={{
                  flex: 1, 
                  padding: '14px 0', 
                  border: 'none', 
                  background: 'transparent', 
                  color: activeRightTab === 'notes' ? '#38BDF8' : '#94A3B8', 
                  borderBottom: activeRightTab === 'notes' ? '2px solid #38BDF8' : '2px solid transparent',
                  fontWeight: '600', 
                  fontSize: 13, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <FileText size={16} /> Tài liệu
              </button>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeRightTab === 'chat' && (
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden'}}>
                
                {/* Messages List */}
                <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16}}>
                  {messages.map((m) => (
                    <div key={m.id} style={{display: 'flex', gap: 10, flexDirection: m.isSelf ? 'row-reverse' : 'row'}}>
                      <div style={{width: 32, height: 32, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, flexShrink: 0}}>
                        {m.initial}
                      </div>
                      <div style={{maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: m.isSelf ? 'flex-end' : 'flex-start'}}>
                        <div style={{display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4}}>
                          <span style={{color: '#94A3B8', fontSize: 11, fontWeight: '600'}}>{m.sender}</span>
                          <span style={{color: '#64748B', fontSize: 10}}>{m.time}</span>
                        </div>
                        <div style={{
                          padding: '10px 14px', 
                          borderRadius: m.isSelf ? '14px 2px 14px 14px' : '2px 14px 14px 14px', 
                          background: m.isSelf ? '#2563EB' : '#334155', 
                          color: 'white', 
                          fontSize: 13, 
                          lineHeight: '1.4'
                        }}>
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div style={{padding: 16, background: '#0F172A', borderTop: '1px solid #334155', display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input 
                    type="text" 
                    placeholder="Nhập tin nhắn vào phòng học..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{flex: 1, padding: '10px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, outline: 'none', color: 'white', fontSize: 13}}
                  />
                  <button 
                    onClick={handleSendMessage}
                    style={{background: '#2563EB', border: 'none', color: 'white', padding: 10, borderRadius: 8, cursor: 'pointer'}}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PARTICIPANTS */}
            {activeRightTab === 'participants' && (
              <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
                <span style={{color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5}}>Danh sách đang tham gia</span>
                {participants.map((p) => (
                  <div key={p.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <div style={{width: 36, height: 36, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 13}}>
                        {p.initial}
                      </div>
                      <div>
                        <div style={{color: 'white', fontSize: 13, fontWeight: '600', display: 'flex', alignItems: 'center', gap: 6}}>
                          {p.name}
                          {p.isHost && <span style={{background: '#3B82F6', color: 'white', fontSize: 10, padding: '1px 5px', borderRadius: 4}}>Host</span>}
                        </div>
                        <div style={{color: '#94A3B8', fontSize: 11}}>{p.isSpeaking ? '🔊 Đang nói' : 'Chờ'}</div>
                      </div>
                    </div>

                    <div style={{display: 'flex', gap: 8, color: '#94A3B8'}}>
                      {p.handRaised && <Hand size={16} color="#F59E0B" />}
                      {p.isMuted ? <MicOff size={16} color="#EF4444" /> : <Mic size={16} color="#10B981" />}
                      {p.isCameraOn ? <VideoIcon size={16} color="#10B981" /> : <VideoOff size={16} color="#EF4444" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: RESOURCES & NOTES */}
            {activeRightTab === 'notes' && (
              <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16}}>
                <span style={{color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5}}>Tài liệu phòng học</span>
                
                <div style={{background: '#0F172A', padding: 12, borderRadius: 10, border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                  <FileText color="#38BDF8" size={24} />
                  <div style={{flex: 1}}>
                    <div style={{color: 'white', fontSize: 13, fontWeight: '600'}}>Slide_Chuong_4_Schrodinger.pdf</div>
                    <div style={{color: '#64748B', fontSize: 11}}>3.2 MB • Thầy Hoàng đăng</div>
                  </div>
                  <Download size={16} color="#94A3B8" />
                </div>

                <div style={{background: '#0F172A', padding: 12, borderRadius: 10, border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'}}>
                  <FileText color="#10B981" size={24} />
                  <div style={{flex: 1}}>
                    <div style={{color: 'white', fontSize: 13, fontWeight: '600'}}>Ghi_chep_phong_hoc_101.docx</div>
                    <div style={{color: '#64748B', fontSize: 11}}>2.1 MB • Đang tự động lưu</div>
                  </div>
                  <Download size={16} color="#94A3B8" />
                </div>
              </div>
            )}

          </aside>
        ) : (
          /* Sleek Right-Edge Chevron Handle when closed */
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '10px 0 0 10px',
              padding: '16px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '-4px 0 16px rgba(37, 99, 235, 0.4)',
              cursor: 'pointer',
              zIndex: 30,
              transition: 'all 0.2s'
            }}
            title="Mở thanh tiện ích (Trò chuyện & Thành viên)"
          >
            <ChevronLeft size={22} />
          </button>
        )}

      </div>

      {/* Floating Bottom Control Dock */}
      <footer style={{height: 72, background: '#1E293B', borderTop: '1px solid #334155', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 30, position: 'relative'}}>
        
        {/* Left indicators */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13}}>
          <Sparkles size={18} color="#38BDF8" />
          <span>StudyTogether Call Room v2.0</span>
        </div>

        {/* Center Control Buttons */}
        <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 16}}>
          
          {/* Mic */}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: isMuted ? '#EF4444' : '#334155', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isMuted ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
            title={isMuted ? 'Bật micro' : 'Tắt micro'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Camera */}
          <button 
            onClick={() => setIsCameraOn(!isCameraOn)}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: !isCameraOn ? '#EF4444' : '#334155', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: !isCameraOn ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
              transition: 'all 0.2s'
            }}
            title={isCameraOn ? 'Tắt camera' : 'Bật camera'}
          >
            {!isCameraOn ? <VideoOff size={20} /> : <VideoIcon size={20} />}
          </button>

          {/* Screen Share */}
          <button 
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: isScreenSharing ? '#2563EB' : '#334155', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Chia sẻ màn hình"
          >
            <Monitor size={20} />
          </button>

          {/* Raise Hand */}
          <button 
            onClick={() => setIsHandRaised(!isHandRaised)}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: isHandRaised ? '#F59E0B' : '#334155', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Giơ tay phát biểu"
          >
            <Hand size={20} />
          </button>

          {/* Leave Room Button */}
          <button 
            onClick={handleLeaveRoom}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: '#DC2626', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s'
            }}
            title="Thoát phòng học"
          >
            <PhoneOff size={20} />
          </button>

        </div>

      </footer>

    </div>
  );
}