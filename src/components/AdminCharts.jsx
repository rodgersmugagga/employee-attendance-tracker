import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const AdminCharts = ({ logs, stats }) => {
  const trendData = logs.length > 0
    ? logs.slice(0, 7).reverse().map((log) => ({
      name: log.date || 'N/A',
      status: log.status === 'On Time' ? 1 : 0,
    }))
    : [];
  const statusData = [
    ...(stats.onTime > 0 ? [{ name: 'On Time', value: stats.onTime, color: '#44ff44' }] : []),
    ...(stats.late > 0 ? [{ name: 'Late', value: stats.late, color: '#ff4444' }] : []),
  ];
  const pieData = statusData.length > 0
    ? statusData
    : [{ name: 'No logs', value: 1, color: '#667085' }];

  return (
    <div className="chart-grid">
      <section className="glass-card chart-card">
        <h3>Attendance Trends</h3>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={trendData}>
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
      </section>

      <section className="glass-card chart-card">
        <h3>Status Distribution</h3>
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'white' }} />
          </PieChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
};

export default AdminCharts;
