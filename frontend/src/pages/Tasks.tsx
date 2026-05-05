import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Header } from '../components/layout';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { normalizeUserRole } from '../utils/userRole';
import {
  ClipboardList,
  BookOpen,
  BarChart3,
  Plus,
  RefreshCw,
  Ticket,
  X,
  Clock,
  UserCheck,
  Filter,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';

const ASSIGN_ROLES = new Set(['ceo', 'admin', 'service_manager', 'hr_manager']);
const VIEW_ALL_ROLES = new Set(['ceo', 'admin', 'service_manager', 'hr_manager', 'finance']);

function canAssign(role: string | undefined) {
  if (!role) return false;
  if (role === 'ceo' || role === 'admin') return true;
  return ASSIGN_ROLES.has(role);
}

function canViewAll(role: string | undefined) {
  if (!role) return false;
  if (role === 'ceo' || role === 'admin') return true;
  return VIEW_ALL_ROLES.has(role);
}

const priorityBadge: Record<string, string> = {
  low: 'badge-neutral',
  medium: 'badge-primary',
  high: 'badge-warning',
};

/** Match Service Tickets / DataTable status chip colors */
const statusBadge: Record<string, string> = {
  pending: 'bg-neutral-100 text-neutral-700',
  in_progress: 'bg-warning-100 text-warning-700',
  completed: 'bg-success-100 text-success-700',
  overdue: 'bg-danger-100 text-danger-700',
};

/** Task / diary work categories (API uses snake_case values). */
const TASK_WORK_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'rnd', label: 'R&D' },
  { value: 'troubleshoot', label: 'Troubleshoot' },
  { value: 'training', label: 'Training' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'billing', label: 'Billing' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'meeting', label: 'Meeting' },
];

function formatDiaryTaskCompletedAt(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return format(parseISO(iso), 'PPp');
  } catch {
    return null;
  }
}

