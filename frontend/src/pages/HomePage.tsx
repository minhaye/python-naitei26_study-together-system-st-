import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, MessageSquare, ThumbsUp, Share2, Filter, AlertCircle, Edit3 } from 'lucide-react';

export function HomePage() {
  const [isLoggedIn] = useState(() => localStorage.getItem('auth') === 'true');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [showCreatePost, setShowCreatePost] = useState(false);

  const categories = [
    {
      title: 'KHOA HỌC CƠ BẢN',
      items: ['Toán cao cấp', 'Vật lý đại cương', 'Hóa học đại cương']
    },
    {
      title: 'CÔNG NGHỆ THÔNG TIN',
      items: ['Lập trình OOP', 'Cơ sở dữ liệu', 'CTDL & Giải thuật']
    },
    {
      title: 'KINH TẾ - QUẢN TRỊ',
      items: ['Kinh tế vi mô', 'Quản trị học']
    }
  ];

  const posts = [
    {
      id: 1,
      author: { name: 'Hải Minh', initial: 'HM', color: '#2563EB' },
      time: '2 giờ trước',
      topic: 'Toán học',
      title: 'Giúp mình hiểu về tích phân từng phần?',
      content: 'Mình đang mắc ở bài 4 trong phần bài tập. Có ai có thể giải thích chi tiết cách chọn "u" và "dv" sao cho hiệu quả không? Quy tắc "Nhất lốc, nhì đa..." thỉnh thoảng làm mình bối rối khi có logarit tự nhiên.',
      tags: ['#Toán12', '#GiảiTích'],
      likes: 24,
      comments: 8,
    },
    {
      id: 2,
      author: { name: 'Tuấn Tú', initial: 'TT', color: '#10B981' },
      time: '5 giờ trước',
      topic: 'Lập trình OOP',
      title: 'Sự khác biệt giữa Abstract Class và Interface trong Java?',
      content: 'Mọi người cho mình hỏi trong thực tế dự án thì khi nào nên dùng Abstract Class và khi nào thì nên dùng Interface? Mình đọc lý thuyết thì hiểu nhưng áp dụng thực tế thấy khá hoang mang.',
      tags: ['#Java', '#OOP'],
      likes: 45,
      comments: 12,
    }
  ];

  return (
    <div style={{width: '100%', flex: 1, background: '#F8FAFC', display: 'flex', justifyContent: 'center'}}>
      <div style={{width: '100%', maxWidth: '100%', padding: '32px 48px', display: 'flex', gap: '32px'}}>
        
        {/* Sidebar */}
        <div style={{width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24}}>
          
          <div style={{background: 'white', borderRadius: 12, padding: 20, outline: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}}>
            <div style={{position: 'relative', marginBottom: 20}}>
              <Search size={16} color="#94A3B8" style={{position: 'absolute', left: 12, top: 12}} />
              <input 
                type="text" 
                placeholder="Tìm môn học..." 
                style={{width: '100%', padding: '10px 10px 10px 36px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', fontSize: 14, color: '#334155'}}
              />
            </div>

            <div 
              onClick={() => setActiveCategory('Tất cả')}
              style={{
                padding: '10px 16px', 
                background: activeCategory === 'Tất cả' ? '#EFF6FF' : 'transparent', 
                color: activeCategory === 'Tất cả' ? '#1D4ED8' : '#475569', 
                fontWeight: activeCategory === 'Tất cả' ? '600' : '400',
                borderRadius: 8, 
                cursor: 'pointer',
                marginBottom: 16,
                transition: 'all 0.2s'
              }}
            >
              Tất cả môn học
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
              {categories.map((cat, i) => (
                <div key={i}>
                  <div style={{color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 8}}>
                    {cat.title}
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                    {cat.items.map((item, j) => (
                      <div 
                        key={j} 
                        onClick={() => setActiveCategory(item)}
                        style={{
                          padding: '8px 16px', 
                          borderRadius: 8, 
                          cursor: 'pointer',
                          color: activeCategory === item ? '#1D4ED8' : '#334155',
                          background: activeCategory === item ? '#EFF6FF' : 'transparent',
                          fontWeight: activeCategory === item ? '500' : '400',
                          fontSize: 14,
                          transition: 'all 0.2s'
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Feed */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 24}}>
          
          {/* Header Action Area */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <h1 style={{fontSize: 24, fontWeight: '700', color: '#0F172A', margin: 0}}>Diễn đàn thảo luận</h1>
              <div style={{padding: '4px 12px', background: '#DBEAFE', color: '#1E40AF', borderRadius: 999, fontSize: 12, fontWeight: '600'}}>
                {activeCategory}
              </div>
            </div>
            
            <div style={{display: 'flex', gap: 12}}>
              <div 
                onClick={() => alert('Bộ lọc "Mới nhất" đã được chọn!')}
                style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', color: '#475569', fontSize: 14, fontWeight: '500', transition: 'all 0.2s'}}
                onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseOut={e => e.currentTarget.style.background = 'white'}
              >
                <Filter size={16} />
                Mới nhất
                <ChevronDown size={16} />
              </div>
              <button 
                onClick={() => {
                  if(!isLoggedIn) window.location.href = '/login';
                  else setShowCreatePost(!showCreatePost);
                }}
                style={{display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#00236F', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontSize: 14, fontWeight: '600'}}
              >
                <Edit3 size={16} />
                Đặt câu hỏi
              </button>
            </div>
          </div>

          {!isLoggedIn && (
            <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12}}>
              <AlertCircle color="#DC2626" size={20} />
              <div style={{color: '#991B1B', fontSize: 14}}>
                Bạn chưa đăng nhập. Vui lòng <Link to="/login" style={{textDecoration: 'underline', fontWeight: '600', color: '#991B1B'}}>đăng nhập</Link> để hỏi bài và tham gia thảo luận.
              </div>
            </div>
          )}

          {/* Form Tạo câu hỏi khi click Đặt câu hỏi */}
          {showCreatePost && (
            <div style={{width: '100%', padding: 24, background: 'white', boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', borderRadius: 12, border: '1px #E2E8F0 solid', display: 'flex', flexDirection: 'column', gap: 16}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                  <span style={{color: '#757682', fontSize: 12, fontWeight: '400'}}>Chọn môn</span>
                  <select style={{minWidth: 180, padding: '8px 12px', background: 'white', borderRadius: 6, border: '1px #E2E8F0 solid', fontSize: 14, color: '#374151', outline: 'none'}}>
                    <option value="">Tất cả</option>
                    <option value="toan">Toán cao cấp</option>
                    <option value="vatly">Vật lý đại cương</option>
                    <option value="oop">Lập trình OOP</option>
                  </select>
                </div>
              </div>
              <div style={{background: 'white', borderRadius: 8, border: '1px #E2E8F0 solid', padding: 12}}>
                <textarea 
                  placeholder="Nhập nội dung câu hỏi..." 
                  style={{width: '100%', minHeight: 80, border: 'none', outline: 'none', resize: 'vertical', fontSize: 14, fontFamily: 'Inter', color: '#0F172A'}}
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6}}>
                <div style={{padding: '4px 8px', background: '#F9FAFB', borderRadius: 6, border: '1px #E5E7EB solid', display: 'flex', alignItems: 'center', gap: 12}}>
                  <span style={{fontWeight: 'bold', cursor: 'pointer', color: '#64748B', fontSize: 14}}>B</span>
                  <span style={{fontStyle: 'italic', cursor: 'pointer', color: '#64748B', fontSize: 14}}>I</span>
                  <span style={{textDecoration: 'underline', cursor: 'pointer', color: '#64748B', fontSize: 14}}>U</span>
                </div>
                <div style={{display: 'flex', gap: 8}}>
                  <button 
                    onClick={() => setShowCreatePost(false)}
                    style={{padding: '8px 16px', borderRadius: 9999, border: '1px #D1D5DB solid', background: 'white', color: '#0F172A', fontSize: 14, fontWeight: '500', cursor: 'pointer'}}
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      alert('Tạo câu hỏi thành công!');
                      setShowCreatePost(false);
                    }}
                    style={{padding: '8px 16px', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: 9999, fontSize: 14, fontWeight: '500', cursor: 'pointer'}}
                  >
                    Tạo câu hỏi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Posts List */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            {posts.map((post) => (
              <div key={post.id} style={{background: 'white', borderRadius: 16, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'}}>
                
                {/* Post Header */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16}}>
                  <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                    <div style={{width: 44, height: 44, borderRadius: '50%', background: post.author.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 16}}>
                      {post.author.initial}
                    </div>
                    <div>
                      <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        <span style={{fontWeight: '600', color: '#0F172A', fontSize: 15}}>{post.author.name}</span>
                        <span style={{color: '#94A3B8', fontSize: 13}}>• {post.time}</span>
                      </div>
                      <div style={{color: '#64748B', fontSize: 13, marginTop: 2}}>{post.topic}</div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <h2 style={{fontSize: 20, fontWeight: '700', color: '#0F172A', margin: '0 0 12px 0'}}>{post.title}</h2>
                <p style={{fontSize: 15, color: '#334155', lineHeight: '1.6', margin: '0 0 16px 0'}}>
                  {post.content}
                </p>

                {/* Tags */}
                <div style={{display: 'flex', gap: 8, marginBottom: 20}}>
                  {post.tags.map(tag => (
                    <span key={tag} style={{padding: '4px 10px', background: '#F1F5F9', color: '#3B82F6', borderRadius: 6, fontSize: 13, fontWeight: '500'}}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #F1F5F9'}}>
                  <div style={{display: 'flex', gap: 24}}>
                    <div 
                      onClick={() => {
                        if(!isLoggedIn) window.location.href = '/login';
                        else alert('Bạn đã thích bài viết!');
                      }}
                      style={{display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', cursor: 'pointer', transition: 'color 0.2s'}}
                      onMouseOver={e => e.currentTarget.style.color = '#3B82F6'}
                      onMouseOut={e => e.currentTarget.style.color = '#64748B'}
                    >
                      <ThumbsUp size={18} />
                      <span style={{fontWeight: '500', fontSize: 14}}>{post.likes}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6, color: '#3B82F6', cursor: 'pointer'}}>
                      <MessageSquare size={18} />
                      <span style={{fontWeight: '500', fontSize: 14}}>{post.comments} bình luận</span>
                    </div>
                  </div>
                  <div 
                    onClick={() => alert('Đã copy link bài viết để chia sẻ!')}
                    style={{display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', cursor: 'pointer', transition: 'color 0.2s'}}
                    onMouseOver={e => e.currentTarget.style.color = '#3B82F6'}
                    onMouseOut={e => e.currentTarget.style.color = '#64748B'}
                  >
                    <Share2 size={18} />
                    <span style={{fontWeight: '500', fontSize: 14}}>Chia sẻ</span>
                  </div>
                </div>

                {/* Comment Input */}
                <div style={{display: 'flex', gap: 12, marginTop: 20}}>
                  <div style={{width: 36, height: 36, borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                    <span style={{color: '#64748B', fontSize: 14, fontWeight: 'bold'}}>ME</span>
                  </div>
                  <div style={{flex: 1, position: 'relative'}}>
                    <input 
                      type="text" 
                      placeholder="Viết bình luận..." 
                      style={{width: '100%', padding: '10px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 20, outline: 'none', fontSize: 14, color: '#334155'}}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{textAlign: 'center', padding: '24px 0', color: '#64748B', fontSize: 14, fontWeight: '500', cursor: 'pointer'}}>
            Tải thêm câu hỏi...
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24}}>
          
          {/* BÀI VIẾT ĐÃ THÍCH (Chỉ hiển thị khi đã đăng nhập) */}
          {isLoggedIn && (
            <div style={{width: '100%', padding: 16, background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
              <div style={{alignSelf: 'stretch', height: 39, paddingBottom: 8, borderBottom: '1px #E2E8F0 solid', justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.35}}>BÀI VIẾT ĐÃ THÍCH</div>
                <div style={{color: '#1E3A8A', fontSize: 12, fontWeight: '500', cursor: 'pointer'}}>Xem thêm</div>
              </div>
              
              <div style={{alignSelf: 'stretch', flexDirection: 'column', gap: 16, display: 'flex'}}>
                
                {/* Item 1 */}
                <div style={{alignSelf: 'stretch', gap: 12, display: 'flex'}}>
                  <div style={{width: 32, height: 32, background: '#2563EB', borderRadius: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: 12, fontWeight: '600', flexShrink: 0}}>
                    HM
                  </div>
                  <div style={{flex: 1, flexDirection: 'column', gap: 2, display: 'flex'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B'}}>
                      <span style={{color: '#0F172A', fontWeight: '500'}}>Hải Minh</span>
                      <span>•</span>
                      <span>4 ngày trước</span>
                    </div>
                    <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>most useful barrier oat</div>
                    <div style={{display: 'flex', gap: 12, fontSize: 11, color: '#64748B', paddingTop: 2}}>
                      <span>85 thích</span>
                      <span>1 bình luận</span>
                    </div>
                  </div>
                  <div style={{width: 48, height: 48, background: '#F1F5F9', borderRadius: 6, border: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0}}>
                    <div style={{width: 18, height: 18, background: '#CBD5E1', borderRadius: 2}} />
                  </div>
                </div>

                {/* Item 2 */}
                <div style={{alignSelf: 'stretch', gap: 12, display: 'flex'}}>
                  <div style={{width: 32, height: 32, background: '#10B981', borderRadius: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: 12, fontWeight: '600', flexShrink: 0}}>
                    TT
                  </div>
                  <div style={{flex: 1, flexDirection: 'column', gap: 2, display: 'flex'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B'}}>
                      <span style={{color: '#0F172A', fontWeight: '500'}}>Tuấn Tú</span>
                      <span>•</span>
                      <span>6 ngày trước</span>
                    </div>
                    <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>Sự khác biệt giữa Abstract Class</div>
                    <div style={{display: 'flex', gap: 12, fontSize: 11, color: '#64748B', paddingTop: 2}}>
                      <span>76 thích</span>
                      <span>33 bình luận</span>
                    </div>
                  </div>
                  <div style={{width: 48, height: 48, background: '#F1F5F9', borderRadius: 6, border: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0}}>
                    <div style={{width: 18, height: 18, background: '#CBD5E1', borderRadius: 2}} />
                  </div>
                </div>

              </div>
            </div>
          )}

          <div style={{background: 'white', borderRadius: 12, padding: 20, outline: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}}>
            <h3 style={{fontSize: 16, fontWeight: '700', color: '#0F172A', margin: '0 0 16px 0'}}>Chủ đề nổi bật</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              {['#Toán12', '#GiảiTích', '#Java', '#IELTS', '#VậtLýĐạiCương'].map((tag, idx) => (
                <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}>
                  <span style={{color: '#3B82F6', fontSize: 14, fontWeight: '500'}}>{tag}</span>
                  <span style={{color: '#94A3B8', fontSize: 12}}>+120 bài</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{background: 'linear-gradient(135deg, #00236F 0%, #1E40AF 100%)', borderRadius: 12, padding: 24, color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
            <h3 style={{fontSize: 18, fontWeight: '700', margin: '0 0 12px 0'}}>Bạn cần trợ giúp?</h3>
            <p style={{fontSize: 14, color: '#DBEAFE', margin: '0 0 20px 0', lineHeight: 1.5}}>
              Tham gia ngay vào các nhóm học để được hướng dẫn trực tiếp từ các gia sư và bạn bè.
            </p>
            <Link to="/groups" style={{display: 'block', textAlign: 'center', width: '100%', padding: '10px 0', background: 'white', color: '#00236F', border: 'none', borderRadius: 8, fontWeight: '600', cursor: 'pointer', textDecoration: 'none', boxSizing: 'border-box'}}>
              Khám phá nhóm học
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}