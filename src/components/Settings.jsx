import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Brain, Check, Download, KeyRound, Save, ShieldAlert, SlidersHorizontal, Trash2 } from 'lucide-react';
import { db, upsertSetting } from '../db';

const EMPTY_ARRAY = [];

export function Settings() {
  const settings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray()) || EMPTY_ARRAY;
  const learnedRuleCount = useLiveQuery(() => db.categoryRules.count()) || 0;
  const [profile, setProfile] = useState({ monthly_income: '', payday: '25', currency: 'ZAR', financial_goal: 'Spend mindfully' });
  const [budgets, setBudgets] = useState({});
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const value = (key, fallback = '') => settings.find((item) => item.key === key)?.value ?? fallback;
    setProfile({
      monthly_income: value('monthly_income'),
      payday: value('payday', '25'),
      currency: value('currency', 'ZAR'),
      financial_goal: value('financial_goal', 'Spend mindfully')
    });
    setApiKey(value('openai_api_key'));
    try { setBudgets(JSON.parse(value('category_budgets', '{}'))); } catch { setBudgets({}); }
  }, [settings]);

  const flashSaved = (section) => {
    setSaved(section);
    window.setTimeout(() => setSaved(''), 2200);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    await db.transaction('rw', db.settings, async () => {
      await Promise.all(Object.entries(profile).map(([key, value]) => upsertSetting(key, value)));
      await upsertSetting('category_budgets', JSON.stringify(budgets));
    });
    flashSaved('profile');
  };

  const saveKey = async (event) => {
    event.preventDefault();
    await upsertSetting('openai_api_key', apiKey.trim());
    flashSaved('key');
  };

  const exportBackup = async () => {
    const data = { exportedAt: new Date().toISOString(), version: 1 };
    for (const table of db.tables) data[table.name] = await table.toArray();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-budget-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearLearning = async () => {
    if (window.confirm('Clear learned merchant categories? Your transactions will stay untouched.')) await db.categoryRules.clear();
  };

  const wipeData = async () => {
    if (!window.confirm('Delete all Smart Budget data from this browser? This cannot be undone.')) return;
    if (!window.confirm('Final check: delete transactions, budgets, debts, and settings?')) return;
    // Clearing tables is reliable even when Smart Budget is open in another tab;
    // deleting the whole IndexedDB database can otherwise wait indefinitely.
    for (const table of db.tables) await table.clear();
    window.location.href = '/';
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Make it yours</p><h1 className="page-title">Settings</h1><p className="page-subtitle">Tune your monthly plan, privacy, and learning preferences.</p></div>
      </header>

      <div className="settings-grid">
        <div className="settings-stack">
          <form className="glass-card settings-section" onSubmit={saveProfile}>
            <div className="card-header"><div><h2>Budget profile</h2><p style={{ margin: 0 }} className="muted">The baseline used for cycle and safe-to-spend guidance.</p></div><SlidersHorizontal size={20} color="var(--accent-primary)" /></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label" htmlFor="monthly_income">Monthly take-home income</label><input id="monthly_income" className="form-input" type="number" min="0" step="0.01" value={profile.monthly_income} onChange={(event) => setProfile((current) => ({ ...current, monthly_income: event.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="payday">Cycle starts on</label><select id="payday" className="form-input" value={profile.payday} onChange={(event) => setProfile((current) => ({ ...current, payday: event.target.value }))}>{Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>Day {day}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="currency">Currency</label><select id="currency" className="form-input" value={profile.currency} onChange={(event) => setProfile((current) => ({ ...current, currency: event.target.value }))}><option value="ZAR">South African Rand (R)</option><option value="USD">US Dollar ($)</option><option value="GBP">British Pound (£)</option><option value="EUR">Euro (€)</option></select></div>
              <div className="form-group"><label className="form-label" htmlFor="financial_goal">Main focus</label><select id="financial_goal" className="form-input" value={profile.financial_goal} onChange={(event) => setProfile((current) => ({ ...current, financial_goal: event.target.value }))}><option>Build a buffer</option><option>Clear debt</option><option>Spend mindfully</option><option>Grow savings</option></select></div>
            </div>

            <div className="card-header" style={{ marginTop: 8 }}><div><h2>Category limits</h2><p style={{ margin: 0 }} className="muted">Optional monthly guardrails. Leave blank for no limit.</p></div></div>
            <div>
              {categories.map((category) => (
                <div className="budget-row" key={category.id}>
                  <span className="budget-category"><i className="budget-swatch" style={{ background: category.color }} />{category.name}</span>
                  <input className="form-input" type="number" min="0" step="10" inputMode="decimal" aria-label={`${category.name} monthly limit`} placeholder="No limit" value={budgets[category.id] || ''} onChange={(event) => setBudgets((current) => ({ ...current, [category.id]: event.target.value }))} />
                </div>
              ))}
            </div>
            <div className="button-row"><button className="btn-primary" type="submit">{saved === 'profile' ? <Check size={17} /> : <Save size={17} />}{saved === 'profile' ? 'Saved' : 'Save budget plan'}</button></div>
          </form>
        </div>

        <div className="settings-stack">
          <section className="glass-card settings-section">
            <div className="card-header"><div><h2>Local learning</h2><p style={{ margin: 0 }} className="muted">Private merchant-to-category rules on this device.</p></div><Brain size={20} color="var(--accent-primary)" /></div>
            <p><strong style={{ color: 'var(--text-primary)' }}>{learnedRuleCount}</strong> learned {learnedRuleCount === 1 ? 'rule' : 'rules'}. Confirmed choices are reused on future statements and manual entries.</p>
            <button className="btn-secondary" type="button" disabled={!learnedRuleCount} onClick={clearLearning}>Reset learned rules</button>
          </section>

          <form className="glass-card settings-section" onSubmit={saveKey}>
            <div className="card-header"><div><h2>Receipt AI (optional)</h2><p style={{ margin: 0 }} className="muted">Used only to extract more detail from receipt scans.</p></div><KeyRound size={20} color="var(--accent-secondary)" /></div>
            <p>Your key is stored in this browser’s local database, not an encrypted secret vault. For a shared or deployed app, use a server-side proxy instead.</p>
            <div className="form-group"><label className="form-label" htmlFor="api-key">OpenAI API key</label><input id="api-key" className="form-input" type="password" autoComplete="off" placeholder="sk-…" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div>
            <button className="btn-secondary" type="submit">{saved === 'key' ? <Check size={16} /> : <Save size={16} />}{saved === 'key' ? 'Saved' : 'Save key'}</button>
          </form>

          <section className="glass-card settings-section">
            <div className="card-header"><div><h2>Your data</h2><p style={{ margin: 0 }} className="muted">Keep a portable copy of everything.</p></div><Download size={20} color="var(--accent-primary)" /></div>
            <p>Export a readable JSON backup containing transactions, categories, debts, preferences, and learned rules.</p>
            <div className="data-actions"><button className="btn-secondary" type="button" onClick={exportBackup}><Download size={16} /> Export backup</button></div>
          </section>

          <section className="glass-card settings-section danger-card">
            <div className="card-header"><div><h2 style={{ color: 'var(--accent-danger)' }}>Danger zone</h2><p style={{ margin: 0 }} className="muted">Permanently clear this browser’s budget data.</p></div><ShieldAlert size={20} color="var(--accent-danger)" /></div>
            <button className="btn btn-danger" type="button" onClick={wipeData}><Trash2 size={16} /> Delete all data</button>
          </section>
        </div>
      </div>
    </div>
  );
}
