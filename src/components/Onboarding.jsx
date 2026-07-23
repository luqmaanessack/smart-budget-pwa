import { useState } from 'react';
import { db } from '../db';
import { Sparkles, ArrowRight, DollarSign, Calendar, Target, CheckCircle2 } from 'lucide-react';

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    monthly_income: '',
    payday: '25',
    financial_goal: 'Clear Debt',
    has_debts: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFinish = async () => {
    const settings = [
      { key: 'onboarding_complete', value: 'true' },
      { key: 'monthly_income', value: formData.monthly_income },
      { key: 'payday', value: formData.payday },
      { key: 'financial_goal', value: formData.financial_goal }
    ];

    // Bulk put settings (we'll manually handle updates vs adds by just doing bulkPut or add)
    // Actually Dexie .put() creates or replaces by primary key. Wait, settings primary key is `id`, not `key`.
    // We should use a loop to check if it exists or change the schema.
    // For simplicity, onboarding is only run once, so we can just add.
    
    for (const setting of settings) {
      const existing = await db.settings.where('key').equals(setting.key).first();
      if (existing) {
        await db.settings.update(existing.id, { value: setting.value });
      } else {
        await db.settings.add(setting);
      }
    }

    if (onComplete) onComplete();
  };

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'var(--bg-primary)', zIndex: 1000, display: 'flex',
      flexDirection: 'column', padding: '2rem'
    }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
        
        {step === 1 && (
          <div className="animate-fade-in">
            <div style={{ padding: '1rem', background: 'var(--accent-primary-glow)', borderRadius: '50%', display: 'inline-flex', marginBottom: '2rem' }}>
              <Sparkles size={40} color="var(--accent-primary)" />
            </div>
            <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1.1 }}>Welcome to Smart Budget.</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '3rem' }}>
              Let's tailor your dashboard to your unique financial situation.
            </p>
            <button className="btn-primary" onClick={() => setStep(2)} style={{ width: '100%', padding: '1rem', fontSize: '1.2rem' }}>
              Get Started <ArrowRight size={20} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <DollarSign color="var(--accent-primary)" /> Income & Cycle
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>When does your budget month start?</p>
            
            <div className="form-group">
              <label className="form-label">Average Monthly Income ($)</label>
              <input 
                type="number" 
                name="monthly_income"
                className="form-input" 
                placeholder="4000"
                value={formData.monthly_income}
                onChange={handleChange}
                style={{ fontSize: '1.5rem', padding: '1rem' }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label className="form-label">What day of the month do you get paid?</label>
              <select 
                name="payday"
                className="form-input"
                value={formData.payday}
                onChange={handleChange}
                style={{ appearance: 'none', fontSize: '1.2rem', padding: '1rem' }}
              >
                {[...Array(31)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
              <button className="btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
              <button className="btn-primary" onClick={() => setStep(3)} style={{ flex: 2 }} disabled={!formData.monthly_income}>
                Continue <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Target color="var(--accent-secondary)" /> Financial Goals
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>What are we working towards?</p>
            
            <div className="form-group">
              <label className="form-label">Primary Goal</label>
              <select 
                name="financial_goal"
                className="form-input"
                value={formData.financial_goal}
                onChange={handleChange}
                style={{ appearance: 'none', fontSize: '1.2rem', padding: '1rem' }}
              >
                <option value="Clear Debt">Clear Debt</option>
                <option value="Save for a house">Save for a house</option>
                <option value="Travel Fund">Travel Fund</option>
                <option value="Investments">Grow Investments</option>
                <option value="General Savings">General Savings</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
              <input 
                type="checkbox" 
                name="has_debts" 
                id="has_debts"
                checked={formData.has_debts}
                onChange={handleChange}
                style={{ width: '1.5rem', height: '1.5rem', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="has_debts" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.1rem' }}>
                I have existing debts/loans to track
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
              <button className="btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
              <button className="btn-primary" onClick={handleFinish} style={{ flex: 2 }}>
                Complete Setup <CheckCircle2 size={20} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
