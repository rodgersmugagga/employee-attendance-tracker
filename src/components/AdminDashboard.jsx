import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getAllLogs, deleteLog, registerEmployee, exportLogs, getMemos, createMemo } from '../utils/storage';

const AdminCharts = lazy(() => import('./AdminCharts'));

const emptyEmployee = { name: '', email: '', password: '', role: 'employee' };

const AdminDashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);

  const stats = useMemo(() => {
    const late = logs.filter((log) => log.status === 'Late').length;
    const onTime = logs.filter((log) => log.status === 'On Time').length;
    return { total: logs.length, late, onTime };
  }, [logs]);

  const loadAdminData = useCallback(() => Promise.all([
    getAllLogs(),
    getMemos(),
  ]), []);

  const applyAdminData = useCallback((allLogs, allMemos) => {
    setLogs(allLogs);
    setMemos(allMemos);
  }, []);

  const refreshAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [allLogs, allMemos] = await loadAdminData();
      applyAdminData(allLogs, allMemos);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, [applyAdminData, loadAdminData]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        const [allLogs, allMemos] = await loadAdminData();
        if (!cancelled) applyAdminData(allLogs, allMemos);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [applyAdminData, loadAdminData]);

  const handleAddEmployee = async (event) => {
    event.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await registerEmployee(newEmployee);
      setNewEmployee(emptyEmployee);
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      await deleteLog(id);
      await refreshAdmin();
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  const handleCreateMemo = async (event) => {
    event.preventDefault();
    const content = newMemo.trim();
    if (!content) return;

    setMemoLoading(true);
    try {
      await createMemo({ content, author: user.name });
      setNewMemo('');
      setMemos(await getMemos());
    } catch (err) {
      console.error('Failed to create memo', err);
    } finally {
      setMemoLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="container page-shell">
        <div className="loading-card">Loading administration...</div>
      </main>
    );
  }

  return (
    <main className="container page-shell animate-fade-in">
      <header className="page-header">
        <div className="page-heading">
          <h2 className="page-title">Manager Dashboard</h2>
          <p>Blue Ox Kampus Administration</p>
        </div>
        <div className="header-actions">
          <button
            onClick={exportLogs}
            className="btn-primary outline"
            type="button"
          >
            Export Logs
          </button>
          <button
            onClick={() => setShowAddForm((value) => !value)}
            className="btn-primary"
            type="button"
          >
            {showAddForm ? 'Cancel' : 'Add Employee'}
          </button>
          <button onClick={onLogout} className="btn-ghost" type="button">Logout</button>
        </div>
      </header>

      {showAddForm && (
        <section className="glass-card form-panel animate-fade-in">
          <h3>Register New Employee</h3>
          <form onSubmit={handleAddEmployee} className="form-grid">
            <div className="form-field">
              <label>Full Name</label>
              <input
                type="text"
                className="input-field"
                value={newEmployee.name}
                onChange={(event) => setNewEmployee({ ...newEmployee, name: event.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input
                type="email"
                className="input-field"
                value={newEmployee.email}
                onChange={(event) => setNewEmployee({ ...newEmployee, email: event.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label>Password</label>
              <input
                type="password"
                className="input-field"
                value={newEmployee.password}
                onChange={(event) => setNewEmployee({ ...newEmployee, password: event.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary form-submit" disabled={addLoading}>
              {addLoading ? 'Adding...' : 'Register User'}
            </button>
          </form>
          {addError && <p className="form-error">{addError}</p>}
        </section>
      )}

      <section className="stats-grid">
        <article className="glass-card stat-card">
          <p>Total Logs</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="glass-card stat-card">
          <p>On Time</p>
          <strong className="text-success">{stats.onTime}</strong>
        </article>
        <article className="glass-card stat-card">
          <p>Late Arrivals</p>
          <strong className="text-danger">{stats.late}</strong>
        </article>
      </section>

      <Suspense fallback={
        <div className="chart-grid">
          <section className="glass-card chart-card chart-loading">Loading chart...</section>
          <section className="glass-card chart-card chart-loading">Loading chart...</section>
        </div>
      }>
        <AdminCharts logs={logs} stats={stats} />
      </Suspense>

      <div className="admin-work-grid">
        <section className="glass-card">
          <h3>Post New Announcement</h3>
          <form onSubmit={handleCreateMemo} className="memo-form">
            <textarea
              className="input-field"
              placeholder="Type company announcement here..."
              value={newMemo}
              onChange={(event) => setNewMemo(event.target.value)}
            />
            <button type="submit" className="btn-primary full-width" disabled={memoLoading}>
              {memoLoading ? 'Posting...' : 'Post Memo'}
            </button>
          </form>
        </section>

        <section className="glass-card notice-panel">
          <h3>Active Notices</h3>
          <div className="memo-list">
            {memos.map((memo) => (
              <article key={memo.id} className="memo-card">
                <p>{memo.content}</p>
                <small>{memo.author}</small>
              </article>
            ))}
            {memos.length === 0 && <p className="empty-state">No active notices</p>}
          </div>
        </section>
      </div>

      <section className="glass-card table-card">
        <h3>Employee Attendance Records</h3>
        <div className="table-wrap">
          <table className="responsive-table admin-records-table">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Exit</th>
                <th>Employee</th>
                <th>Date</th>
                <th>In</th>
                <th>Out</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Entry">
                    {log.photo ? (
                      <img src={log.photo} loading="lazy" alt="Punch in" className="log-photo in" />
                    ) : (
                      <span className="photo-placeholder" />
                    )}
                  </td>
                  <td data-label="Exit">
                    {log.outPhoto ? (
                      <img src={log.outPhoto} loading="lazy" alt="Punch out" className="log-photo out" />
                    ) : (
                      <span className="photo-placeholder" />
                    )}
                  </td>
                  <td data-label="Employee" className="strong-cell">{log.userName}</td>
                  <td data-label="Date">{log.date}</td>
                  <td data-label="In">
                    <span>{log.timeIn}</span>
                    <small className={log.isOutOfBounds ? 'text-danger' : 'text-success'}>
                      {log.isOutOfBounds ? 'Remote' : 'On-site'}
                    </small>
                  </td>
                  <td data-label="Out">{log.timeOut || '-'}</td>
                  <td data-label="Status">
                    <span className={`status-tag ${log.status === 'Late' ? 'late' : 'on-time'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td data-label="Action">
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-button danger-text"
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">No records yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default AdminDashboard;
