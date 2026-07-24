import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, WalletCards } from 'lucide-react';
import { db, upsertSetting } from '../db';

const goals = [
  ['Build a buffer', 'Create breathing room for surprises'],
  ['Clear debt', 'Pay down balances with intention'],
  ['Spend mindfully', 'Understand where everyday money goes'],
  ['Grow savings', 'Make steady progress toward the future']
];

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    monthly_income: '',
    payday: '25',
    currency: 'ZAR',
    financial_goal: 'Spend mindfully'
  });

  const update = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));

  const finish = async () => {
    setSaving(true);
    await db.transaction('rw', db.settings, async () => {
      await upsertSetting('monthly_income', formData.monthly_income);
      await upsertSetting('payday', formData.payday);
      await upsertSetting('currency', formData.currency);
      await upsertSetting('financial_goal', formData.financial_goal);
      await upsertSetting('category_budgets', '{}');
      // Save this last so the dashboard never opens with a half-written profile.
      await upsertSetting('onboarding_complete', 'true');
    });
    setSaving(false);
  };

  return (
    <div className="onboarding">
      <section className="onboarding-visual" aria-hidden="true">
        <div className="brand"><span className="brand-mark"><WalletCards size={22} /></span><span><strong>Smart</strong> Budget</span></div>
        <div className="onboarding-quote">
          <p className="eyebrow">Money, made clearer</p>
          <h2>A calm view of your whole financial life.</h2>
          <p>One place for daily spending, statements, receipts, debt progress, and a budget rhythm that fits your payday.</p>
        </div>
        <div className="privacy-note"><LockKeyhole size={15} /> Your financial data stays in this browser by default.</div>
      </section>

      <main className="onboarding-panel">
        <div className="step-progress" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'complete' : ''} />)}
        </div>

        {step === 1 && (
          <section className="onboarding-step">
            <p className="eyebrow">Welcome</p>
            <h1>Let’s build a budget around your real life.</h1>
            <p>We’ll start with three quick choices. You can change all of them later in Settings.</p>
            <button className="btn-primary" onClick={() => setStep(2)}>Set up my budget <ArrowRight size={18} /></button>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <p className="eyebrow">Your monthly rhythm</p>
            <h1>What are we working with?</h1>
            <p>This creates your spending cycle and daily safe-to-spend guide.</p>
            <div className="form-group">
              <label className="form-label" htmlFor="monthly_income">Usual take-home income</label>
              <input id="monthly_income" name="monthly_income" className="form-input" type="number" min="0" step="0.01" placeholder="25 000" value={formData.monthly_income} onChange={update} autoFocus />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="payday">Payday / cycle start</label>
                <select id="payday" name="payday" className="form-input" value={formData.payday} onChange={update}>
                  {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>Day {day}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="currency">Currency</label>
                <select id="currency" name="currency" className="form-input" value={formData.currency} onChange={update}>
                  <option value="ZAR">South African Rand (R)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="GBP">British Pound (£)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}><ArrowLeft size={17} /> Back</button>
              <button className="btn-primary" disabled={!Number(formData.monthly_income)} onClick={() => setStep(3)}>Continue <ArrowRight size={18} /></button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <p className="eyebrow">Your priority</p>
            <h1>What matters most right now?</h1>
            <p>This keeps the dashboard focused. It won’t lock you into a rigid plan.</p>
            <div className="choice-grid">
              {goals.map(([name, description]) => (
                <button key={name} className={`choice-card${formData.financial_goal === name ? ' active' : ''}`} onClick={() => setFormData((current) => ({ ...current, financial_goal: name }))}>
                  <strong>{name}</strong>{description}
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={() => setStep(2)}><ArrowLeft size={17} /> Back</button>
              <button className="btn-primary" disabled={saving} onClick={finish}>{saving ? 'Saving…' : 'Open my dashboard'} <Check size={18} /></button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
