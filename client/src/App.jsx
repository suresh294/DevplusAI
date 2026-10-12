import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';

const emptySignal = { title: '', type: 'failed_test', severity: 'medium', description: '' };
const statuses = ['open', 'in_progress', 'fixed_unverified', 'verified', 'reopened'];

function AuthScreen({ onAuth }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await apiRequest(`/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST', body: JSON.stringify(form),
      });
      localStorage.setItem('devpulse_token', result.data.token);
      onAuth(result.data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-shell"><section className="auth-card">
    <div className="eyebrow">DEVPULSE AI</div>
    <h1>Engineering risk, made visible.</h1>
    <p className="muted">Track signals, verify fixes, and understand the evidence behind every score.</p>
    <form onSubmit={submit}>
      {registering && <label htmlFor="auth-name">Name<input id="auth-name" name="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
      <label htmlFor="auth-email">Email<input id="auth-email" name="email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label htmlFor="auth-password">Password<input id="auth-password" name="password" required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={submitting} type="submit">{submitting ? 'Working...' : registering ? 'Create account' : 'Sign in'}</button>
    </form>
    <button className="link-button" type="button" onClick={() => { setRegistering(!registering); setError(''); }}>
      {registering ? 'Already have an account? Sign in' : 'New to DevPulse? Create an account'}
    </button>
  </section></main>;
}

function Dashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [signals, setSignals] = useState([]);
  const [risk, setRisk] = useState(null);
  const [history, setHistory] = useState([]);
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [signal, setSignal] = useState(emptySignal);
  const [filters, setFilters] = useState({ severity: 'all', status: 'all', type: 'all', sort: 'newest' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(false);
  const [saving, setSaving] = useState('');

  const loadProjects = async () => {
    const result = await apiRequest('/projects');
    setProjects(result.data || []);
    return result.data || [];
  };

  const loadProject = async (id) => {
    setProjectLoading(true);
    setError('');
    try {
      const [projectResult, signalResult, historyResult] = await Promise.all([
        apiRequest(`/projects/${id}`), apiRequest(`/projects/${id}/signals`), apiRequest(`/projects/${id}/risk-history`),
      ]);
      setSelected(projectResult.data);
      setProjectForm({ name: projectResult.data.name || '', description: projectResult.data.description || '' });
      setRisk(signalResult.risk || projectResult.risk);
      setSignals(signalResult.data || []);
      setHistory(historyResult.data || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProjectLoading(false);
    }
  };

  useEffect(() => { loadProjects().catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); }, []);

  const runMutation = async (key, action) => {
    setSaving(key);
    setError('');
    try { await action(); } catch (requestError) { setError(requestError.message); } finally { setSaving(''); }
  };

  const createProject = (event) => {
    event.preventDefault();
    if (!projectForm.name.trim()) { setError('A project name is required'); return; }
    runMutation('project-create', async () => {
      const result = await apiRequest('/projects', { method: 'POST', body: JSON.stringify(projectForm) });
      setProjectForm({ name: '', description: '' });
      await loadProjects();
      await loadProject(result.data._id);
    });
  };

  const saveProject = (event) => {
    event.preventDefault();
    if (!selected || !projectForm.name.trim()) { setError('A project name is required'); return; }
    runMutation('project-save', async () => {
      await apiRequest(`/projects/${selected._id}`, { method: 'PATCH', body: JSON.stringify(projectForm) });
      await loadProjects();
      await loadProject(selected._id);
    });
  };

  const deleteProject = () => {
    if (!selected || !window.confirm(`Delete "${selected.name}" and its signals?`)) return;
    runMutation('project-delete', async () => {
      await apiRequest(`/projects/${selected._id}`, { method: 'DELETE' });
      setSelected(null); setSignals([]); setRisk(null); setHistory([]);
      await loadProjects();
    });
  };

  const createSignal = (event) => {
    event.preventDefault();
    if (!selected || !signal.title.trim()) { setError('A signal title is required'); return; }
    runMutation('signal-create', async () => {
      await apiRequest(`/projects/${selected._id}/signals`, { method: 'POST', body: JSON.stringify({ ...signal, status: 'open' }) });
      setSignal(emptySignal);
      await loadProject(selected._id);
    });
  };

  const updateSignal = (item, status) => {
    let evidence;
    if (status === 'verified') {
      evidence = window.prompt('Enter verification evidence', item.verificationEvidence || '');
      if (!evidence?.trim()) { setError('Verification evidence is required'); return; }
    }
    runMutation(`signal-${item._id}`, async () => {
      await apiRequest(`/signals/${item._id}`, {
        method: 'PATCH', body: JSON.stringify({ status, ...(evidence !== undefined ? { verificationEvidence: evidence } : {}) }),
      });
      await loadProject(selected._id);
    });
  };

  const visibleSignals = useMemo(() => signals
    .filter((item) => filters.severity === 'all' || item.severity === filters.severity)
    .filter((item) => filters.status === 'all' || item.status === filters.status)
    .filter((item) => filters.type === 'all' || item.type === filters.type)
    .sort((a, b) => filters.sort === 'oldest'
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt)), [signals, filters]);

  if (loading) return <main className="page"><p className="loading-message">Loading your workspace...</p></main>;
  return <main className="page">
    <header className="topbar"><div><div className="eyebrow">DEVPULSE AI</div><strong>Engineering Risk Intelligence</strong></div>
      <div className="top-actions"><span className="muted">{user.name}</span><button className="secondary" type="button" onClick={onLogout}>Log out</button></div></header>
    {error && <div className="alert error" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError('')}>x</button></div>}
    <div className="layout"><aside className="sidebar">
      <div className="section-heading"><h2>Projects</h2><span className="count">{projects.length}</span></div>
      {projects.length === 0 && <p className="muted small">Create your first project to start tracking risk.</p>}
      {projects.map((project) => <button className={`project-item ${selected?._id === project._id ? 'active' : ''}`} type="button" key={project._id} disabled={projectLoading} onClick={() => loadProject(project._id)}>{project.name}<span>{project.description || 'No description'}</span></button>)}
      <form className="create-form" onSubmit={createProject}><label htmlFor="new-project-name">New project<input id="new-project-name" name="projectName" required placeholder="Project name" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} /></label><button className="primary" disabled={saving !== ''} type="submit">{saving === 'project-create' ? 'Creating...' : '+ Create project'}</button></form>
    </aside><section className="content">
      {!selected ? <div className="empty-state"><span className="empty-icon">◈</span><h1>Select a project</h1><p>Choose a project or create one to see its engineering risk profile.</p></div> : <>
        {projectLoading ? <p className="loading-message">Loading project data...</p> : <><div className="content-heading"><div><div className="eyebrow">PROJECT OVERVIEW</div><h1>{selected.name}</h1></div><button className="danger-link" type="button" disabled={saving !== ''} onClick={deleteProject}>Delete project</button></div>
        {risk && <div className="score-card"><div><span className="eyebrow">HEALTH SCORE</span><strong className="health">{risk.healthScore}</strong><span className="score-unit">/100</span></div><div className="score-divider" /><div><span className="eyebrow">RISK</span><strong>{risk.riskScore}</strong><span className={`pill ${risk.riskLevel}`}>{risk.riskLevel}</span></div><div className="score-divider" /><div><span className="eyebrow">OPEN SIGNALS</span><strong>{risk.statusCounts?.open || 0}</strong><span className="muted">{risk.signalCount} total</span></div></div>}
        <section className="panel project-editor"><h2>Project details</h2><form onSubmit={saveProject}><label htmlFor="project-name">Name<input id="project-name" name="projectName" required value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} /></label><label htmlFor="project-description">Description<textarea id="project-description" name="description" rows="2" value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></label><button className="secondary" disabled={saving !== ''} type="submit">{saving === 'project-save' ? 'Saving...' : 'Save details'}</button></form></section>
        <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>Signal evidence</h2><span className="count">{visibleSignals.length}/{signals.length}</span></div>
          <div className="filters"><label>Severity<select value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}><option value="all">All severities</option>{['low', 'medium', 'high', 'critical'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value.replace('_', ' ')}</option>)}</select></label><label>Type<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">All types</option>{['failed_test', 'bug', 'dependency_alert'].map((value) => <option key={value}>{value.replace('_', ' ')}</option>)}</select></label><label>Order<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label></div>
          {signals.length === 0 ? <p className="muted">No signals recorded yet.</p> : visibleSignals.length === 0 ? <p className="muted">No signals match the selected filters.</p> : visibleSignals.map((item) => <article className="signal" key={item._id}><div><div className="signal-title"><span className={`dot ${item.severity}`} />{item.title}</div><div className="tags"><span>{item.type.replace('_', ' ')}</span><span>{item.severity}</span><span className={`pill ${item.status}`}>{item.status.replace('_', ' ')}</span></div>{item.description && <p className="muted small">{item.description}</p>}{item.verificationEvidence && <p className="evidence">Evidence: {item.verificationEvidence}</p>}</div><select value={item.status} disabled={saving === `signal-${item._id}`} onChange={(event) => updateSignal(item, event.target.value)} aria-label={`Update status for ${item.title}`}><option value={item.status}>{item.status.replace('_', ' ')}</option>{statuses.filter((value) => value !== item.status).map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></article>)}
        </section><aside><section className="panel"><h2>Record a signal</h2><form onSubmit={createSignal}><label htmlFor="signal-title">Title<input id="signal-title" name="title" required value={signal.title} onChange={(event) => setSignal({ ...signal, title: event.target.value })} /></label><label htmlFor="signal-description">Description<textarea id="signal-description" name="description" rows="2" value={signal.description} onChange={(event) => setSignal({ ...signal, description: event.target.value })} /></label><label htmlFor="signal-type">Type<select id="signal-type" name="type" value={signal.type} onChange={(event) => setSignal({ ...signal, type: event.target.value })}><option value="failed_test">Failed test</option><option value="bug">Bug</option><option value="dependency_alert">Dependency alert</option></select></label><label htmlFor="signal-severity">Severity<select id="signal-severity" name="severity" value={signal.severity} onChange={(event) => setSignal({ ...signal, severity: event.target.value })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><button className="primary" disabled={saving !== ''} type="submit">{saving === 'signal-create' ? 'Adding...' : 'Add signal'}</button></form></section><section className="panel"><h2>Risk history</h2>{history.length === 0 ? <p className="muted">Snapshots appear after signal changes.</p> : history.slice(0, 8).map((snapshot) => <div className="trend-row" key={snapshot._id}><span>{new Date(snapshot.createdAt).toLocaleDateString()}</span><div className="bar"><i style={{ width: `${snapshot.riskScore}%` }} /></div><strong>{snapshot.riskScore}</strong></div>)}</section></aside></div></>}</>}
    </section></div>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('devpulse_token');
      if (!token) { setRestoringSession(false); return; }
      try {
        await apiRequest('/projects');
        const savedUser = JSON.parse(localStorage.getItem('devpulse_user') || 'null');
        if (savedUser) setUser(savedUser); else { localStorage.removeItem('devpulse_token'); setSessionError('Your session profile is missing. Please sign in again.'); }
      } catch (error) {
        if (localStorage.getItem('devpulse_token')) setSessionError(`Could not restore your session: ${error.message}`);
      } finally { setRestoringSession(false); }
    };
    restore();
  }, []);
  const onAuth = (nextUser) => { localStorage.setItem('devpulse_user', JSON.stringify(nextUser)); setUser(nextUser); };
  const onLogout = () => { localStorage.removeItem('devpulse_token'); localStorage.removeItem('devpulse_user'); setUser(null); };
  if (restoringSession) return <main className="page"><p className="loading-message">Restoring session...</p></main>;
  if (sessionError && user === null && localStorage.getItem('devpulse_token')) return <main className="auth-shell"><section className="auth-card"><h1>Unable to restore session</h1><p className="error" role="alert">{sessionError}</p><button className="primary" type="button" onClick={onLogout}>Sign in again</button></section></main>;
  return user ? <Dashboard user={user} onLogout={onLogout} /> : <AuthScreen onAuth={onAuth} />;
}
