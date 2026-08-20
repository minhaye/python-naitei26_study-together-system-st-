import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { TaskManagementSection } from './TaskManagementSection';
import { Modal } from '../components/ui/Modal';
import {
  addRoadmapPhase,
  createRoadmap,
  deleteRoadmap,
  deleteRoadmapPhase,
  listRoadmaps,
  updateRoadmap,
  updateRoadmapPhase,
  type Roadmap,
  type RoadmapPhase,
} from '../lib/roadmap.api';
import { ApiError } from '../lib/apiClient';

type Status = 'Chưa bắt đầu' | 'Đang thực hiện' | 'Hoàn thành';
const STATUSES: Status[] = ['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành'];

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

const progressOf = (r: Roadmap) =>
  r.phases.length ? Math.round(r.phases.reduce((t, p) => t + p.progress, 0) / r.phases.length) : 0;

const statusOf = (r: Roadmap): Status =>
  progressOf(r) === 100 ? 'Hoàn thành' : progressOf(r) > 0 ? 'Đang thực hiện' : 'Chưa bắt đầu';

// ─── Phase list editor (dùng trong form edit) ───────────────────────────────
function PhaseListEditor({
  roadmapId,
  phases,
  onAdded,
  onDeleted,
}: {
  roadmapId: string;
  phases: RoadmapPhase[];
  onAdded: (phase: RoadmapPhase) => void;
  onDeleted: (phaseId: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (phases.length >= 20) { setErr('Tối đa 20 chặng.'); return; }
    setAdding(true); setErr(null);
    try {
      const p = await addRoadmapPhase(roadmapId, name);
      onAdded(p);
      setNewName('');
    } catch (c) { setErr(friendlyError(c)); }
    finally { setAdding(false); }
  };

  const remove = async (phaseId: string) => {
    if (!window.confirm('Xóa chặng này?')) return;
    setDeletingId(phaseId);
    try {
      await deleteRoadmapPhase(roadmapId, phaseId);
      onDeleted(phaseId);
    } catch (c) { setErr(friendlyError(c)); }
    finally { setDeletingId(null); }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={fieldLabel}>Chặng học</label>
      {phases.length === 0 && (
        <p style={{ margin: 0, color: '#94A3B8', fontSize: 13 }}>Chưa có chặng nào.</p>
      )}
      {phases.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', borderRadius: 7, padding: '6px 10px' }}>
          <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
          <span style={{ fontSize: 12, color: '#64748B' }}>{p.progress}%</span>
          <button
            type="button"
            onClick={() => void remove(p.id)}
            disabled={deletingId === p.id}
            aria-label={`Xóa chặng ${p.name}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex', padding: 2 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={onKey}
          maxLength={100}
          placeholder="Tên chặng mới..."
          style={{ ...input, flex: 1 }}
          disabled={adding}
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={adding || !newName.trim()}
          style={secondaryButton}
        >
          <Plus size={14} /> Thêm
        </button>
      </div>
      {err && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{err}</p>}
    </div>
  );
}

// ─── Phase input for new roadmap (textarea → tag list) ──────────────────────
function PhaseTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name || value.length >= 20) return;
    onChange([...value, name]);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={fieldLabel}>
        Các chặng học <span style={{ color: '#94A3B8', fontWeight: 400 }}>(tối đa 20)</span>
      </label>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((name, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}>
              {i + 1}. {name}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#93C5FD', padding: 0, display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={100}
          placeholder={value.length < 20 ? 'Nhập tên chặng, nhấn Enter...' : 'Đã đạt tối đa 20 chặng'}
          disabled={value.length >= 20}
          style={{ ...input, flex: 1 }}
        />
        <button type="button" onClick={add} disabled={!draft.trim() || value.length >= 20} style={secondaryButton}>
          <Plus size={14} /> Thêm
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function AimPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [adding, setAdding] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cGoal, setCGoal] = useState('');
  const [cDue, setCDue] = useState('');
  const [cPhases, setCPhases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editing, setEditing] = useState<Roadmap | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eGoal, setEGoal] = useState('');
  const [eDue, setEDue] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Phase progress modal
  const [phaseEditing, setPhaseEditing] = useState<{ roadmapId: string; phase: RoadmapPhase } | null>(null);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [phaseProgressInput, setPhaseProgressInput] = useState('0');

  useEffect(() => {
    void (async () => {
      try {
        setRoadmaps(await listRoadmaps());
      } catch (c) {
        setLoadError(friendlyError(c));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetCreate = () => { setCTitle(''); setCGoal(''); setCDue(''); setCPhases([]); };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!cTitle.trim() || !cGoal.trim()) return;
    setSaving(true); setError(null);
    try {
      const created = await createRoadmap({
        title: cTitle.trim(),
        goal: cGoal.trim(),
        due_date: cDue || null,
        phases: cPhases.map(name => ({ name })),
      });
      setRoadmaps(items => [created, ...items]);
      resetCreate();
      setAdding(false);
    } catch (c) { setError(friendlyError(c)); }
    finally { setSaving(false); }
  };

  const openEdit = (r: Roadmap) => {
    setError(null);
    setEditing(r);
    setETitle(r.title);
    setEGoal(r.goal);
    setEDue(r.due_date ?? '');
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !eTitle.trim() || !eGoal.trim()) return;
    setSaving(true); setError(null);
    try {
      const updated = await updateRoadmap(editing.id, { title: eTitle.trim(), goal: eGoal.trim(), due_date: eDue || null });
      setRoadmaps(items => items.map(item => item.id === updated.id ? { ...updated, phases: editing.phases } : item));
      setEditing(null);
    } catch (c) { setError(friendlyError(c)); }
    finally { setSaving(false); }
  };

  const confirmDeleteRoadmap = async () => {
    if (!editing || !window.confirm(`Xóa lộ trình "${editing.title}"? Hành động này không thể hoàn tác.`)) return;
    setDeleting(true); setError(null);
    try {
      await deleteRoadmap(editing.id);
      setRoadmaps(items => items.filter(item => item.id !== editing.id));
      setEditing(null);
    } catch (c) { setError(friendlyError(c)); }
    finally { setDeleting(false); }
  };

  const openPhase = (roadmapId: string, phase: RoadmapPhase) => {
    setError(null);
    setPhaseEditing({ roadmapId, phase });
    setPhaseProgress(phase.progress);
    setPhaseProgressInput(String(phase.progress));
  };

  const savePhase = async (e: FormEvent) => {
    e.preventDefault();
    if (!phaseEditing) return;
    const progress = Math.max(0, Math.min(100, Number(phaseProgressInput)));
    setSaving(true);
    try {
      const updated = await updateRoadmapPhase(phaseEditing.roadmapId, phaseEditing.phase.id, { progress });
      setRoadmaps(items => items.map(item =>
        item.id !== phaseEditing.roadmapId ? item
          : { ...item, phases: item.phases.map(p => p.id === updated.id ? updated : p) }
      ));
      setPhaseEditing(null);
    } catch (c) { setError(friendlyError(c)); }
    finally { setSaving(false); }
  };

  return (
    <main style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: 32, boxSizing: 'border-box', background: '#F8FAFC', color: '#0F172A' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        <TaskManagementSection />

        {/* Roadmap section */}
        <section style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Lộ trình &amp; Mục tiêu</h2>
              <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>
                Bấm lộ trình để chỉnh sửa; bấm từng chặng để cập nhật tiến độ.
              </p>
            </div>
            <button
              onClick={() => { resetCreate(); setError(null); setAdding(true); }}
              style={{ ...control, background: '#1E3A8A', color: 'white', border: 0 }}
            >
              <Plus size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Tạo lộ trình mới
            </button>
          </div>

          {loadError && (
            <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>
              ⚠ {loadError}
            </p>
          )}
          {error && <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p>}

          {loading ? (
            <p style={{ color: '#64748B' }}>Đang tải lộ trình...</p>
          ) : loadError ? null : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {STATUSES.map(status => (
                <div key={status} style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, minHeight: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <b>{status}</b>
                    <span style={{ color: '#64748B', fontSize: 13 }}>
                      {roadmaps.filter(r => statusOf(r) === status).length}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {roadmaps.filter(r => statusOf(r) === status).map(item => {
                      const progress = progressOf(item);
                      return (
                        <article
                          key={item.id}
                          onClick={() => openEdit(item)}
                          title="Bấm để chỉnh sửa lộ trình"
                          style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, cursor: 'pointer' }}
                        >
                          <b>{item.title}</b>
                          <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0' }}>{item.goal}</p>
                          <small>
                            Hạn: {item.due_date
                              ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${item.due_date}T00:00:00`))
                              : 'Chưa đặt hạn'}
                          </small>
                          <div style={{ height: 7, background: '#E2E8F0', borderRadius: 20, overflow: 'hidden', margin: '12px 0 6px' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: '#10B981', transition: 'width 0.3s' }} />
                          </div>
                          <small>{progress}% · {item.phases.filter(p => p.progress === 100).length}/{item.phases.length} chặng hoàn thành</small>
                          <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                            {item.phases.map(phase => (
                              <button
                                key={phase.id}
                                onClick={e => { e.stopPropagation(); openPhase(item.id, phase); }}
                                title="Bấm để cập nhật tiến độ"
                                style={{ ...control, padding: '7px 9px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                              >
                                <span>{phase.name}</span>
                                <b>{phase.progress}%</b>
                              </button>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Tạo lộ trình mới */}
      <Modal isOpen={adding} onClose={() => !saving && setAdding(false)} title="Tạo lộ trình mới">
        <form onSubmit={create} style={{ display: 'grid', gap: 14 }}>
          <label style={fieldLabel}>
            Tên lộ trình
            <input autoFocus required value={cTitle} maxLength={200} onChange={e => setCTitle(e.target.value)} style={input} />
          </label>
          <label style={fieldLabel}>
            Mục tiêu cần đạt
            <input required value={cGoal} maxLength={500} onChange={e => setCGoal(e.target.value)} style={input} />
          </label>
          <label style={fieldLabel}>
            Hạn hoàn thành
            <input type="date" value={cDue} onChange={e => setCDue(e.target.value)} style={input} />
          </label>
          <PhaseTagInput value={cPhases} onChange={setCPhases} />
          {error && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setAdding(false)} disabled={saving} style={secondaryButton}>Hủy</button>
            <button disabled={saving} style={primaryButton}>{saving ? 'Đang lưu...' : 'Tạo lộ trình'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Chỉnh sửa lộ trình */}
      <Modal isOpen={Boolean(editing)} onClose={() => !saving && !deleting && setEditing(null)} title="Chỉnh sửa lộ trình">
        {editing && (
          <form onSubmit={saveEdit} style={{ display: 'grid', gap: 16 }}>
            <label style={fieldLabel}>
              Tên lộ trình
              <input autoFocus required value={eTitle} maxLength={200} onChange={e => setETitle(e.target.value)} style={input} />
            </label>
            <label style={fieldLabel}>
              Mục tiêu cần đạt
              <input required value={eGoal} maxLength={500} onChange={e => setEGoal(e.target.value)} style={input} />
            </label>
            <label style={fieldLabel}>
              Hạn hoàn thành
              <input type="date" value={eDue} onChange={e => setEDue(e.target.value)} style={input} />
            </label>

            {/* Quản lý chặng trực tiếp trong form edit */}
            <PhaseListEditor
              roadmapId={editing.id}
              phases={editing.phases}
              onAdded={phase => setEditing(r => r ? { ...r, phases: [...r.phases, phase] } : r)}
              onDeleted={id => setEditing(r => r ? { ...r, phases: r.phases.filter(p => p.id !== id) } : r)}
            />

            {error && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void confirmDeleteRoadmap()}
                disabled={saving || deleting}
                style={{ ...secondaryButton, color: '#EF4444', borderColor: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> {deleting ? 'Đang xóa...' : 'Xóa lộ trình'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEditing(null)} disabled={saving || deleting} style={secondaryButton}>Hủy</button>
                <button disabled={saving || deleting} style={primaryButton}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Cập nhật tiến độ chặng */}
      <Modal isOpen={Boolean(phaseEditing)} onClose={() => !saving && setPhaseEditing(null)} title="Cập nhật tiến độ chặng">
        <form onSubmit={savePhase} style={{ display: 'grid', gap: 16 }}>
          <b style={{ fontSize: 14 }}>{phaseEditing?.phase.name}</b>
          <label style={fieldLabel}>
            Tiến độ: {phaseProgress}%
            <input
              type="range" min="0" max="100" step="1"
              value={phaseProgress}
              onChange={e => {
                const v = Number(e.target.value);
                setPhaseProgress(v);
                setPhaseProgressInput(String(v));
              }}
            />
          </label>
          <label style={fieldLabel}>
            Nhập chính xác (%)
            <input
              type="number" min="0" max="100"
              value={phaseProgressInput}
              onChange={e => {
                setPhaseProgressInput(e.target.value);
                const v = Math.max(0, Math.min(100, Number(e.target.value)));
                setPhaseProgress(v);
              }}
              style={{ ...input, width: 80 }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setPhaseEditing(null)} disabled={saving} style={secondaryButton}>Hủy</button>
            <button disabled={saving} style={primaryButton}>{saving ? 'Đang lưu...' : 'Lưu tiến độ'}</button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

const input = { padding: 10, border: '1px solid #CBD5E1', borderRadius: 7, font: 'inherit', width: '100%', boxSizing: 'border-box' } as const;
const primaryButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 0, borderRadius: 8, padding: '9px 14px', background: '#1E3A8A', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const secondaryButton = { ...primaryButton, background: 'white', color: '#334155', border: '1px solid #CBD5E1' } as const;
const control = { border: '1px solid #CBD5E1', background: 'white', borderRadius: 7, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#0F172A', display: 'inline-flex', alignItems: 'center' } as const;
const fieldLabel = { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 600 } as const;
