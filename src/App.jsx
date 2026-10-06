import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'daily-task-tracker:v1';

const starterTasks = [
  {
    id: crypto.randomUUID(),
    title: 'Prepare sprint planning notes',
    project: 'Product Launch',
    category: 'Planning',
    priority: 'High',
    dueDate: getTodayISO(),
    estimate: 45,
    recurring: 'Weekly',
    completed: false,
    elapsedSeconds: 1200,
    timerRunning: false,
    lastStartedAt: null
  },
  {
    id: crypto.randomUUID(),
    title: 'Review onboarding flow',
    project: 'UX Improvements',
    category: 'Research',
    priority: 'Medium',
    dueDate: getTomorrowISO(),
    estimate: 60,
    recurring: 'None',
    completed: false,
    elapsedSeconds: 600,
    timerRunning: true,
    lastStartedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  }
];

function getTodayISO() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

function getTomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

function getStoredTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return starterTasks;
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : starterTasks;
  } catch (error) {
    return starterTasks;
  }
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function getTaskDuration(task, referenceTime) {
  const baseSeconds = Number(task.elapsedSeconds || 0);

  if (!task.timerRunning || !task.lastStartedAt) {
    return baseSeconds;
  }

  const startTime = new Date(task.lastStartedAt).getTime();
  const elapsedFromStart = Math.max(0, (referenceTime - startTime) / 1000);
  return baseSeconds + elapsedFromStart;
}

