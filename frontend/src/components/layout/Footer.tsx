export function Footer() {
  return (
    <div style={{width: '100%', paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24, background: '#EFF4FF', borderTop: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center'}}>
        <div style={{width: '100%', maxWidth: 1440, justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
            <div style={{display: 'flex'}}>
                <div style={{color: '#00236F', fontSize: 20, fontFamily: 'Inter', fontWeight: '600', lineHeight: '28px'}}>EduHub</div>
            </div>
            <div style={{display: 'flex'}}>
                <div style={{color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px'}}>© 2024 EduHub. Tất cả quyền được bảo lưu.</div>
            </div>
            <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'flex'}}>
                <div style={{cursor: 'pointer', color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px'}}>Điều khoản dịch vụ</div>
                <div style={{cursor: 'pointer', color: '#444651', fontSize: 14, fontFamily: 'Inter', fontWeight: '400', lineHeight: '20px'}}>Chính sách bảo mật</div>
            </div>
        </div>
    </div>
  );
}
