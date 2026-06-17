import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAllLogs,
  deleteLog,
  registerEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
  exportLogs,
  getMemos,
  createMemo,
  updateMemo,
  deleteMemo,
  BLUE_OX_EMAIL_DOMAIN,
  getBlueOxEmailName,
  getPublicAssetUrl,
} from '../utils/storage';

const AdminCharts = lazy(() => import('./AdminCharts'));

const emptyEmployee = { name: '', email: '', password: '', role: 'employee', photo: null };
const emptyFilters = {
  search: '',
  employeeId: 'all',
  status: 'all',
  date: '',
};

const getInputDateLabel = (dateValue) => new Date(`${dateValue}T00:00:00`).toLocaleDateString();

const locationLabels = {
  onsite: 'On-site',
  remote: 'Remote',
  low_accuracy: 'Low accuracy',
  unknown: 'Unknown',
};

const formatMeters = (value) => {
  if (!Number.isFinite(value)) return '-';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
};

const getLocationClass = (status) => status === 'onsite' ? 'text-success' : 'text-danger';

const AdminDashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(emptyEmployee);
  const [employeeActionLoading, setEmployeeActionLoading] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [editingMemoContent, setEditingMemoContent] = useState('');
  const [memoActionLoading, setMemoActionLoading] = useState('');
  const [memoError, setMemoError] = useState('');

  const stats = useMemo(() => logs.reduce((totals, log) => {
    if (log.status === 'Late') totals.late += 1;
    if (log.status === 'On Time') totals.onTime += 1;
    return totals;
  }, { total: logs.length, late: 0, onTime: 0 }), [logs]);

  const filteredLogs = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch = !search ||
        log.userName?.toLowerCase().includes(search) ||
        log.date?.toLowerCase().includes(search) ||
        log.status?.toLowerCase().includes(search);
      const matchesEmployee = filters.employeeId === 'all' || log.userId === filters.employeeId;
      const matchesStatus = filters.status === 'all' || log.status === filters.status;
      const matchesDate = !filters.date || log.date === getInputDateLabel(filters.date);

      return matchesSearch && matchesEmployee && matchesStatus && matchesDate;
    });
  }, [filters, logs]);

  const todayStats = useMemo(() => {
    const today = new Date().toLocaleDateString();
    const employeeCount = employees.filter((employee) => employee.role === 'employee').length;
    const todayLogs = logs.filter((log) => log.date === today);
    const presentIds = new Set(todayLogs.map((log) => log.userId));

    return {
      present: presentIds.size,
      absent: Math.max(employeeCount - presentIds.size, 0),
      late: todayLogs.filter((log) => log.status === 'Late').length,
      remote: todayLogs.filter((log) => log.isOutOfBounds).length,
    };
  }, [employees, logs]);

  const loadAdminData = useCallback(() => Promise.all([
    getAllLogs({ includePhotos }),
    getEmployees(),
    getMemos(),
  ]), [includePhotos]);

  const applyAdminData = useCallback((allLogs, allEmployees, allMemos) => {
    setLogs(allLogs);
    setEmployees(allEmployees);
    setMemos(allMemos);
  }, []);

  const refreshAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [allLogs, allEmployees, allMemos] = await loadAdminData();
      applyAdminData(allLogs, allEmployees, allMemos);
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
        const [allLogs, allEmployees, allMemos] = await loadAdminData();
        if (!cancelled) applyAdminData(allLogs, allEmployees, allMemos);
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
      await refreshAdmin();
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

  const startEditingEmployee = (employee) => {
    setEditingEmployeeId(employee.id);
    setEditingEmployee({
      name: employee.name,
      email: getBlueOxEmailName(employee.email),
      password: '',
      role: employee.role,
      photo: null,
    });
    setEmployeeError('');
  };

  const cancelEditingEmployee = () => {
    setEditingEmployeeId(null);
    setEditingEmployee(emptyEmployee);
  };

  const handleUpdateEmployee = async (event) => {
    event.preventDefault();
    if (!editingEmployeeId) return;

    setEmployeeActionLoading(editingEmployeeId);
    setEmployeeError('');
    try {
      await updateEmployee(editingEmployeeId, editingEmployee);
      await refreshAdmin();
      cancelEditingEmployee();
    } catch (err) {
      setEmployeeError(err.message);
    } finally {
      setEmployeeActionLoading('');
    }
  };

  const handleDeleteEmployee = async (employee) => {
    if (employee.id === user.id) {
      setEmployeeError('You cannot delete the account you are currently using.');
      return;
    }

    const shouldDelete = window.confirm(`Delete ${employee.name} and their attendance records?`);
    if (!shouldDelete) return;

    setEmployeeActionLoading(employee.id);
    setEmployeeError('');
    try {
      await deleteEmployee(employee.id);
      await refreshAdmin();
      if (editingEmployeeId === employee.id) cancelEditingEmployee();
    } catch (err) {
      setEmployeeError(err.message);
    } finally {
      setEmployeeActionLoading('');
    }
  };

  const updateFilter = (key, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  };

  const handleCreateMemo = async (event) => {
    event.preventDefault();
    const content = newMemo.trim();
    if (!content) return;

    setMemoLoading(true);
    setMemoError('');
    try {
      await createMemo({ content, author: user.name });
      setNewMemo('');
      setMemos(await getMemos());
    } catch (err) {
      setMemoError(err.message);
      console.error('Failed to create memo', err);
    } finally {
      setMemoLoading(false);
    }
  };

  const startEditingMemo = (memo) => {
    setEditingMemoId(memo.id);
    setEditingMemoContent(memo.content);
    setMemoError('');
  };

  const cancelEditingMemo = () => {
    setEditingMemoId(null);
    setEditingMemoContent('');
  };

  const handleUpdateMemo = async (event) => {
    event.preventDefault();
    const content = editingMemoContent.trim();
    if (!content || !editingMemoId) return;

    setMemoActionLoading(editingMemoId);
    setMemoError('');
    try {
      await updateMemo(editingMemoId, { content });
      setMemos(await getMemos());
      cancelEditingMemo();
    } catch (err) {
      setMemoError(err.message);
      console.error('Failed to update memo', err);
    } finally {
      setMemoActionLoading('');
    }
  };

  const handleDeleteMemo = async (memo) => {
    const shouldDelete = window.confirm('Delete this announcement?');
    if (!shouldDelete) return;

    setMemoActionLoading(memo.id);
    setMemoError('');
    try {
      await deleteMemo(memo.id);
      setMemos((currentMemos) => currentMemos.filter((item) => item.id !== memo.id));
      if (editingMemoId === memo.id) cancelEditingMemo();
    } catch (err) {
      setMemoError(err.message);
      console.error('Failed to delete memo', err);
    } finally {
      setMemoActionLoading('');
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
    <main className="container page-shell admin-dashboard animate-fade-in">
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
              <div className="input-with-suffix">
                <input
                  type="text"
                  className="input-field"
                  value={newEmployee.email}
                  onChange={(event) => setNewEmployee({ ...newEmployee, email: getBlueOxEmailName(event.target.value) })}
                  placeholder="firstname"
                  autoCapitalize="none"
                  pattern="[A-Za-z0-9._%+\\-]+"
                  title={`Enter only the part before ${BLUE_OX_EMAIL_DOMAIN}`}
                  required
                />
                <span>{BLUE_OX_EMAIL_DOMAIN}</span>
              </div>
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
            <div className="form-field">
              <label>Role</label>
              <select
                className="input-field"
                value={newEmployee.role}
                onChange={(event) => setNewEmployee({ ...newEmployee, role: event.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-field">
              <label>Employee Photo</label>
              <input
                type="file"
                className="input-field file-input"
                accept="image/*"
                onChange={(event) => setNewEmployee({ ...newEmployee, photo: event.target.files?.[0] ?? null })}
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
          <p>Present Today</p>
          <strong className="text-success">{todayStats.present}</strong>
        </article>
        <article className="glass-card stat-card">
          <p>Absent Today</p>
          <strong>{todayStats.absent}</strong>
        </article>
        <article className="glass-card stat-card">
          <p>Late Today</p>
          <strong className="text-danger">{todayStats.late}</strong>
        </article>
        <article className="glass-card stat-card">
          <p>Remote Today</p>
          <strong>{todayStats.remote}</strong>
        </article>
      </section>

      <section className="glass-card table-card employee-card">
        <div className="section-title-row">
          <div>
            <h3>Employee Management</h3>
            <p>{employees.length} registered users</p>
          </div>
        </div>
        {employeeError && <p className="form-error compact-error">{employeeError}</p>}
        <div className="table-wrap">
          <table className="responsive-table employee-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Email</th>
                <th>Role</th>
                <th>Face ID</th>
                <th>Logs</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  {editingEmployeeId === employee.id ? (
                    <>
                      <td data-label="Employee">
                        <input
                          className="input-field table-input"
                          value={editingEmployee.name}
                          onChange={(event) => setEditingEmployee({ ...editingEmployee, name: event.target.value })}
                          required
                        />
                      </td>
                      <td data-label="Email">
                        <div className="input-with-suffix table-input-with-suffix">
                          <input
                            className="input-field table-input"
                            type="text"
                            value={editingEmployee.email}
                            onChange={(event) => setEditingEmployee({ ...editingEmployee, email: getBlueOxEmailName(event.target.value) })}
                            autoCapitalize="none"
                            pattern="[A-Za-z0-9._%+\\-]+"
                            title={`Enter only the part before ${BLUE_OX_EMAIL_DOMAIN}`}
                            required
                          />
                          <span>{BLUE_OX_EMAIL_DOMAIN}</span>
                        </div>
                        <input
                          className="input-field table-input"
                          type="password"
                          placeholder="New password"
                          value={editingEmployee.password}
                          onChange={(event) => setEditingEmployee({ ...editingEmployee, password: event.target.value })}
                        />
                      </td>
                      <td data-label="Role">
                        <select
                          className="input-field table-input"
                          value={editingEmployee.role}
                          onChange={(event) => setEditingEmployee({ ...editingEmployee, role: event.target.value })}
                        >
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                        </select>
                        <input
                          className="input-field table-input file-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) => setEditingEmployee({ ...editingEmployee, photo: event.target.files?.[0] ?? null })}
                        />
                      </td>
                      <td data-label="Face ID">
                        <span className={`status-tag ${employee.faceEnrolled ? 'on-time' : 'late'}`}>
                          {employee.faceEnrolled ? 'Enrolled' : 'Missing'}
                        </span>
                      </td>
                      <td data-label="Logs">{employee._count?.logs ?? 0}</td>
                      <td data-label="Action">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={handleUpdateEmployee}
                            disabled={employeeActionLoading === employee.id}
                          >
                            {employeeActionLoading === employee.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="text-button danger-text"
                            onClick={cancelEditingEmployee}
                            disabled={employeeActionLoading === employee.id}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td data-label="Employee" className="strong-cell">
                        <div className="employee-name-cell">
                          {employee.photoUrl && (
                            <img src={getPublicAssetUrl(employee.photoUrl)} loading="lazy" alt={employee.name} className="employee-thumb" />
                          )}
                          <span>{employee.name}</span>
                        </div>
                      </td>
                      <td data-label="Email">{employee.email}</td>
                      <td data-label="Role">
                        <span className="status-tag neutral">{employee.role}</span>
                      </td>
                      <td data-label="Face ID">
                        <span className={`status-tag ${employee.faceEnrolled ? 'on-time' : 'late'}`}>
                          {employee.faceEnrolled ? 'Enrolled' : 'Missing'}
                        </span>
                      </td>
                      <td data-label="Logs">{employee._count?.logs ?? 0}</td>
                      <td data-label="Action">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => startEditingEmployee(employee)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button danger-text"
                            onClick={() => handleDeleteEmployee(employee)}
                            disabled={employeeActionLoading === employee.id}
                          >
                            {employeeActionLoading === employee.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">No employees registered</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        <section className="glass-card memo-compose-card">
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
          {memoError && <p className="form-error compact-error">{memoError}</p>}
          <div className="memo-list">
            {memos.map((memo) => (
              <article key={memo.id} className="memo-card">
                {editingMemoId === memo.id ? (
                  <form onSubmit={handleUpdateMemo} className="memo-edit-form">
                    <textarea
                      className="input-field compact-textarea"
                      value={editingMemoContent}
                      onChange={(event) => setEditingMemoContent(event.target.value)}
                      autoFocus
                    />
                    <div className="memo-actions">
                      <button
                        type="submit"
                        className="btn-primary compact-button"
                        disabled={memoActionLoading === memo.id}
                      >
                        {memoActionLoading === memo.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost compact-button"
                        onClick={cancelEditingMemo}
                        disabled={memoActionLoading === memo.id}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p>{memo.content}</p>
                    <div className="memo-meta-row">
                      <small>{memo.author}</small>
                      <div className="memo-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => startEditingMemo(memo)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-button danger-text"
                          onClick={() => handleDeleteMemo(memo)}
                          disabled={memoActionLoading === memo.id}
                        >
                          {memoActionLoading === memo.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            ))}
            {memos.length === 0 && <p className="empty-state">No active notices</p>}
          </div>
        </section>
      </div>

      <section className="glass-card table-card records-card">
        <div className="section-title-row">
          <div>
            <h3>Employee Attendance Records</h3>
            <p>Showing {filteredLogs.length} of {logs.length} attendance entries</p>
          </div>
          <div className="section-actions">
            <button
              type="button"
              className="btn-ghost compact-button"
              onClick={() => setIncludePhotos((value) => !value)}
            >
              {includePhotos ? 'Hide Photos' : 'Load Photos'}
            </button>
            <button
              type="button"
              className="btn-ghost compact-button"
              onClick={() => setFilters(emptyFilters)}
            >
              Reset Filters
            </button>
          </div>
        </div>
        <div className="filter-grid">
          <input
            className="input-field"
            type="search"
            placeholder="Search name, date, or status"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
          <select
            className="input-field"
            value={filters.employeeId}
            onChange={(event) => updateFilter('employeeId', event.target.value)}
          >
            <option value="all">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="all">All status</option>
            <option value="On Time">On time</option>
            <option value="Late">Late</option>
          </select>
          <input
            className="input-field"
            type="date"
            value={filters.date}
            onChange={(event) => updateFilter('date', event.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="responsive-table admin-records-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Attendance</th>
                <th>Location</th>
                <th>Photos</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Employee" className="strong-cell">{log.userName}</td>
                  <td data-label="Date">{log.date}</td>
                  <td data-label="Attendance">
                    <span>{log.timeIn}</span>
                    <small>Out: {log.timeOut || '-'}</small>
                  </td>
                  <td data-label="Location">
                    <span className={getLocationClass(log.locationStatus)}>
                      {locationLabels[log.locationStatus] || (log.isOutOfBounds ? 'Remote' : 'On-site')}
                    </span>
                    <small>
                      In: {formatMeters(log.distanceFromOffice)} away, {formatMeters(log.locationAccuracy)} accuracy
                    </small>
                    {log.outLocationStatus && (
                      <small>
                        Out: {locationLabels[log.outLocationStatus] || log.outLocationStatus}, {formatMeters(log.outDistanceFromOffice)} away
                      </small>
                    )}
                  </td>
                  <td data-label="Photos">
                    {includePhotos ? (
                      <div className="photo-pair">
                        {log.photo ? (
                          <img src={log.photo} loading="lazy" alt="Punch in" className="log-photo in" />
                        ) : (
                          <span className="photo-placeholder" />
                        )}
                        {log.outPhoto ? (
                          <img src={log.outPhoto} loading="lazy" alt="Punch out" className="log-photo out" />
                        ) : (
                          <span className="photo-placeholder" />
                        )}
                      </div>
                    ) : (
                      <span className="muted-text">Hidden</span>
                    )}
                  </td>
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
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-state">No records match these filters</td>
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
