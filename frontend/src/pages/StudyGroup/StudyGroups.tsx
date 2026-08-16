import { ChevronDown, Plus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export function StudyRooms() {
  return (
    <div style={{width: '100%', flex: 1, background: 'linear-gradient(0deg, #F8FAFC 0%, #F8FAFC 100%), white', display: 'flex', justifyContent: 'center'}}>
        <div style={{width: '100%', maxWidth: '100%', paddingLeft: 32, paddingRight: 32, paddingTop: 48, paddingBottom: 48, display: 'flex', flexDirection: 'column', gap: 24}}>
            
            {/* Header Section */}
            <div style={{alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
                <div style={{flexDirection: 'column', gap: 4, display: 'flex'}}>
                    <div style={{color: '#0B1C30', fontSize: 28, fontFamily: 'Inter', fontWeight: '600', lineHeight: '36px'}}>Khám phá nhóm học</div>
                    <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px'}}>Tìm và tham gia các nhóm học tập phù hợp với bạn.</div>
                </div>
                <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
                    <div style={{paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                        <div style={{color: '#0B1C30', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px'}}>Sắp xếp: Mới nhất</div>
                        <ChevronDown size={16} color="#6B7280" />
                    </div>
                    <div style={{paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: '#00236F', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                        <Plus size={16} color="white" />
                        <div style={{color: 'white', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', lineHeight: '20px'}}>Tạo nhóm hoặc tham gia nhóm</div>
                    </div>
                </div>
            </div>

            {/* Grid Section */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24}}>
                
                {/* Card 1 */}
                <div style={{background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <div style={{height: 128, position: 'relative', background: '#E5EEFF'}}>
                        <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80" alt="Cover" />
                        <div style={{position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6}}>
                            <div style={{width: 8, height: 8, background: '#10B981', borderRadius: '50%'}} />
                            <div style={{color: '#0B1C30', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>12 online</div>
                        </div>
                    </div>
                    <div style={{padding: 24, display: 'flex', flexDirection: 'column', flex: 1}}>
                        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                            <div style={{padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>CNTT</div>
                            <div style={{padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400'}}>C++</div>
                        </div>
                        <div style={{color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8}}>Thuật toán & Cấu trúc dữ liệu</div>
                        <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1}}>Nhóm tự học và luyện tập các bài toán về CTDL & Thuật toán chuẩn bị.</div>
                        <div style={{paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <div style={{width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0}}>
                                    <div style={{color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600'}}>+45</div>
                                </div>
                            </div>
                            <Link to="/groups/1" style={{color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2, textDecoration: 'none'}}>
                                <Users size={16} /> Tham gia
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Card 2 */}
                <div style={{background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <div style={{height: 128, position: 'relative', background: '#E5EEFF'}}>
                        <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src="https://images.unsplash.com/photo-1546410531-bea4edad646a?w=400&q=80" alt="Cover" />
                        <div style={{position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6}}>
                            <div style={{width: 8, height: 8, background: '#10B981', borderRadius: '50%'}} />
                            <div style={{color: '#0B1C30', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>8 online</div>
                        </div>
                    </div>
                    <div style={{padding: 24, display: 'flex', flexDirection: 'column', flex: 1}}>
                        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                            <div style={{padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>Ngoại ngữ</div>
                            <div style={{padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400'}}>IELTS</div>
                        </div>
                        <div style={{color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8}}>IELTS Speaking Practice</div>
                        <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1}}>Luyện tập speaking hàng ngày qua Google Meet. Yêu cầu đầu vào 6.0+.</div>
                        <div style={{paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <div style={{width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0}}>
                                    <div style={{color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600'}}>+12</div>
                                </div>
                            </div>
                            <Link to="/groups/2" style={{color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2, textDecoration: 'none'}}>
                                <Users size={16} /> Tham gia
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Card 3 */}
                <div style={{background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <div style={{height: 128, position: 'relative', background: '#E5EEFF'}}>
                        <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src="https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&q=80" alt="Cover" />
                        <div style={{position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6}}>
                            <div style={{width: 8, height: 8, background: '#757682', borderRadius: '50%'}} />
                            <div style={{color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>0 online</div>
                        </div>
                    </div>
                    <div style={{padding: 24, display: 'flex', flexDirection: 'column', flex: 1}}>
                        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                            <div style={{padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>KHTN</div>
                            <div style={{padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400'}}>Vật lý đại cương</div>
                        </div>
                        <div style={{color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8}}>Giải bài tập Vật Lý 1</div>
                        <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1}}>Nhóm hỗ trợ nhau giải đáp các thắc mắc về môn Vật lý đại cương 1.</div>
                        <div style={{paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <div style={{width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0}}>
                                    <div style={{color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600'}}>+8</div>
                                </div>
                            </div>
                            <Link to="/groups/3" style={{color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2, textDecoration: 'none'}}>
                                <Users size={16} /> Tham gia
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Card 4 */}
                <div style={{background: 'white', borderRadius: 8, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
                    <div style={{height: 128, position: 'relative', background: '#E5EEFF'}}>
                        <img style={{width: '100%', height: '100%', objectFit: 'cover'}} src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80" alt="Cover" />
                        <div style={{position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(255, 255, 255, 0.90)', borderRadius: 16, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', gap: 6}}>
                            <div style={{width: 8, height: 8, background: '#10B981', borderRadius: '50%'}} />
                            <div style={{color: '#0B1C30', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>3 online</div>
                        </div>
                    </div>
                    <div style={{padding: 24, display: 'flex', flexDirection: 'column', flex: 1}}>
                        <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                            <div style={{padding: '4px 12px', background: '#D3E4FE', borderRadius: 4, color: '#00236F', fontSize: 12, fontFamily: 'Inter', fontWeight: '600'}}>Thiết kế</div>
                            <div style={{padding: '4px 12px', background: '#F8F9FF', outline: '1px #E2E8F0 solid', outlineOffset: '-1px', borderRadius: 4, color: '#757682', fontSize: 12, fontFamily: 'Inter', fontWeight: '400'}}>UI/UX</div>
                        </div>
                        <div style={{color: '#0B1C30', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px', marginBottom: 8}}>UI/UX Design Cơ Bản</div>
                        <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px', marginBottom: 24, flex: 1}}>Cùng nhau học Figma và chia sẻ các case study về trải nghiệm người dùng.</div>
                        <div style={{paddingTop: 16, borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <div style={{width: 28, height: 28, background: '#E5EEFF', borderRadius: '50%', border: '2px solid white', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 0}}>
                                    <div style={{color: '#00236F', fontSize: 10, fontFamily: 'Inter', fontWeight: '600'}}>+22</div>
                                </div>
                            </div>
                            <Link to="/groups/4" style={{color: '#00236F', fontSize: 14, fontFamily: 'Inter', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1.5px solid #00236F', paddingBottom: 2, textDecoration: 'none'}}>
                                <Users size={16} /> Tham gia
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
