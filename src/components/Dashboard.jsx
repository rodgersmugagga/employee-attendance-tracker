import React, { useState, useEffect } from 'react';
import { getLogs, punchIn, punchOut } from '../utils/storage';

const Dashboard = ({ user, onLogout }) => {
  const [logs, setLogs] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('Out');
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [user.id]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const userLogs = await getLogs(user.id);
      setLogs(userLogs);

      const today = new Date().toLocaleDateString();
      const todayEntry = userLogs.find(log => log.date === today);
      setTodayLog(todayEntry);
      if (todayEntry && !todayEntry.timeOut) {
        setCurrentStatus('In');
      } else {
        setCurrentStatus('Out');
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = async () => {
    const now = new Date();
    const timeIn = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString();

    const nineAM = new Date();
    nineAM.setHours(9, 0, 0, 0);
    const isLate = now > nineAM;

    try {
      const newLog = await punchIn({
        userId: user.id,
        userName: user.name,
        date,
        timeIn,
        status: isLate ? 'Late' : 'On Time'
      });

      setTodayLog(newLog);
      setCurrentStatus('In');
      fetchLogs();
    } catch (err) {
      console.error('Failed to punch in', err);
    }
  };

  const handlePunchOut = async () => {
    const now = new Date();
    const timeOut = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      await punchOut(todayLog.id, timeOut);
      setCurrentStatus('Out');
      fetchLogs();
    } catch (err) {
      console.error('Failed to punch out', err);
    }
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem' }}>Welcome, {user.name}</h2>
          <p style={{ color: 'var(--text-muted)' }}>Blue Ox Kampus Employee</p>
        </div>
        <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Attendance</h3>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Current Status</p>
            <div style={{
              display: 'inline-block',
              padding: '0.5rem 1.5rem',
              borderRadius: '20px',
              background: currentStatus === 'In' ? 'hsla(140, 70%, 50%, 0.2)' : 'hsla(0, 0%, 100%, 0.1)',
              color: currentStatus === 'In' ? '#44ff44' : 'var(--text-muted)',
              fontWeight: '600'
            }}>
              {currentStatus === 'In' ? 'Checked In' : 'Checked Out'}
            </div>
          </div>

          {currentStatus === 'Out' ? (
            <button className="btn-primary" style={{ width: '100%' }} onClick={handlePunchIn} disabled={todayLog && todayLog.timeOut}>
              {todayLog && todayLog.timeOut ? 'Worked Today' : 'Punch In'}
            </button>
          ) : (
            <button className="btn-primary" style={{ width: '100%', background: '#ff4444' }} onClick={handlePunchOut}>
              Punch Out
            </button>
          )}

          {todayLog && (
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Arrival: <strong>{todayLog.timeIn}</strong></p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: <strong style={{ color: todayLog.status === 'Late' ? '#ff4444' : '#44ff44' }}>{todayLog.status}</strong></p>
              {todayLog.timeOut && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Departure: <strong>{todayLog.timeOut}</strong></p>}
            </div>
          )}
        </div>

        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem' }}>Recent Activity</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Time In</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Time Out</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '1rem' }}>{log.date}</td>
                    <td style={{ padding: '1rem' }}>{log.timeIn}</td>
                    <td style={{ padding: '1rem' }}>{log.timeOut || '-'}</td>
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
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
