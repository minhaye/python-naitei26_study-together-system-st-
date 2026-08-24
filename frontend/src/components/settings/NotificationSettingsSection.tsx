import React, { useEffect, useState } from 'react';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '../../lib/notification.api';
import { ToggleSwitch } from './ToggleSwitch';

const cardStyle: React.CSSProperties = {
  background: '#FFF',
  border: '1px solid #DCE4F0',
  borderRadius: 9,
  padding: '20px 24px',
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: '#151E34',
  fontSize: 20,
  lineHeight: 1.35,
  fontWeight: 700,
};
const mutedText: React.CSSProperties = {
  margin: '3px 0 0',
  color: '#51596B',
  fontSize: 14,
  lineHeight: 1.45,
};
const divider: React.CSSProperties = { height: 1, background: '#DEE5F0', marginTop: 8 };
const settingLabel: React.CSSProperties = { color: '#172139', fontSize: 14, fontWeight: 650 };
const settingRow: React.CSSProperties = {
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 18,
};

export const NotificationSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    enable_forum: true,
    enable_group: true,
    enable_goal: true,
    enable_message: true,
    enable_sound: true,
  });

  useEffect(() => {
    void getNotificationSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (key: keyof NotificationSettings, val: boolean) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    try {
      await updateNotificationSettings({ [key]: val });
    } catch {
      // Revert if API fails
      setSettings(settings);
    }
  };

  return (
    <section className="settings-card" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <h2 style={sectionTitle}>Cài đặt Thông báo</h2>
        <span style={{ color: '#0A347F', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>THÔNG BÁO</span>
      </div>
      <div style={divider} />
      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <div style={settingRow}>
          <div>
            <strong style={settingLabel}>Thông báo Diễn đàn</strong>
            <p style={{ ...mutedText, fontSize: 13 }}>
              Nhận thông báo khi có người thả cảm xúc hoặc bình luận bài viết của bạn
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enable_forum}
            onChange={(v) => void handleToggle('enable_forum', v)}
          />
        </div>

        <div style={settingRow}>
          <div>
            <strong style={settingLabel}>Thông báo Nhóm học</strong>
            <p style={{ ...mutedText, fontSize: 13 }}>
              Nhận thông báo về tài liệu mới, phòng học trực tuyến và lời mời nhóm
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enable_group}
            onChange={(v) => void handleToggle('enable_group', v)}
          />
        </div>

        <div style={settingRow}>
          <div>
            <strong style={settingLabel}>Nhắc nhở Mục tiêu hàng ngày</strong>
            <p style={{ ...mutedText, fontSize: 13 }}>
              Nhận thông báo nhắc nhở thực hiện mục tiêu hàng ngày
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enable_goal}
            onChange={(v) => void handleToggle('enable_goal', v)}
          />
        </div>

        <div style={settingRow}>
          <div>
            <strong style={settingLabel}>Thông báo Tin nhắn</strong>
            <p style={{ ...mutedText, fontSize: 13 }}>
              Nhận thông báo khi có tin nhắn riêng hoặc tin nhắn nhóm mới
            </p>
          </div>
          <ToggleSwitch
            checked={settings.enable_message}
            onChange={(v) => void handleToggle('enable_message', v)}
          />
        </div>
      </div>
    </section>
  );
};
