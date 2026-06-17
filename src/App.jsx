import { useState, Suspense, lazy } from 'react';
import Login from './components/Login';
import { getStoredUser, clearStoredUser } from './utils/storage';

// Lazy-load heavy pages so the initial JS bundle stays small
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

const getInitialTheme = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'theme-morning';
  if (hour >= 11 && hour < 17) return 'theme-day';
  return 'theme-evening';
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [theme] = useState(getInitialTheme);

  const handleLoginSuccess = (user) => setCurrentUser(user);
  const handleLogout = () => { clearStoredUser(); setCurrentUser(null); };

  return (
    <div className={`App ${theme}`} style={{ minHeight: '100vh' }}>
      <Suspense fallback={
        <div className="screen-loader">
          <div className="spinner" />
        </div>
      }>
        {!currentUser ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : currentUser.role === 'admin' ? (
          <AdminDashboard user={currentUser} onLogout={handleLogout} />
        ) : (
          <Dashboard user={currentUser} onLogout={handleLogout} />
        )}
      </Suspense>
    </div>
  );
}

export default App;
