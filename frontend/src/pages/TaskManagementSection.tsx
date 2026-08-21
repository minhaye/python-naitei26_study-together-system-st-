import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, LoaderCircle, Plus, Trash2, Zap } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ApiError } from '../lib/apiClient';
import { createTasks, deleteTask, listTasks, toggleTaskComplete, updateTask, type StudyTask, type TaskPriority } from '../lib/task.api';

const priorities: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 1, label: 'Thấp', color: '#94A3B8' },
  { value: 2, label: 'Trung bình', color: '#F59E0B' },
  { value: 3, label: 'Cao', color: '#EF4444' },
];

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dateLabel = (date: Date) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthRange = (month: Date) => ({ from: dateKey(firstDayOfMonth(month)), to: dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)) });

// ── Quick-task parser ────────────────────────────────────────────────────────
type ParsedTask = { title: string; due_date: string; priority: TaskPriority };

function parsePriorityToken(token: string, fallback: TaskPriority): TaskPriority {
  const t = token.trim().toLowerCase();
  if (['high', 'cao', 'h', '3'].includes(t)) return 3;
  if (['mid', 'medium', 'trung', 'trung bình', 'm', '2'].includes(t)) return 2;
  if (['low', 'thấp', 'thap', 'l', '1'].includes(t)) return 1;
  return fallback;
}

