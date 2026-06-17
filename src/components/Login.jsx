import { useState } from 'react';
import { BLUE_OX_EMAIL_DOMAIN, getBlueOxEmailName, loginUser, setStoredUser } from '../utils/storage';

const Login = ({ onLoginSuccess }) => {
  const [emailName, setEmailName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await loginUser(emailName, password);
      setStoredUser(user);
      onLoginSuccess(user);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card animate-fade-in">
        <h1 className="auth-title">Blue Ox</h1>
        <p className="auth-subtitle">Kampus Portal</p>

        <form onSubmit={handleLogin} className="stack-form">
          <div className="form-field">
            <label>Email</label>
            <div className="input-with-suffix">
              <input
                type="text"
                className="input-field"
                value={emailName}
                onChange={(e) => setEmailName(getBlueOxEmailName(e.target.value))}
                placeholder="firstname"
                autoCapitalize="none"
                autoComplete="username"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="form-error centered">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default Login;