function App() {
  const [tasks, setTasks] = useState(getStoredTasks);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState({
    title: '',
    project: '',
    category: 'Work',
    priority: 'Medium',
    dueDate: getTodayISO(),
    estimate: 30,
    recurring: 'None'
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'today':
        return tasks.filter((task) => task.dueDate === getTodayISO());
      case 'upcoming':
        return tasks.filter((task) => task.dueDate > getTodayISO());
      case 'completed':
        return tasks.filter((task) => task.completed);
      case 'active':
        return tasks.filter((task) => !task.completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const totals = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;
    const active = tasks.filter((task) => !task.completed).length;
    const focusMinutes = tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const todayMinutes = tasks
      .filter((task) => task.dueDate === getTodayISO())
      .reduce((sum, task) => sum + Number(task.estimate || 0), 0);

    return {
      completed,
      active,
      focusMinutes,
      todayMinutes
    };
  }, [tasks]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      title: '',
      project: '',
      category: 'Work',
      priority: 'Medium',
      dueDate: getTodayISO(),
      estimate: 30,
      recurring: 'None'
    });
    setEditingId(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    const nextTask = {
      id: editingId ?? crypto.randomUUID(),
      title: form.title.trim(),
      project: form.project.trim() || 'General',
      category: form.category,
      priority: form.priority,
      dueDate: form.dueDate,
      estimate: Number(form.estimate) || 30,
      recurring: form.recurring,
      completed: false,
      elapsedSeconds: 0,
      timerRunning: false,
      lastStartedAt: null
    };

    if (editingId) {
      setTasks((current) =>
        current.map((task) => (task.id === editingId ? { ...task, ...nextTask } : task))
      );
    } else {
      setTasks((current) => [nextTask, ...current]);
    }

    resetForm();
  };

  const handleEdit = (task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      project: task.project,
      category: task.category,
      priority: task.priority,
      dueDate: task.dueDate,
      estimate: task.estimate,
      recurring: task.recurring
    });
  };

  const handleDelete = (taskId) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (editingId === taskId) {
      resetForm();
    }
  };

  const handleToggleComplete = (taskId) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        return {
          ...task,
          completed: !task.completed,
          timerRunning: task.completed ? task.timerRunning : false,
          lastStartedAt: task.completed ? task.lastStartedAt : null
        };
      })
    );
  };

  const handleTimerToggle = (taskId) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        if (task.timerRunning) {
          const elapsed = getTaskDuration(task, Date.now());
          return {
            ...task,
            timerRunning: false,
            elapsedSeconds: elapsed,
            lastStartedAt: null
          };
        }

        return {
          ...task,
          timerRunning: true,
          lastStartedAt: new Date().toISOString()
        };
      })
    );
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily-task-tracker-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Productivity dashboard</p>
          <h1>Daily Project Tracker</h1>
        </div>
        <button className="secondary-button" onClick={handleExport}>
          Export data
        </button>
      </header>

      <section className="stats-grid">
        <article className="stat-card accent-blue">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </article>
        <article className="stat-card accent-green">
          <span>Completed</span>
          <strong>{totals.completed}</strong>
        </article>
        <article className="stat-card accent-orange">
          <span>Active</span>
          <strong>{totals.active}</strong>
        </article>
        <article className="stat-card accent-purple">
          <span>Focus time</span>
          <strong>{formatDuration(totals.focusMinutes * 60)}</strong>
        </article>
      </section>

      <main className="content-grid">
        <section className="panel form-panel">
          <div className="panel-header">
            <h2>{editingId ? 'Edit task' : 'Add a new task'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="task-form">
            <label>
              Task title
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Draft launch checklist"
                required
              />
            </label>

            <div className="input-row">
              <label>
                Project
                <input
                  type="text"
                  name="project"
                  value={form.project}
                  onChange={handleChange}
                  placeholder="Project or client"
                />
              </label>

              <label>
                Category
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="Work">Work</option>
                  <option value="Planning">Planning</option>
                  <option value="Research">Research</option>
                  <option value="Design">Design</option>
                  <option value="Personal">Personal</option>
                </select>
              </label>
            </div>

            <div className="input-row">
              <label>
                Priority
                <select name="priority" value={form.priority} onChange={handleChange}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </label>

              <label>
                Due date
                <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
              </label>
            </div>

            <div className="input-row">
              <label>
                Est. time (min)
                <input
                  type="number"
                  name="estimate"
                  min="15"
                  step="15"
                  value={form.estimate}
                  onChange={handleChange}
                />
              </label>

              <label>
                Recurrence
                <select name="recurring" value={form.recurring} onChange={handleChange}>
                  <option value="None">None</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                {editingId ? 'Save changes' : 'Add task'}
              </button>
              {editingId && (
                <button type="button" className="secondary-button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="panel-header list-header">
            <h2>Task board</h2>
            <div className="filter-group" aria-label="Task filters">
              <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                All
              </button>
              <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>
                Today
              </button>
              <button className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}>
                Upcoming
              </button>
              <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>
                Done
              </button>
            </div>
          </div>

          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <div className="empty-state">No tasks in this view yet.</div>
            ) : (
              filteredTasks.map((task) => {
                const duration = getTaskDuration(task, now);

                return (
                  <article key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
                    <div className="task-main">
                      <div className="task-topline">
                        <button
                          className={`checkbox ${task.completed ? 'checked' : ''}`}
                          onClick={() => handleToggleComplete(task.id)}
                          aria-label={`Mark ${task.title} complete`}
                        >
                          {task.completed ? '✓' : ''}
                        </button>
                        <div>
                          <h3>{task.title}</h3>
                          <p>
                            {task.project} · {task.category}
                          </p>
                        </div>
                      </div>

                      <div className="task-meta">
                        <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                        <span>{task.recurring}</span>
                        <span>Due: {task.dueDate}</span>
                        <span>{task.estimate} min</span>
                      </div>
                    </div>

                    <div className="task-actions">
                      <div className="timer-display">{formatDuration(duration)}</div>
                      <button className="secondary-button" onClick={() => handleTimerToggle(task.id)}>
                        {task.timerRunning ? 'Stop timer' : 'Start timer'}
                      </button>
                      <button className="ghost-button" onClick={() => handleEdit(task)}>
                        Edit
                      </button>
                      <button className="ghost-button danger" onClick={() => handleDelete(task.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
