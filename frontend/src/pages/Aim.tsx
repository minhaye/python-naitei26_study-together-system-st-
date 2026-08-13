export function AimPage() {
  const todayTasks = [
    { label: 'Hoàn thiện bài tập Cấu trúc dữ liệu', priority: 'HIGH', time: '14:00' },
    { label: 'Review Code Project Cuối Kì', priority: 'MEDIUM', time: '20:00' },
  ];

  const upcomingTasks = [
    { label: 'Đọc chương 4 - HĐH', time: 'Ngày mai' },
    { label: 'Tìm hiểu Next.js App Router', time: 'Thứ 6' },
  ];

  const phases = [
    { code: 'PHASE 1', label: 'Nền tảng & Tư duy', active: false },
    { code: 'PHASE 2', label: 'Kỹ năng Nghe & Đọc', active: true },
    { code: 'PHASE 3', label: 'Luyện đề & Phân xạ', active: false },
  ];

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#F8FAFC', padding: '28px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0F172A' }}>Mục tiêu & Tiến độ</h1>
            <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 14 }}>
              <span>Computer Science Senior</span>
              <span style={{ color: '#94A3B8' }}>•</span>
              <span>Chuỗi: <strong style={{ color: '#0F172A' }}>12 ngày</strong></span>
            </div>
          </div>
          <button style={{ border: 'none', background: '#1E3A8A', color: 'white', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>＋</span> Thêm mới
          </button>
        </header>

        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Quản lý Công việc chi tiết</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⎇</span> Lọc
              </button>
              <button style={{ border: '1px solid #E2E8F0', background: 'white', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#0F172A' }}>
                Xem tất cả
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#0F172A' }}>HÔM NAY</span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>2</span>
                </div>
                <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {todayTasks.map((task) => (
                    <div key={task.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="checkbox" style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid #C7D2FE', cursor: 'pointer' }} />
                      <span style={{ flex: 1, fontSize: 14, color: '#0F172A' }}>{task.label}</span>
                      <span style={{
                        background: task.priority === 'HIGH' ? 'rgba(186, 26, 26, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: task.priority === 'HIGH' ? '#BA1A1A' : '#10B981',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {task.priority}
                      </span>
                      <span style={{ fontSize: 12, color: '#475569' }}>{task.time}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 14, marginTop: 4 }}>
                    <span>＋</span> Thêm việc
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#0F172A' }}>SẮP TỚI</span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>2</span>
                </div>
                <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcomingTasks.map((task) => (
                    <div key={task.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="checkbox" style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid #C7D2FE', cursor: 'pointer' }} />
                      <span style={{ flex: 1, fontSize: 14, color: '#0F172A' }}>{task.label}</span>
                      <span style={{ fontSize: 12, color: '#475569' }}>{task.time}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 14, marginTop: 4 }}>
                    <span>＋</span> Thêm việc
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#475569' }}>ĐÃ HOÀN THÀNH</span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>1</span>
                </div>
                <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>✓</div>
                    <span style={{ fontSize: 14, color: '#0F172A', textDecoration: 'line-through' }}>Họp nhóm đồ án</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ width: 340, minWidth: 300, background: '#EEF4FF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Tháng 11, 2023</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569' }}>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <div key={day}>{day}</div>)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 13 }}>
                {[30,31,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,1,2,3].map((day, idx) => {
                  const isSelected = day === 13;
                  const hasEvent = day === 14;
                  const isOtherMonth = (day > 15 && idx < 7) || (day < 10 && idx > 20);
                  return (
                    <div key={idx} style={{ position: 'relative', padding: '6px 0', borderRadius: 4, background: isSelected ? '#1E3A8A' : 'transparent', color: isSelected ? 'white' : '#334155', fontWeight: isSelected ? 700 : 400, opacity: isOtherMonth ? 0.3 : 1, cursor: 'pointer' }}>
                      {day}
                      {hasEvent && <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, background: '#BA1A1A', borderRadius: '50%' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Lộ trình & Mục tiêu</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>Theo dõi và tối ưu hóa hành trình phát triển bản thân</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <button style={{ border: '1px solid #CBD5E1', background: 'white', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1E3A8A' }}>
              ✦ Gợi ý lộ trình AI
            </button>
            <button style={{ border: 'none', background: '#1E3A8A', color: 'white', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ＋ Tạo lộ trình mới
            </button>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 360, background: 'linear-gradient(180deg, #F7FBFF 0%, #EEF6FF 100%)', border: '1px solid #D9E8FF', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>AI</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Chinh phục IELTS 7.5</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>MỤC TIÊU HIỆN TẠI</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#047857', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>
                  65% Hoàn thành
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>TIẾN ĐỘ TỔNG THỂ</span>
                <span>Dự kiến: 20/01/2024</span>
              </div>

              <div style={{ height: 10, background: '#DDE7F7', borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, #22C55E 0%, #10B981 100%)', borderRadius: 20 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {phases.map(phase => (
                  <div key={phase.code} style={{ border: phase.active ? '2px solid #1E3A8A' : '1px solid #CBD5E1', background: phase.active ? 'white' : '#F8FAFC', borderRadius: 10, padding: 12, minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: phase.active ? '#1E3A8A' : '#94A3B8' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: phase.active ? '#1E3A8A' : '#475569' }}>{phase.code}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>{phase.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: 320, minWidth: 280, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#D9E8FF', color: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✦</div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Trợ lý Lộ trình AI</span>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Bạn muốn học gì tiếp theo? Hãy để AI thiết kế lộ trình cá nhân hóa dựa trên mục tiêu của bạn.</p>

              <div style={{ background: '#EEF4FF', border: '1px solid #CFDDFB', borderRadius: 10, padding: 12, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                Ví dụ: Tôi muốn học lập trình Python trong 3 tháng để làm Data Analysis.
              </div>

              <button style={{ marginTop: 'auto', border: 'none', background: '#1E3A8A', color: 'white', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✦ Tạo lộ trình ngay</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
