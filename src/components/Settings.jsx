import { useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings as SettingsIcon, Key, Save, Check, AlertTriangle } from 'lucide-react';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  
  // Load existing key
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  
  useEffect(() => {
    const keySetting = settings.find(s => s.key === 'openai_api_key');
    if (keySetting) {
      setApiKey(keySetting.value);
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Check if setting exists
    const existing = await db.settings.where('key').equals('openai_api_key').first();
    
    if (existing) {
      await db.settings.update(existing.id, { value: apiKey });
    } else {
      await db.settings.add({ key: 'openai_api_key', value: apiKey });
    }
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleWipeData = async () => {
    if (confirm("DANGER: Are you sure you want to wipe ALL your financial data, transactions, and settings? This cannot be undone.")) {
      if (confirm("FINAL WARNING: All data will be permanently deleted!")) {
        await db.delete();
        window.location.reload();
      }
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <SettingsIcon size={32} className="text-gradient" />
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', margin: 0 }}>Settings</h1>
      </header>
      
      <div className="glass-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.2rem' }}>
          <Key size={20} color="var(--accent-primary)" />
          AI Intelligence Setup
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Provide your OpenAI API key to supercharge auto-categorization. When uploading bank statements, the AI will intelligently analyze the transaction descriptions and map them to your categories. Your key is stored securely in your local browser database and is never sent anywhere except directly to OpenAI.
        </p>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">OpenAI API Key</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            {isSaved ? 'Saved!' : 'Save Key'}
          </button>
        </form>
      </div>
      <div className="glass-card" style={{ marginTop: '2rem', border: '1px solid var(--accent-danger)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--accent-danger)' }}>
          <AlertTriangle size={20} />
          Danger Zone
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          This will permanently delete all your transactions, categories, debts, and settings from this device. It cannot be undone. You will be prompted to set up your profile again.
        </p>
        <button className="btn-secondary" style={{ background: 'var(--accent-danger-glow)', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)' }} onClick={handleWipeData}>
          Wipe All Data & Start Over
        </button>
      </div>
    </div>
  );
}
