import { useEffect, useState } from 'react';
import { apiRequest } from './api';

const emptySignal = {
  title: '',
  type: 'failed_test',
  severity: 'medium',
  description: '',
};

function AuthScreen({ onAuth }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const result = await apiRequest(`/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      localStorage.setItem('devpulse_token', result.data.token);
      onAuth(result.data.user);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">DEVPULSE AI</div>
        <h1>Engineering risk, made visible.</h1>
        <p className="muted">Track signals, verify fixes, and understand the evidence behind every score.</p>
        <form onSubmit={submit}>
          {registering && (
            <label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          )}
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">{registering ? 'Create account' : 'Sign in'}</button>
        </form>
        <button className="link-button" onClick={() => { setRegistering(!registering); setError(''); }}>
          {registering ? 'Already have an account? Sign in' : 'New to DevPulse? Create an account'}
        </button>
      </section>
    </main>
  );
}

function Dashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [signals, setSignals] = useState([]);
  const [risk, setRisk] = useState(null);
  const [history, setHistory] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [signal, setSignal] = useState(emptySignal);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    const result = await apiRequest('/projects');
    setProjects(result.data || []);
  };

  const loadProject = async (id) => {
    const [projectResult, signalResult, historyResult] = await Promise.all([
      apiRequest(`/projects/${id}`),
      apiRequest(`/projects/${id}/signals`),
      apiRequest(`/projects/${id}/risk-history`),
    ]);
    setSelected(projectResult.data);
    setRisk(projectResult.risk);
    setSignals(signalResult.data || []);
    setHistory(historyResult.data || []);
  };

  useEffect(() => {
    loadProjects().catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const createProject = async (event) => {
    event.preventDefault();
    try {
      const result = await apiRequest('/projects', { method: 'POST', body: JSON.stringify({ name: projectName }) });
      setProjectName('');
      await loadProjects();
      await loadProject(result.data._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const createSignal = async (event) => {
    event.preventDefault();
    try {
      await apiRequest(`/projects/${selected._id}/signals`, {
        method: 'POST',
        body: JSON.stringify({ ...signal, status: 'open' }),
      });
      setSignal(emptySignal);
      await loadProject(selected._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateStatus = async (item, status) => {
    const evidence = status === 'verified' ? window.prompt('Enter verification evidence') : undefined;
    if (status === 'verified' && !evidence?.trim()) return;
    try {
      await apiRequest(`/signals/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(evidence ? { verificationEvidence: evidence } : {}) }),
      });
      await loadProject(selected._id);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <main className="page"><p>Loading your workspace...</p></main>;

  return (
    <main className="page">
      <header className="topbar">
        <div><div className="eyebrow">DEVPULSE AI</div><strong>Engineering Risk Intelligence</strong></div>
        <div className="top-actions"><span className="muted">{user.name}</span><button className="secondary" onClick={onLogout}>Log out</button></div>
      </header>
      {error && <div className="alert error">{error}<button onClick={() => setError('')}>x</button></div>}
      <div className="layout">
        <aside className="sidebar">
          <div className="section-heading"><h2>Projects</h2><span className="count">{projects.length}</span></div>
          {projects.length === 0 && <p className="muted small">Create your first project to start tracking risk.</p>}
          {projects.map((project) => (
            <button className={`project-item ${selected?._id === project._id ? 'active' : ''}`} key={project._id} onClick={() => loadProject(project._id)}>
              {project.name}<span>{project.description || 'No description'}</span>
            </button>
          ))}
          <form className="create-form" onSubmit={createProject}>
            <input required placeholder="New project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            <button className="primary" type="submit">+ Create project</button>
          </form>
        </aside>
        <section className="content">
          {!selected ? <div className="empty-state"><span className="empty-icon">◈</span><h1>Select a project</h1><p>Choose a project or create one to see its engineering risk profile.</p></div> : (
            <>
              <div className="content-heading"><div><div className="eyebrow">PROJECT OVERVIEW</div><h1>{selected.name}</h1></div></div>
              {risk && <div className="score-card"><div><span className="eyebrow">HEALTH SCORE</span><strong className="health">{risk.healthScore}</strong><span className="score-unit">/100</span></div><div className="score-divider" /><div><span className="eyebrow">RISK</span><strong>{risk.riskScore}</strong><span className={`pill ${risk.riskLevel}`}>{risk.riskLevel}</span></div><div className="score-divider" /><div><span className="eyebrow">OPEN SIGNALS</span><strong>{risk.statusCounts?.open || 0}</strong><span className="muted">{risk.signalCount} total</span></div></div>}
              <div className="dashboard-grid">
                <section className="panel"><div className="panel-heading"><h2>Signal evidence</h2><span className="count">{signals.length}</span></div>{signals.length === 0 ? <p className="muted">No signals recorded yet.</p> : signals.map((item) => <article className="signal" key={item._id}><div><div className="signal-title"><span className={`dot ${item.severity}`} />{item.title}</div><div className="tags"><span>{item.type.replace('_', ' ')}</span><span>{item.severity}</span><span className={`pill ${item.status}`}>{item.status.replace('_', ' ')}</span></div></div><select value={item.status} onChange={(event) => updateStatus(item, event.target.value)} aria-label={`Update status for ${item.title}`}><option value={item.status}>{item.status.replace('_', ' ')}</option><option value="in_progress">in progress</option><option value="fixed_unverified">fixed unverified</option><option value="verified">verified</option><option value="reopened">reopened</option></select></article>)}</section>
                <aside><section className="panel"><h2>Record a signal</h2><form onSubmit={createSignal}><label>Title<input required value={signal.title} onChange={(event) => setSignal({ ...signal, title: event.target.value })} /></label><label>Type<select value={signal.type} onChange={(event) => setSignal({ ...signal, type: event.target.value })}><option value="failed_test">Failed test</option><option value="bug">Bug</option><option value="dependency_alert">Dependency alert</option></select></label><label>Severity<select value={signal.severity} onChange={(event) => setSignal({ ...signal, severity: event.target.value })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><button className="primary" type="submit">Add signal</button></form></section><section className="panel"><h2>Risk history</h2>{history.length === 0 ? <p className="muted">Snapshots appear after signal changes.</p> : history.slice(0, 8).map((snapshot) => <div className="trend-row" key={snapshot._id}><span>{new Date(snapshot.createdAt).toLocaleDateString()}</span><div className="bar"><i style={{ width: `${snapshot.riskScore}%` }} /></div><strong>{snapshot.riskScore}</strong></div>)}</section></aside>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('devpulse_token');
      if (!token) {
        setRestoringSession(false);
        return;
      }
      try {
        await apiRequest('/projects');
        const savedUser = JSON.parse(localStorage.getItem('devpulse_user') || 'null');
        setUser(savedUser);
      } catch {
        localStorage.removeItem('devpulse_token');
        localStorage.removeItem('devpulse_user');
      } finally {
        setRestoringSession(false);
      }
    };
    restore();
  }, []);

  const onAuth = (nextUser) => {
    localStorage.setItem('devpulse_user', JSON.stringify(nextUser));
    setUser(nextUser);
  };
  const onLogout = () => {
    localStorage.removeItem('devpulse_token');
    localStorage.removeItem('devpulse_user');
    setUser(null);
  };

  if (restoringSession) return <main className="page"><p>Restoring session...</p></main>;
  return user ? <Dashboard user={user} onLogout={onLogout} /> : <AuthScreen onAuth={onAuth} />;
}
