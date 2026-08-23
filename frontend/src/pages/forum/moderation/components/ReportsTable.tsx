import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { moderationApi } from '../../../../lib/moderation.api';
import { REPORT_REASON_LABELS, type ReportResponse } from '../../../../lib/moderation.types';
import { ApiError } from '../../../../lib/apiClient';
import { BanUserModal } from './BanUserModal';
import { MessageUserTrigger } from '../../../../components/messages/MessageUserTrigger';

export const ReportsTable: React.FC = () => {
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restrictTarget, setRestrictTarget] = useState<ReportResponse | null>(null);

  const load = () => {
    setIsLoading(true);
    moderationApi
      .listReports({ status: 'pending', limit: 100 })
      .then(setReports)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách báo cáo.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDismiss = async (report: ReportResponse) => {
    setPendingId(report.id);
    try {
      await moderationApi.updateReportStatus(report.id, { status: 'dismissed' });
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể bỏ qua báo cáo.');
    } finally {
      setPendingId(null);
    }
  };

  const handleRestricted = async () => {
    if (!restrictTarget) return;
    try {
      await moderationApi.updateReportStatus(restrictTarget.id, { status: 'resolved' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái báo cáo.');
    }
    setReports((prev) => prev.filter((r) => r.id !== restrictTarget.id));
    setRestrictTarget(null);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN');

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0F172A' }}>Báo cáo đang chờ xử lý ({reports.length})</h3>

      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: '#64748B', fontSize: 13.5 }}>Đang tải...</div>
      ) : reports.length === 0 ? (
        <div style={{ color: '#94A3B8', fontSize: 13.5 }}>Không có báo cáo nào đang chờ xử lý.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map((report) => (
            <div
              key={report.id}
              style={{ padding: '12px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <MessageUserTrigger userId={report.reported_user_id}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                      {report.reported_user_name ?? report.reported_user_id}
                    </div>
                  </MessageUserTrigger>
                  <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                    Báo cáo bởi{' '}
                    <MessageUserTrigger userId={report.reporter_id} style={{ display: 'inline' }}>
                      {report.reporter_name ?? report.reporter_id}
                    </MessageUserTrigger>{' '}
                    • {formatDate(report.created_at)}
                  </div>
                  <div style={{ marginTop: 6, display: 'inline-flex', padding: '2px 8px', background: '#FEF3C7', color: '#B45309', borderRadius: 999, fontSize: 11.5, fontWeight: 600 }}>
                    {REPORT_REASON_LABELS[report.reason]}
                  </div>
                  {report.description && (
                    <div style={{ marginTop: 6, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{report.description}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setRestrictTarget(report)}
                    title="Hạn chế người dùng bị báo cáo"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
                  >
                    <ShieldAlert size={13} /> Hạn chế
                  </button>
                  <button
                    onClick={() => handleDismiss(report)}
                    disabled={pendingId === report.id}
                    title="Bỏ qua báo cáo này"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: 8, color: pendingId === report.id ? '#CBD5E1' : '#334155', cursor: pendingId === report.id ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600 }}
                  >
                    <X size={13} /> Bỏ qua
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BanUserModal
        isOpen={restrictTarget !== null}
        onClose={() => setRestrictTarget(null)}
        onCreated={handleRestricted}
        presetUserId={restrictTarget?.reported_user_id ?? null}
      />
    </div>
  );
};