function toInputDateTimeLocal(v: string | null | undefined) {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function formatTaskDueDisplay(v: unknown) {
  if (v == null || v === '') return '—';
  const s = String(v);
  if (!s.includes('T')) return s.slice(0, 10);
  try {
    return format(parseISO(s), 'yyyy-MM-dd HH:mm');
  } catch {
    return s.replace('T', ' ').slice(0, 16);
  }
}

type TaskFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';

export function Tasks() {
  const user = useAuthStore((s) => s.user);
  const role = normalizeUserRole(user?.role);
  const assignOk = canAssign(role);
  const viewAll = canViewAll(role);
  const isTechnician = role === 'technician';
  const canCreateTask = assignOk || isTechnician;
  const myId = user?.id;

  const [tab, setTab] = useState<'tasks' | 'diary' | 'reports'>('tasks');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [tasks, setTasks] = useState<any[]>([]);
  const [diary, setDiary] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [reportUserId, setReportUserId] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [empReport, setEmpReport] = useState<any>(null);
  const [diaryReport, setDiaryReport] = useState<any>(null);
  const [perfReport, setPerfReport] = useState<any>(null);

  const [tickets, setTickets] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({
    ticket_id: '',
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    task_category: 'meeting',
    reminder_at: '',
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<Record<string, string>>({});

  const [diaryForm, setDiaryForm] = useState({
    task_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '10:00',
    notes: '',
    work_category: '',
  });
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [diaryAttachment, setDiaryAttachment] = useState<File | null>(null);

  const openDiaryModal = () => {
    setDiaryAttachment(null);
    setShowDiaryModal(true);
  };

  const closeDiaryModal = () => {
    setDiaryAttachment(null);
    setShowDiaryModal(false);
  };

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: any = {};
      if (viewAll && reportUserId) params.user_id = reportUserId;
      const data = await api.getTaskDiary(params);
      setDiary(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load diary');
      setDiary([]);
    } finally {
      setLoading(false);
    }
  }, [viewAll, reportUserId]);

  useEffect(() => {
    if (tab === 'tasks') void loadTasks();
  }, [tab, loadTasks]);

  useEffect(() => {
    if (tab === 'diary') {
      void loadDiary();
      void loadTasks();
    }
  }, [tab, loadDiary, loadTasks]);

  useEffect(() => {
    if (assignOk || viewAll) {
      api
        .getUsers()
        .then((u) => setUsers(Array.isArray(u) ? u : []))
        .catch(() => setUsers([]));
    }
  }, [assignOk, viewAll]);

  useEffect(() => {
    if (showTaskModal && (assignOk || isTechnician)) {
      api
        .getTickets()
        .then((t) => setTickets(Array.isArray(t) ? t : []))
        .catch(() => setTickets([]));
    }
  }, [showTaskModal, assignOk, isTechnician]);

  const openNewTaskModal = () => {
    setNewTask({
      ticket_id: '',
      title: '',
      description: '',
      assigned_to: myId || '',
      priority: 'medium',
      due_date: '',
      task_category: 'meeting',
      reminder_at: '',
    });
    setShowTaskModal(true);
  };

  const onSelectServiceTicket = (ticketId: string) => {
    if (!ticketId) {
      setNewTask((s) => ({ ...s, ticket_id: '' }));
      return;
    }
    const t = tickets.find((x) => x.id === ticketId);
    setNewTask((s) => ({
      ...s,
      ticket_id: ticketId,
      title: t?.title || s.title,
      description: t?.description != null ? String(t.description) : s.description,
      assigned_to: isTechnician ? (myId || s.assigned_to) : t?.assignedTo || t?.assigned_to || s.assigned_to,
      priority:
        t?.priority === 'critical'
          ? 'high'
          : ['low', 'medium', 'high'].includes(String(t?.priority))
            ? String(t.priority)
            : s.priority,
      due_date: (t?.dueDate || t?.due_date || s.due_date || '').toString().slice(0, 10),
    }));
  };

  const loadReports = async () => {
    setLoading(true);
    setErr(null);
    try {
      const q: any = {};
      if (viewAll && reportUserId) q.user_id = reportUserId;
      if (reportFrom) q.from = reportFrom;
      if (reportTo) q.to = reportTo;
      const [a, b, c] = await Promise.all([
        api.getTaskReportEmployeeTasks(q),
        api.getTaskReportDiary(q),
        api.getTaskReportPerformance(q),
      ]);
      setEmpReport(a);
      setDiaryReport(b);
      setPerfReport(c);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'reports') void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const taskOptions = useMemo(() => {
    return tasks.filter((t) => t.effectiveStatus !== 'completed' && (!myId || t.assignedTo === myId));
  }, [tasks, myId]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter((t) => {
      if (taskFilter === 'overdue') return t.effectiveStatus === 'overdue';
      if (taskFilter === 'completed') return t.status === 'completed';
      return t.status === taskFilter;
    });
  }, [tasks, taskFilter]);

  const diaryByDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of diary) {
      const k = e.workDate || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [diary]);

  const diaryDayTotalMinutes = (entries: any[]) =>
    entries.reduce((s, e) => s + (Number(e.totalMinutes) || 0), 0);

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasTicket = Boolean(newTask.ticket_id);
    const assignee = isTechnician ? myId : newTask.assigned_to;
    if (!assignee) return;
    if (!hasTicket && !newTask.title.trim()) return;
    try {
      await api.createTask({
        ...(hasTicket ? { ticket_id: newTask.ticket_id } : {}),
        ...(newTask.title.trim() ? { title: newTask.title.trim() } : {}),
        description: newTask.description || undefined,
        assigned_to: assignee,
        priority: newTask.priority,
        ...(newTask.due_date ? { due_date: newTask.due_date } : {}),
        task_category: newTask.task_category || 'meeting',
        ...(newTask.reminder_at ? { reminder_at: newTask.reminder_at } : {}),
      });
      setShowTaskModal(false);
      await loadTasks();
    } catch (e: any) {
      alert(e?.message || 'Failed to create task');
    }
  };

  const submitDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (diaryAttachment) {
        const fd = new FormData();
        fd.append('work_date', diaryForm.work_date);
        fd.append('start_time', diaryForm.start_time);
        fd.append('end_time', diaryForm.end_time);
        if (diaryForm.notes.trim()) fd.append('notes', diaryForm.notes);
        if (diaryForm.task_id) fd.append('task_id', diaryForm.task_id);
        if (diaryForm.work_category) fd.append('work_category', diaryForm.work_category);
        if (viewAll && reportUserId) fd.append('user_id', reportUserId);
        fd.append('attachment', diaryAttachment);
        await api.createTaskDiary(fd);
      } else {
        await api.createTaskDiary({
          task_id: diaryForm.task_id || undefined,
          work_date: diaryForm.work_date,
          start_time: diaryForm.start_time,
          end_time: diaryForm.end_time,
          notes: diaryForm.notes || undefined,
          ...(diaryForm.work_category ? { work_category: diaryForm.work_category } : {}),
          ...(viewAll && reportUserId ? { user_id: reportUserId } : {}),
        });
      }
      setDiaryForm((d) => ({ ...d, notes: '', work_category: '' }));
      setDiaryAttachment(null);
      closeDiaryModal();
      await loadDiary();
      await loadTasks();
    } catch (e: any) {
      alert(e?.message || 'Failed to log time');
    }
  };

  const downloadDiaryAttachment = async (logId: string, filename: string) => {
    try {
      const blob = await api.getTaskDiaryAttachment(logId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'attachment';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || 'Download failed');
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await api.updateTaskStatus(id, status);
      await loadTasks();
      if (status === 'completed') void loadDiary();
    } catch (e: any) {
      alert(e?.message || 'Failed to update status');
    }
  };

  const changeTaskCategory = async (id: string, task_category: string) => {
    try {
      await api.updateTask(id, { task_category });
      await loadTasks();
    } catch (e: any) {
      alert(e?.message || 'Failed to update category');
    }
  };

  const saveTaskReminder = async (id: string, reminder_at: string) => {
    try {
      await api.updateTask(id, { reminder_at: reminder_at || null });
      await loadTasks();
    } catch (e: any) {
      alert(e?.message || 'Failed to update reminder');
    }
  };

  const filterChips: { id: TaskFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Done' },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Tasks"
        subtitle={
          isTechnician
            ? `${tasks.length} assigned to you · log time in Diary`
            : `${tasks.length} tasks · diary & team reports`
        }
        showAddButton={canCreateTask && tab === 'tasks'}
        addButtonText="New task"
        onAddClick={openNewTaskModal}
      />

      {isTechnician && tab === 'tasks' && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-2">
          <UserCheck className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <p className="text-sm text-primary-700">
            Use <strong className="font-semibold">New task</strong> in the header to add work from the field. Tasks are assigned
            to you. Link a service ticket when the work ties to a job.
          </p>
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 overflow-x-auto max-w-full touch-pan-x">
            {(
              [
                ['tasks', 'Tasks', ClipboardList],
                ['diary', 'Diary', BookOpen],
                ['reports', 'Reports', BarChart3],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap shrink-0 touch-manipulation transition-all ${
                  tab === id ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (tab === 'tasks' ? loadTasks() : tab === 'diary' ? loadDiary() : loadReports())}
            className="btn-ghost text-sm self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 text-danger-800 px-4 py-3 text-sm">{err}</div>
        )}

        {tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Filter className="h-4 w-4 text-neutral-400 shrink-0" />
              <span className="hidden sm:inline">Filter</span>
              <div className="flex items-center gap-2 overflow-x-auto touch-pan-x pb-0.5">
                {filterChips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTaskFilter(c.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 touch-manipulation border transition-colors ${
                      taskFilter === c.id
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTasks.map((t) => (
                <div key={t.id} className="card p-4 hover:shadow-md transition-shadow touch-manipulation">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-neutral-900 text-sm sm:text-base leading-snug line-clamp-3">
                      {t.title}
                    </h3>
                    <span className={`badge shrink-0 ${priorityBadge[t.priority] || 'badge-neutral'}`}>{t.priority}</span>
                  </div>

                  {t.ticketNumber || t.ticketId ? (
                    <Link
                      to="/service"
                      className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium mb-2 hover:text-primary-700"
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      {t.ticketNumber || 'Ticket'}
                    </Link>
                  ) : null}

                  {t.description ? (
                    <p className="text-xs text-neutral-600 line-clamp-2 mb-3">{t.description}</p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`badge ${statusBadge[t.effectiveStatus] || statusBadge.pending}`}
                    >
                      {(t.effectiveStatus || 'pending').replace('_', ' ')}
                    </span>
                    <span className="text-xs font-medium bg-violet-50 text-violet-800 border border-violet-100 rounded-md px-2 py-0.5">
                      {t.taskCategoryLabel || 'Meeting'}
                    </span>
                    {viewAll && t.assigneeName && (
                      <span className="text-xs text-neutral-500 truncate max-w-[10rem]">{t.assigneeName}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-3">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span>Due {formatTaskDueDisplay(t.dueDate)}</span>
                    {t.inactiveWarning && <span className="text-warning-700 font-medium">· log time</span>}
                  </div>

                  {myId && t.assignedTo === myId ? (
                    <>
                      <label className="label">Category</label>
                      <select
                        className="input touch-manipulation mb-3"
                        value={t.taskCategory || 'meeting'}
                        onChange={(e) => void changeTaskCategory(t.id, e.target.value)}
                      >
                        {TASK_WORK_CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {t.status !== 'completed' ? (
                        <>
                          <label className="label">Reminder</label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="datetime-local"
                              className="input touch-manipulation"
                              value={reminderDraft[t.id] ?? toInputDateTimeLocal(t.reminderAt)}
                              onChange={(e) => setReminderDraft((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              className="btn-secondary text-xs whitespace-nowrap"
                              onClick={() =>
                                void saveTaskReminder(
                                  t.id,
                                  reminderDraft[t.id] ?? toInputDateTimeLocal(t.reminderAt)
                                )
                              }
                            >
                              Save
                            </button>
                          </div>
                          <label className="label">Update status</label>
                          <select
                            className="input touch-manipulation"
                            value={t.status}
                            onChange={(e) => void changeStatus(t.id, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                          </select>
                          <p className="text-xs text-neutral-500 mt-1">
                            In-progress time is captured automatically into Diary.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-500">Completed — time logged to Diary automatically.</p>
                      )}
                    </>
                  ) : (
                    <div className="h-1" />
                  )}
                </div>
              ))}
            </div>
            {filteredTasks.length === 0 && !loading && (
              <div className="card py-14 text-center text-neutral-500 text-sm">No tasks match this filter.</div>
            )}
          </div>
        )}

        {tab === 'diary' && (
          <div className="space-y-4">
            {viewAll && (
              <div className="card p-4 flex flex-col sm:flex-row sm:flex-wrap gap-4 items-stretch sm:items-end">
                <div className="flex-1 min-w-[12rem]">
                  <label className="label">Log as user</label>
                  <select className="input" value={reportUserId} onChange={(e) => setReportUserId(e.target.value)}>
                    <option value="">Default</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => void loadDiary()} className="btn-secondary text-sm touch-manipulation">
                  Apply filter
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Time log</h2>
              <button type="button" onClick={openDiaryModal} className="btn-primary text-sm touch-manipulation w-full sm:w-auto justify-center">
                <Plus className="w-4 h-4" />
                Log time
              </button>
            </div>

            <div className="space-y-6">
              {diaryByDate.map(([dateStr, entries]) => {
                const mins = diaryDayTotalMinutes(entries);
                const hrs = Math.round((mins / 60) * 10) / 10;
                let label = dateStr;
                try {
                  label = format(parseISO(dateStr), 'EEEE, MMM d, yyyy');
                } catch {
                  /* keep raw */
                }
                return (
                  <section key={dateStr}>
                    <div className="sticky top-16 z-10 bg-neutral-50 border-b border-neutral-200 py-2 mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-800 truncate">{label}</h3>
                      <span className="badge-primary shrink-0">{hrs} h total</span>
                    </div>
                    <ul className="space-y-3">
                      {entries.map((d) => {
                        const isTaskDone = Boolean(d.taskId && d.taskStatus === 'completed');
                        const completedLabel = formatDiaryTaskCompletedAt(d.taskCompletedAt);
                        return (
                          <li
                            key={d.id}
                            className={`card p-4 flex gap-3 items-start ${isTaskDone ? 'bg-neutral-50/90 border-neutral-200/80' : ''}`}
                          >
                            {d.taskId ? (
                              isTaskDone ? (
                                <CheckCircle2
                                  className="w-5 h-5 text-success-600 shrink-0 mt-0.5"
                                  aria-label="Task completed"
                                />
                              ) : (
                                <span
                                  className="w-5 h-5 shrink-0 mt-0.5 rounded-full border-2 border-neutral-300"
                                  aria-hidden
                                />
                              )
                            ) : (
                              <span className="w-5 shrink-0" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <div
                                className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium ${
                                  isTaskDone ? 'text-neutral-500 line-through decoration-neutral-400' : 'text-neutral-900'
                                }`}
                              >
                                <span className={`tabular-nums ${isTaskDone ? 'text-neutral-500' : 'text-neutral-600'}`}>
                                  {d.startTime?.slice(0, 5)}–{d.endTime?.slice(0, 5)}
                                </span>
                                <span className={isTaskDone ? 'text-neutral-500' : 'text-primary-600'}>{d.totalTime}</span>
                                {d.workCategoryLabel ? (
                                  <span
                                    className={`text-xs font-medium rounded px-1.5 py-0.5 ${
                                      isTaskDone
                                        ? 'text-violet-600/80 bg-violet-50/80 line-through decoration-transparent'
                                        : 'text-violet-700 bg-violet-50'
                                    }`}
                                  >
                                    {d.workCategoryLabel}
                                  </span>
                                ) : null}
                                {d.taskTitle && (
                                  <span
                                    className={`font-normal truncate ${isTaskDone ? 'text-neutral-500' : 'text-neutral-600'}`}
                                  >
                                    · {d.taskTitle}
                                  </span>
                                )}
                              </div>
                              {isTaskDone && completedLabel ? (
                                <p className="text-xs text-neutral-600 mt-1.5 font-normal no-underline">
                                  Completed {completedLabel}
                                </p>
                              ) : null}
                              {d.notes ? (
                                <p
                                  className={`text-sm mt-2 whitespace-pre-wrap ${
                                    isTaskDone
                                      ? 'text-neutral-500 line-through decoration-neutral-400'
                                      : 'text-neutral-600'
                                  }`}
                                >
                                  {d.notes}
                                </p>
                              ) : null}
                              {d.attachmentUrl ? (
                                <button
                                  type="button"
                                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 touch-manipulation no-underline"
                                  onClick={() =>
                                    downloadDiaryAttachment(d.id, d.attachmentName || 'attachment')
                                  }
                                >
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  {d.attachmentName || 'Attachment'}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
            {diary.length === 0 && !loading && (
              <div className="card py-12 text-center text-neutral-500 text-sm">
                No diary entries yet. Use <strong className="text-neutral-700">Log time</strong> to add one.
              </div>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            <div className="card p-4 flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-end">
              {viewAll && (
                <div className="min-w-[12rem]">
                  <label className="label">User</label>
                  <select className="input" value={reportUserId} onChange={(e) => setReportUserId(e.target.value)}>
                    <option value="">Scope</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">From</label>
                <input type="date" className="input w-full sm:w-auto" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">To</label>
                <input type="date" className="input w-full sm:w-auto" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
              </div>
              <button type="button" onClick={() => loadReports()} className="btn-primary text-sm touch-manipulation">
                Apply
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="card p-4">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">Task summary</h4>
                {empReport && (
                  <ul className="text-sm space-y-2 text-neutral-600">
                    <li>Assigned: {empReport.totalAssigned}</li>
                    <li>Completed: {empReport.completed}</li>
                    <li>Pending: {empReport.pending}</li>
                    <li>In progress: {empReport.inProgress}</li>
                    <li>Overdue: {empReport.overdue}</li>
                  </ul>
                )}
              </div>
              <div className="card p-4 md:col-span-2">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">Diary productivity</h4>
                {diaryReport?.productivity && (
                  <p className="text-sm text-neutral-600 mb-2">
                    Total {diaryReport.productivity.totalHours} h over {diaryReport.productivity.daysLogged} day(s).
                  </p>
                )}
                {diaryReport?.hoursPerDay?.length > 0 && (
                  <ul className="text-sm text-neutral-600 space-y-1 max-h-36 overflow-y-auto">
                    {diaryReport.hoursPerDay.map((x: any) => (
                      <li key={x.date}>
                        {x.date}: {x.hoursWorked} h
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-4 md:col-span-3">
                <h4 className="text-sm font-semibold text-neutral-800 mb-3">Performance</h4>
                {perfReport && (
                  <ul className="text-sm space-y-2 text-neutral-600">
                    <li>Completed: {perfReport.completedCount}</li>
                    <li>Assigned: {perfReport.assignedInPeriod}</li>
                    <li>Completion rate: {perfReport.completionRate != null ? `${perfReport.completionRate}%` : '—'}</li>
                    <li>Avg. completion (h): {perfReport.avgCompletionHours ?? '—'}</li>
                    <li>Diary hours: {perfReport.workTimeFromDiaryHours ?? 0}</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB — diary quick add */}
      {tab === 'diary' && (
        <button
          type="button"
          onClick={openDiaryModal}
          className="lg:hidden fixed z-40 right-4 h-14 w-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center touch-manipulation active:scale-95"
          style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
          aria-label="Log time"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* New task modal — ticket-style sheet on mobile */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-900">{isTechnician ? 'New task' : 'Assign task'}</h2>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg touch-manipulation"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitTask} className="p-6 space-y-4">
              <div>
                <label className="label flex items-center gap-1">
                  <Ticket className="h-3.5 w-3.5 text-neutral-500" />
                  Service ticket (optional)
                </label>
                <select className="input touch-manipulation" value={newTask.ticket_id} onChange={(e) => onSelectServiceTicket(e.target.value)}>
                  <option value="">— None —</option>
                  {tickets.map((tk: any) => (
                    <option key={tk.id} value={tk.id}>
                      {(tk.ticketNumber || tk.ticket_number) + ' — ' + (tk.title || '').slice(0, 55)}
                    </option>
                  ))}
                </select>
                {isTechnician && <p className="text-xs text-neutral-500 mt-1">Only your assigned tickets are listed.</p>}
              </div>
              <div>
                <label className="label">Title {!newTask.ticket_id && '*'}</label>
                <input
                  type="text"
                  className="input"
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  required={!newTask.ticket_id}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[88px]"
                  value={newTask.description}
                  onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input touch-manipulation"
                  value={newTask.task_category}
                  onChange={(e) => setNewTask((t) => ({ ...t, task_category: e.target.value }))}
                >
                  {TASK_WORK_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {!isTechnician && (
                <div>
                  <label className="label">Assign to *</label>
                  <select
                    className="input touch-manipulation"
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask((t) => ({ ...t, assigned_to: e.target.value }))}
                    required
                  >
                    <option value="">Select user</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={newTask.priority} onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input type="date" className="input" value={newTask.due_date} onChange={(e) => setNewTask((t) => ({ ...t, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Reminder (optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={newTask.reminder_at}
                  onChange={(e) => setNewTask((t) => ({ ...t, reminder_at: e.target.value }))}
                />
              </div>
              {isTechnician && (
                <p className="text-xs text-neutral-500">
                  Task is assigned to you. Due date is optional when linked to a ticket (defaults apply on save).
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTaskModal(false)} className="flex-1 btn-secondary touch-manipulation">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary touch-manipulation">
                  Save task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDiaryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-900">Log time</h2>
              <button
                type="button"
                onClick={closeDiaryModal}
                className="p-2 hover:bg-neutral-100 rounded-lg touch-manipulation"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitDiary} className="p-6 space-y-4">
              <div>
                <label className="label">Related task</label>
                <select
                  className="input touch-manipulation"
                  value={diaryForm.task_id}
                  onChange={(e) => setDiaryForm((d) => ({ ...d, task_id: e.target.value }))}
                >
                  <option value="">General / no task</option>
                  {taskOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Category (optional)</label>
                <select
                  className="input touch-manipulation"
                  value={diaryForm.work_category}
                  onChange={(e) => setDiaryForm((d) => ({ ...d, work_category: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {TASK_WORK_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Work date *</label>
                <input
                  type="date"
                  className="input"
                  value={diaryForm.work_date}
                  onChange={(e) => setDiaryForm((d) => ({ ...d, work_date: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start *</label>
                  <input
                    type="time"
                    className="input"
                    value={diaryForm.start_time}
                    onChange={(e) => setDiaryForm((d) => ({ ...d, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input
                    type="time"
                    className="input"
                    value={diaryForm.end_time}
                    onChange={(e) => setDiaryForm((d) => ({ ...d, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input min-h-[88px]"
                  value={diaryForm.notes}
                  onChange={(e) => setDiaryForm((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="What did you work on?"
                />
              </div>
              <div>
                <label className="label">Attachment (optional)</label>
                <input
                  type="file"
                  className="input text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setDiaryAttachment(e.target.files?.[0] ?? null)}
                />
                {diaryAttachment ? (
                  <p className="text-xs text-neutral-500 mt-1 truncate" title={diaryAttachment.name}>
                    {diaryAttachment.name}
                  </p>
                ) : null}
                <p className="text-xs text-neutral-500 mt-1">Max 10 MB. PDF, images, or common office formats.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeDiaryModal} className="flex-1 btn-secondary touch-manipulation">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary touch-manipulation">
                  Save entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
