import React, { useState, useEffect } from 'react';
import { getAllLogs, deleteLog, registerEmployee, exportLogs, getMemos, createMemo } from '../utils/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdminDashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, late: 0, onTime: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const allLogs = await getAllLogs();
      const allMemos = await getMemos();
      setLogs(allLogs);
      setMemos(allMemos);

      const late = allLogs.filter(l => l.status === 'Late').length;
      const onTime = allLogs.filter(l => l.status === 'On Time').length;
      setStats({ total: allLogs.length, late, onTime });
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    exportLogs();
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      await registerEmployee(newEmployee);
      setNewEmployee({ name: '', email: '', password: '', role: 'employee' });
      setShowAddForm(false);
      alert('Employee added successfully!');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      await deleteLog(id);
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}>Manager Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Blue Ox Kampus Administration</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
          <button
            onClick={handleExport}
            className="btn-primary"
            style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            Export Logs
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          >
            {showAddForm ? 'Cancel' : 'Add Employee'}
          </button>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      {showAddForm && (
        <div className="glass-card animate-fade-in" style={{ marginBottom: '2.5rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Register New Employee</h3>
          <form onSubmit={handleAddEmployee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Full Name</label>
              <input
                type="text"
                className="input-field"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                className="input-field"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Password</label>
              <input
                type="password"
                className="input-field"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%', height: '42px' }} disabled={addLoading}>
                {addLoading ? 'Adding...' : 'Register User'}
              </button>
            </div>
          </form>
          {addError && <p style={{ color: '#ff4444', marginTop: '1rem', fontSize: '0.85rem' }}>{addError}</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'clamp(0.5rem, 2vw, 1.5rem)', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Logs</p>
          <h3 style={{ fontSize: '2rem', color: 'var(--primary)' }}>{stats.total}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>On Time</p>
          <h3 style={{ fontSize: '2rem', color: '#44ff44' }}>{stats.onTime}</h3>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Late Arrivals</p>
          <h3 style={{ fontSize: '2rem', color: '#ff4444' }}>{stats.late}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-card" style={{ height: '400px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Attendance Trends</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={logs.length > 0 ? logs.slice(0, 7).reverse().map(l => ({ name: l.date || 'N/A', status: l.status === 'On Time' ? 1 : 0 })) : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'white' }}
                itemStyle={{ color: 'var(--primary)' }}
              />
              <Line type="monotone" dataKey="status" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ height: '400px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Status Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={[
                  { name: 'On Time', value: stats.onTime },
                  { name: 'Late', value: stats.late }
                ]}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell fill="#44ff44" />
                <Cell fill="#ff4444" />
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'white' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Post New Announcement</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!newMemo) return;
            setMemoLoading(true);
            try {
              await createMemo({ content: newMemo, author: user.name });
              setNewMemo('');
              const updated = await getMemos();
              setMemos(updated);
            } catch (err) {
              console.error(err);
            } finally {
              setMemoLoading(false);
            }
          }}>
            <textarea
              className="input-field"
              placeholder="Type company announcement here..."
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              style={{ minHeight: '100px', marginBottom: '1rem', resize: 'vertical' }}
            />
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={memoLoading}>
              Post Memo
            </button>
          </form>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Active Notices</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {memos.map(memo => (
              <div key={memo.id} className="memo-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <p style={{ fontSize: '0.9rem', flex: 1 }}>{memo.content}</p>
                {/* Delete button logic here */}
              </div>
            ))}
            {memos.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No active notices</p>}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: '1.5rem' }}>Employee Attendance Records</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Entry</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Exit</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Employee</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>In</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Out</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '1rem' }}>
                    {log.photo ? (
                      <img src={log.photo} loading="lazy" alt="In" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--primary)' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'hsla(0,0%,100%,0.05)' }}></div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {log.outPhoto ? (
                      <img src={log.outPhoto} loading="lazy" alt="Out" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #ff4444' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'hsla(0,0%,100%,0.05)' }}></div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{log.userName}</td>
                  <td style={{ padding: '1rem' }}>{log.date}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    {log.timeIn}
                    <br />
                    <span style={{ color: log.isOutOfBounds ? '#ff4444' : '#44ff44', fontSize: '0.7rem' }}>
                      {log.isOutOfBounds ? '🚩 Remote' : '📍 On-Site'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    {log.timeOut || '-'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      color: log.status === 'Late' ? '#ff4444' : '#44ff44',
                      background: log.status === 'Late' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(68, 255, 68, 0.1)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