function parseDateToken(token: string, todayStr: string, fallback: string): string {
  const t = token.trim().toLowerCase();
  if (['hôm nay', 'hom nay', 'today', 'now'].includes(t)) return todayStr;
  if (['ngày mai', 'ngay mai', 'tomorrow'].includes(t)) {
    const d = new Date(`${todayStr}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return dateKey(d);
  }
  // dd/mm or dd/mm/yyyy
  const shortMatch = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const year = new Date(`${todayStr}T00:00:00`).getFullYear();
    const month = shortMatch[2].padStart(2, '0');
    const day = shortMatch[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const longMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (longMatch) {
    const day = longMatch[1].padStart(2, '0');
    const month = longMatch[2].padStart(2, '0');
    return `${longMatch[3]}-${month}-${day}`;
  }
  // iso yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return fallback;
}

// Detect the dominant delimiter used in the text block (|, ;, ,)
function detectDelimiter(text: string): string | null {
  const counts = { '|': 0, ';': 0, ',': 0 };
  for (const ch of text) if (ch in counts) counts[ch as keyof typeof counts]++;
  const max = Math.max(...Object.values(counts));
  if (max === 0) return null;
  return (Object.entries(counts).find(([, v]) => v === max) ?? [null])[0] as string | null;
}

function parseQuickTasks(
  raw: string,
  fallbackDate: string,
  fallbackPriority: TaskPriority,
  todayStr: string,
): ParsedTask[] {
  const delimiter = detectDelimiter(raw) ?? '|';
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map(line => {
      const parts = line.split(delimiter).map(p => p.trim());
      const title = parts[0] ?? '';
      const due_date = parts[1] ? parseDateToken(parts[1], todayStr, fallbackDate) : fallbackDate;
      const priority = parts[2] ? parsePriorityToken(parts[2], fallbackPriority) : fallbackPriority;
      return { title, due_date, priority };
    })
    .filter(t => t.title.length > 0);
}
// ────────────────────────────────────────────────────────────────────────────

function friendlyError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.';
    if (cause.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    return cause.message || 'Đã xảy ra lỗi từ máy chủ.';
  }
  if (cause instanceof TypeError && cause.message.toLowerCase().includes('fetch')) {
    return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.';
  }
  return cause instanceof Error ? cause.message : 'Đã xảy ra lỗi không xác định.';
}

export function TaskManagementSection() {
  const today = new Date();
  const todayKey = dateKey(today);
  const [month, setMonth] = useState(firstDayOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [lines, setLines] = useState('');
  const [dueDate, setDueDate] = useState(todayKey);
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [submitting, setSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(2);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const range = monthRange(month);
      setTasks(await listTasks(range.from, range.to));
    } catch (cause) {
      setLoadError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadTasks(); }, [month]);

  const tasksByDate = useMemo(() => tasks.reduce<Record<string, StudyTask[]>>((result, task) => {
    (result[task.due_date] ??= []).push(task); return result;
  }, {}), [tasks]);
  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const parsedTasks = useMemo(
    () => parseQuickTasks(lines, dueDate, priority, todayKey),
    [lines, dueDate, priority, todayKey],
  );
  const days = useMemo(() => {
    const first = firstDayOfMonth(month);
    const padding = (first.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: padding + total }, (_, index) =>
      index < padding ? null : new Date(month.getFullYear(), month.getMonth(), index - padding + 1)
    );
  }, [month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsedTasks.length) { setActionError('Nhập ít nhất một công việc, mỗi dòng một việc.'); return; }
    setSubmitting(true);
    setActionError(null);
    try {
      const created = await createTasks(parsedTasks.map(t => ({ title: t.title, due_date: t.due_date, priority: t.priority })));
      setTasks(items => [...items, ...created]);
      // Navigate to the date of the first task
      setSelectedDate(parsedTasks[0].due_date);
      setLines('');
      setComposerOpen(false);
    } catch (cause) {
      setActionError(friendlyError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (task: StudyTask) => {
    try {
      const updated = await toggleTaskComplete(task.id);
      setTasks(items => items.map(item => item.id === task.id ? updated : item));
    } catch (cause) {
      setActionError(friendlyError(cause));
    }
  };

  const openEditor = (task: StudyTask) => {
    setActionError(null);
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDueDate(task.due_date);
    setEditPriority(task.priority);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await updateTask(editingTask.id, { title: editTitle.trim(), due_date: editDueDate, priority: editPriority });
      setTasks(items => items.map(item => item.id === updated.id ? updated : item));
      setEditingTask(null);
    } catch (cause) {
      setActionError(friendlyError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (taskId: string) => {
    if (!window.confirm('Xóa công việc này?')) return;
    setDeletingId(taskId);
    try {
      await deleteTask(taskId);
      setTasks(items => items.filter(item => item.id !== taskId));
      if (editingTask?.id === taskId) setEditingTask(null);
    } catch (cause) {
      setActionError(friendlyError(cause));
    } finally {
      setDeletingId(null);
    }
  };

  const moveMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  };

  return (
    <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Quản lý công việc chi tiết</h2>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>Ghi nhanh từng dòng, chọn một lần để lên lịch.</p>
        </div>
        <button onClick={() => { setActionError(null); setComposerOpen(true); }} style={primaryButton}>
          <Plus size={17} /> Thêm công việc
        </button>
      </div>

      {/* Lỗi khi tải dữ liệu */}
      {loadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          ⚠ {loadError}
          <button onClick={() => void loadTasks()} style={{ marginLeft: 12, color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
            Thử lại
          </button>
        </div>
      )}
      {/* Lỗi từ hành động (xóa, sửa...) */}
      {actionError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>
          {actionError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 410px', gap: 32 }}>
        {/* Danh sách công việc */}
        <div>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Công việc ngày {dateLabel(new Date(`${selectedDate}T00:00:00`))}</h3>
          {loading ? (
            <div style={muted}><LoaderCircle size="18" className="spin" /> Đang tải công việc...</div>
          ) : loadError ? (
            <div style={muted}><CalendarDays size={18} /> Không thể tải dữ liệu.</div>
          ) : selectedTasks.length ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {selectedTasks.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px',
                    opacity: task.completed_at ? 0.6 : 1,
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <input
                    aria-label={`Hoàn thành ${task.title}`}
                    type="checkbox"
                    checked={Boolean(task.completed_at)}
                    onChange={() => void toggle(task)}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span
                    style={{ width: 8, height: 8, borderRadius: 99, background: priorities[task.priority - 1].color, flexShrink: 0 }}
                    title={priorities[task.priority - 1].label}
                  />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditor(task)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openEditor(task); }}
                    title="Bấm để chỉnh sửa"
                    style={{ flex: 1, textDecoration: task.completed_at ? 'line-through' : 'none', cursor: 'pointer', fontSize: 14 }}
                  >
                    {task.title}
                  </span>
                  <small style={{ color: '#64748B', flexShrink: 0 }}>{priorities[task.priority - 1].label}</small>
                  <button
                    aria-label={`Xóa ${task.title}`}
                    onClick={() => void confirmDelete(task.id)}
                    disabled={deletingId === task.id}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '2px 4px', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={muted}><CalendarDays size={18} /> Chưa có công việc trong ngày này.</div>
          )}
        </div>

        {/* Lịch mini */}
        <aside style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={() => moveMonth(-1)} style={iconButton} aria-label="Tháng trước">‹</button>
            <b>{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(month)}</b>
            <button onClick={() => moveMonth(1)} style={iconButton} aria-label="Tháng sau">›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', color: '#64748B', fontSize: 11 }}>
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day}>{day}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 5 }}>
            {days.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;
              const key = dateKey(day);
              const isSelected = selectedDate === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  title={`${dateLabel(day)}: ${(tasksByDate[key] ?? []).length} công việc`}
                  onClick={() => setSelectedDate(key)}
                  style={{
                    ...calendarDay,
                    background: isSelected ? '#1E3A8A' : 'transparent',
                    color: isSelected ? 'white' : isToday ? '#1E3A8A' : '#334155',
                    fontWeight: isToday ? 700 : 400,
                    outline: isToday && !isSelected ? '2px solid #1E3A8A' : 'none',
                    outlineOffset: -2,
                  }}
                >
                  <span>{day.getDate()}</span>
                  <BusyDots tasks={tasksByDate[key] ?? []} selected={isSelected} />
                </button>
              );
            })}
          </div>
          <p style={{ margin: '14px 0 0', color: '#64748B', fontSize: 12 }}>
            Chạm vào ngày để xem nhanh. 1–3 chấm thể hiện mức bận.
          </p>
        </aside>
      </div>

      {/* Modal: Thêm công việc nhanh */}
      <Modal isOpen={isComposerOpen} onClose={() => !submitting && setComposerOpen(false)} title="Thêm công việc nhanh">
        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>

          {/* Hướng dẫn cú pháp */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#1E40AF', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
              <Zap size={14} /> Cú pháp thêm nhanh (tách bằng <code style={{ background: '#DBEAFE', borderRadius: 4, padding: '1px 5px' }}>|</code>&nbsp;<code style={{ background: '#DBEAFE', borderRadius: 4, padding: '1px 5px' }}>;</code>&nbsp;<code style={{ background: '#DBEAFE', borderRadius: 4, padding: '1px 5px' }}>,</code>)
            </div>
            <div style={{ color: '#1D4ED8', fontFamily: 'monospace', fontSize: 12 }}>
              Tên công việc | ngày | độ ưu tiên
            </div>
            <div style={{ color: '#3B82F6', marginTop: 3 }}>
              Ví dụ: <em>Làm bài tập toán | hôm nay | high</em> &nbsp;·&nbsp; <em>Ôn thi | 22/8/2026 | mid</em>
            </div>
            <div style={{ color: '#60A5FA', marginTop: 2 }}>
              Ngày nhận: <em>hôm nay · ngày mai · 22/8 · 22/8/2026</em>
            </div>
            <div style={{ color: '#60A5FA', marginTop: 2 }}>
              Priority: <em>high · mid · low · cao · trung · thấp</em>
            </div>
          </div>

          {/* Textarea nhập liệu */}
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ ...fieldLabel, fontWeight: 700 }}>
              Danh sách công việc
              <textarea
                autoFocus
                id="quick-task-input"
                value={lines}
                onChange={e => setLines(e.target.value)}
                placeholder={'Làm bài tập toán | hôm nay | high\nThiết kế database | 22/8/2026 | mid\nÔn thi\nNộp bài tập nhóm | ngày mai'}
                rows={6}
                maxLength={10049}
                style={{ resize: 'vertical', padding: 12, border: '1px solid #CBD5E1', borderRadius: 8, font: 'inherit', fontSize: 13, lineHeight: 1.6 }}
              />
            </label>
            <small style={{ color: parsedTasks.length > 50 ? '#B91C1C' : '#64748B' }}>
              {parsedTasks.length}/50 công việc sẽ được tạo
            </small>
          </div>

          {/* Giá trị mặc định */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>Giá trị mặc định (áp dụng cho dòng không có ngày / độ ưu tiên)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={fieldLabel}>
                Ngày mặc định
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={field} />
              </label>
              <label style={fieldLabel}>
                Độ ưu tiên mặc định
                <select value={priority} onChange={e => setPriority(Number(e.target.value) as TaskPriority)} style={field}>
                  {priorities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Preview table */}
          {parsedTasks.length > 0 && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#F8FAFC', padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 110px 80px', gap: 8 }}>
                <span>Công việc</span><span>Ngày</span><span>Ưu tiên</span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {parsedTasks.map((task, i) => {
                  const pri = priorities[task.priority - 1];
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px', gap: 8, padding: '7px 12px', fontSize: 12.5, borderBottom: i < parsedTasks.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'center' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0F172A' }}>{task.title}</span>
                      <span style={{ color: '#475569' }}>{task.due_date.split('-').reverse().join('/')}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i style={{ width: 8, height: 8, borderRadius: 99, background: pri.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: pri.color, fontWeight: 600 }}>{pri.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {actionError && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{actionError}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setComposerOpen(false)} disabled={submitting} style={secondaryButton}>Hủy</button>
            <button disabled={submitting || !parsedTasks.length} style={primaryButton}>
              {submitting
                ? <><LoaderCircle size={16} className="spin" /> Đang lưu</>
                : <><Check size={16} /> Tạo {parsedTasks.length || ''} công việc</>
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Chỉnh sửa công việc */}
      <Modal isOpen={Boolean(editingTask)} onClose={() => !submitting && setEditingTask(null)} title="Chỉnh sửa công việc">
        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 14 }}>
          <label style={fieldLabel}>
            Tên công việc
            <input autoFocus value={editTitle} required maxLength={200} onChange={e => setEditTitle(e.target.value)} style={field} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={fieldLabel}>
              Ngày
              <input type="date" value={editDueDate} required onChange={e => setEditDueDate(e.target.value)} style={field} />
            </label>
            <label style={fieldLabel}>
              Độ ưu tiên
              <select value={editPriority} onChange={e => setEditPriority(Number(e.target.value) as TaskPriority)} style={field}>
                {priorities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          {actionError && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{actionError}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              type="button"
              onClick={() => editingTask && void confirmDelete(editingTask.id)}
              disabled={submitting || deletingId !== null}
              style={{ ...secondaryButton, color: '#EF4444', borderColor: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={14} /> Xóa
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setEditingTask(null)} disabled={submitting} style={secondaryButton}>Hủy</button>
              <button disabled={submitting || !editTitle.trim()} style={primaryButton}>
                {submitting ? 'Đang lưu' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function BusyDots({ tasks, selected }: { tasks: StudyTask[]; selected: boolean }) {
  const score = tasks.reduce((sum, task) => sum + task.priority, 0);
  const count = score >= 7 ? 3 : score >= 3 ? 2 : tasks.length ? 1 : 0;
  const color = selected ? '#DBEAFE' : count === 3 ? '#EF4444' : count === 2 ? '#F59E0B' : '#94A3B8';
  return count ? (
    <span aria-hidden="true" style={{ height: 5, display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2 }}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} style={{ width: 4, height: 4, borderRadius: 99, background: color }} />
      ))}
    </span>
  ) : (
    <span style={{ height: 5, display: 'block' }} />
  );
}

const primaryButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 0, borderRadius: 8, padding: '9px 14px', background: '#1E3A8A', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const secondaryButton = { ...primaryButton, background: 'white', color: '#334155', border: '1px solid #CBD5E1' } as const;
const iconButton = { border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, color: '#334155', cursor: 'pointer' } as const;
const calendarDay = { minHeight: 42, padding: '4px 1px', border: 0, borderRadius: 7, fontSize: 12, cursor: 'pointer', display: 'grid', placeItems: 'center' } as const;
const muted = { minHeight: 110, color: '#64748B', background: '#F8FAFC', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 } as const;
const fieldLabel = { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 600 } as const;
const field = { padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 8, color: '#0F172A', background: 'white', font: 'inherit' } as const;
