import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, LoaderCircle, Plus } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ApiError } from '../lib/apiClient';
import { createTasks, listTasks, toggleTaskComplete, updateTask, type StudyTask, type TaskPriority } from '../lib/task.api';

const priorities: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 1, label: 'Thấp', color: '#94A3B8' },
  { value: 2, label: 'Trung bình', color: '#F59E0B' },
  { value: 3, label: 'Cao', color: '#EF4444' },
];

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const dateLabel = (date: Date) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthRange = (month: Date) => ({ from: dateKey(firstDayOfMonth(month)), to: dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)) });

export function TaskManagementSection() {
  const today = new Date();
  const [month, setMonth] = useState(firstDayOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [lines, setLines] = useState('');
  const [dueDate, setDueDate] = useState(dateKey(today));
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [submitting, setSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(2);

  const loadTasks = async () => {
    setLoading(true); setError(null);
    try { const range = monthRange(month); setTasks(await listTasks(range.from, range.to)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải công việc.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadTasks(); }, [month]);

  const tasksByDate = useMemo(() => tasks.reduce<Record<string, StudyTask[]>>((result, task) => {
    (result[task.due_date] ??= []).push(task); return result;
  }, {}), [tasks]);
  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const parsedTitles = useMemo(() => lines.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 50), [lines]);
  const days = useMemo(() => {
    const first = firstDayOfMonth(month); const padding = (first.getDay() + 6) % 7;
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: padding + total }, (_, index) => index < padding ? null : new Date(month.getFullYear(), month.getMonth(), index - padding + 1));
  }, [month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsedTitles.length) { setError('Nhập ít nhất một công việc, mỗi dòng một việc.'); return; }
    setSubmitting(true); setError(null);
    try {
      const created = await createTasks(parsedTitles.map(title => ({ title, due_date: dueDate, priority })));
      setTasks(items => [...items, ...created]); setSelectedDate(dueDate); setLines(''); setComposerOpen(false);
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Không thể thêm công việc. Vui lòng thử lại.'); }
    finally { setSubmitting(false); }
  };
  const toggle = async (task: StudyTask) => {
    try { const updated = await toggleTaskComplete(task.id); setTasks(items => items.map(item => item.id === task.id ? updated : item)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật công việc.'); }
  };
  const openEditor = (task: StudyTask) => { setError(null); setEditingTask(task); setEditTitle(task.title); setEditDueDate(task.due_date); setEditPriority(task.priority); };
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editingTask || !editTitle.trim()) return;
    setSubmitting(true); setError(null);
    try { const updated = await updateTask(editingTask.id, { title: editTitle.trim(), due_date: editDueDate, priority: editPriority }); setTasks(items => items.map(item => item.id === updated.id ? updated : item)); setEditingTask(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu thay đổi.'); }
    finally { setSubmitting(false); }
  };
  const moveMonth = (offset: number) => { const next = new Date(month.getFullYear(), month.getMonth() + offset, 1); setMonth(next); setSelectedDate(dateKey(next)); };

  return <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><h2 style={{ margin: 0, fontSize: 18 }}>Quản lý công việc chi tiết</h2><p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>Ghi nhanh từng dòng, chọn một lần để lên lịch.</p></div>
      <button onClick={() => { setError(null); setComposerOpen(true); }} style={primaryButton}><Plus size={17} /> Thêm công việc</button>
    </div>
    {error && <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 410px', gap: 32 }}>
      <div><h3 style={{ marginTop: 0, fontSize: 14 }}>Công việc ngày {dateLabel(new Date(`${selectedDate}T00:00:00`))}</h3>
        {loading ? <div style={muted}><LoaderCircle size="18" className="spin" /> Đang tải công việc...</div> : selectedTasks.length ? <div style={{ display: 'grid', gap: 6 }}>{selectedTasks.map(task => <div key={task.id} role="button" tabIndex={0} onClick={() => openEditor(task)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openEditor(task); }} title="Bấm để chỉnh sửa" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', opacity: task.completed_at ? .6 : 1, cursor: 'pointer' }}><input aria-label={`Hoàn thành ${task.title}`} type="checkbox" checked={Boolean(task.completed_at)} onClick={event => event.stopPropagation()} onChange={() => void toggle(task)} /><span style={{ width: 8, height: 8, borderRadius: 99, background: priorities[task.priority - 1].color }} /><span style={{ flex: 1, textDecoration: task.completed_at ? 'line-through' : 'none' }}>{task.title}</span><small style={{ color: '#64748B' }}>{priorities[task.priority - 1].label}</small></div>)}</div> : <div style={muted}><CalendarDays size={18} /> Chưa có công việc trong ngày này.</div>}
      </div>
      <aside style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><button onClick={() => moveMonth(-1)} style={iconButton} aria-label="Tháng trước">‹</button><b>{new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(month)}</b><button onClick={() => moveMonth(1)} style={iconButton} aria-label="Tháng sau">›</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', color: '#64748B', fontSize: 11 }}>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day}>{day}</span>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 5 }}>{days.map((day, index) => !day ? <span key={`blank-${index}`} /> : <button key={dateKey(day)} title={`${dateLabel(day)}: ${(tasksByDate[dateKey(day)] ?? []).length} công việc`} onClick={() => setSelectedDate(dateKey(day))} style={{ ...calendarDay, background: selectedDate === dateKey(day) ? '#1E3A8A' : 'transparent', color: selectedDate === dateKey(day) ? 'white' : '#334155' }}><span>{day.getDate()}</span><BusyDots tasks={tasksByDate[dateKey(day)] ?? []} selected={selectedDate === dateKey(day)} /></button>)}</div>
        <p style={{ margin: '14px 0 0', color: '#64748B', fontSize: 12 }}>Chạm vào ngày để xem nhanh. 1–3 chấm thể hiện mức bận.</p>
      </aside>
    </div>
    <Modal isOpen={isComposerOpen} onClose={() => !submitting && setComposerOpen(false)} title="Thêm công việc nhanh">
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>Mỗi dòng sẽ trở thành một công việc. Bạn có thể dán trực tiếp từ Word, Excel hoặc Google Docs.</p>
        <textarea autoFocus value={lines} onChange={event => setLines(event.target.value)} placeholder={'Ôn chương 4\nNộp bài tập nhóm\nLàm đề Listening'} rows={7} maxLength={10049} style={{ resize: 'vertical', padding: 12, border: '1px solid #CBD5E1', borderRadius: 8, font: 'inherit' }} />
        <small style={{ color: parsedTitles.length > 50 ? '#B91C1C' : '#64748B' }}>{parsedTitles.length}/50 công việc sẽ được tạo</small>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><label style={fieldLabel}>Ngày<input type="date" value={dueDate} required onChange={event => setDueDate(event.target.value)} style={field} /></label><label style={fieldLabel}>Mức bận<select value={priority} onChange={event => setPriority(Number(event.target.value) as TaskPriority)} style={field}>{priorities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setComposerOpen(false)} disabled={submitting} style={secondaryButton}>Hủy</button><button disabled={submitting || !parsedTitles.length} style={primaryButton}>{submitting ? <><LoaderCircle size={16} className="spin" /> Đang lưu</> : <><Check size={16} /> Tạo {parsedTitles.length || ''} công việc</>}</button></div>
      </form>
    </Modal>
    <Modal isOpen={Boolean(editingTask)} onClose={() => !submitting && setEditingTask(null)} title="Chỉnh sửa công việc">
      <form onSubmit={saveEdit} style={{ display: 'grid', gap: 14 }}>
        <label style={fieldLabel}>Tên công việc<input autoFocus value={editTitle} required maxLength={200} onChange={event => setEditTitle(event.target.value)} style={field} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><label style={fieldLabel}>Ngày<input type="date" value={editDueDate} required onChange={event => setEditDueDate(event.target.value)} style={field} /></label><label style={fieldLabel}>Mức bận<select value={editPriority} onChange={event => setEditPriority(Number(event.target.value) as TaskPriority)} style={field}>{priorities.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setEditingTask(null)} disabled={submitting} style={secondaryButton}>Hủy</button><button disabled={submitting || !editTitle.trim()} style={primaryButton}>{submitting ? 'Đang lưu' : 'Lưu thay đổi'}</button></div>
      </form>
    </Modal>
  </section>;
}

function BusyDots({ tasks, selected }: { tasks: StudyTask[]; selected: boolean }) {
  const score = tasks.reduce((sum, task) => sum + task.priority, 0);
  const count = score >= 7 ? 3 : score >= 3 ? 2 : tasks.length ? 1 : 0;
  const color = selected ? '#DBEAFE' : count === 3 ? '#EF4444' : count === 2 ? '#F59E0B' : '#94A3B8';
  return count ? <span aria-hidden="true" style={{ height: 5, display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2 }}>{Array.from({ length: count }, (_, index) => <i key={index} style={{ width: 4, height: 4, borderRadius: 99, background: color }} />)}</span> : <span style={{ height: 5, display: 'block' }} />;
}

const primaryButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 0, borderRadius: 8, padding: '9px 14px', background: '#1E3A8A', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const secondaryButton = { ...primaryButton, background: 'white', color: '#334155', border: '1px solid #CBD5E1' } as const;
const iconButton = { border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, color: '#334155', cursor: 'pointer' } as const;
const calendarDay = { minHeight: 42, padding: '4px 1px', border: 0, borderRadius: 7, fontSize: 12, cursor: 'pointer', display: 'grid', placeItems: 'center' } as const;
const muted = { minHeight: 110, color: '#64748B', background: '#F8FAFC', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 } as const;
const fieldLabel = { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 600 } as const;
const field = { padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: 8, color: '#0F172A', background: 'white', font: 'inherit' } as const;
