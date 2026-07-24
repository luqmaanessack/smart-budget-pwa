import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, Check, CreditCard, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { db } from '../db';
import { formatMoney, normalizeMerchant, transactionFingerprint } from '../utils/finance';

const EMPTY_ARRAY = [];
const emptyDebt = () => ({ name: '', totalAmount: '', remainingAmount: '', interestRate: '', minimumPayment: '', dueDate: new Date().toISOString().split('T')[0] });

export function DebtManagement() {
  const debts = useLiveQuery(() => db.debts.toArray()) || EMPTY_ARRAY;
  const categories = useLiveQuery(() => db.categories.toArray()) || EMPTY_ARRAY;
  const settings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const currency = settings.find((item) => item.key === 'currency')?.value || 'ZAR';
  const [showAddForm, setShowAddForm] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [payment, setPayment] = useState('');
  const [formData, setFormData] = useState(emptyDebt);

  const totals = useMemo(() => debts.reduce((result, debt) => ({
    remaining: result.remaining + (Number(debt.remainingAmount) || 0),
    minimums: result.minimums + (Number(debt.minimumPayment) || 0)
  }), { remaining: 0, minimums: 0 }), [debts]);
  const focusDebt = [...debts].filter((debt) => Number(debt.remainingAmount) > 0).sort((a, b) => Number(b.interestRate) - Number(a.interestRate))[0];

  const addDebt = async (event) => {
    event.preventDefault();
    const totalAmount = Number(formData.totalAmount);
    await db.debts.add({ ...formData, totalAmount, remainingAmount: Number(formData.remainingAmount || totalAmount), interestRate: Number(formData.interestRate || 0), minimumPayment: Number(formData.minimumPayment || 0) });
    setFormData(emptyDebt());
    setShowAddForm(false);
  };

  const recordPayment = async (debt) => {
    const amount = Math.min(Number(payment), Number(debt.remainingAmount));
    if (!amount || amount <= 0) return;
    const remainingAmount = Math.max(0, Number(debt.remainingAmount) - amount);
    await db.debts.update(debt.id, { remainingAmount });
    const category = categories.find((item) => item.name === 'Debt payments' && item.type === 'expense');
    if (category) {
      const transaction = { type: 'expense', amount, description: `Payment · ${debt.name}`, date: new Date().toISOString().slice(0, 10), categoryId: category.id, isBusiness: false, source: 'debt', merchant: normalizeMerchant(debt.name) };
      transaction.fingerprint = transactionFingerprint(transaction);
      await db.transactions.add(transaction);
    }
    setPayingId(null);
    setPayment('');
  };

  const removeDebt = async (debt) => {
    if (window.confirm(`Delete ${debt.name}? Existing payment transactions will remain.`)) await db.debts.delete(debt.id);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Build momentum</p><h1 className="page-title">Debt plan</h1><p className="page-subtitle">Track balances and record payments without losing sight of everyday cash flow.</p></div>
        <button className="btn-primary" onClick={() => setShowAddForm((value) => !value)}><Plus size={17} /> Add debt</button>
      </header>

      <section className="metric-grid">
        <div className="glass-card metric-card"><span className="metric-icon pink"><CreditCard size={20} /></span><div><p className="card-kicker">Total remaining</p><p className="metric-value">{formatMoney(totals.remaining, currency, true)}</p></div></div>
        <div className="glass-card metric-card"><span className="metric-icon"><Banknote size={20} /></span><div><p className="card-kicker">Monthly minimums</p><p className="metric-value">{formatMoney(totals.minimums, currency, true)}</p></div></div>
        <div className="glass-card metric-card"><span className="metric-icon blue"><Target size={20} /></span><div><p className="card-kicker">Avalanche focus</p><p className="metric-value">{focusDebt?.name || 'All clear'}</p></div></div>
      </section>

      {showAddForm && (
        <form className="glass-card animate-fade-in" style={{ marginBottom: 18 }} onSubmit={addDebt}>
          <div className="card-header"><div><p className="eyebrow">New balance</p><h2 className="card-heading">Add a debt</h2></div></div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Name</label><input name="name" className="form-input" placeholder="Credit card" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Original balance</label><input type="number" min="0.01" step="0.01" className="form-input" value={formData.totalAmount} onChange={(event) => setFormData((current) => ({ ...current, totalAmount: event.target.value }))} required /></div>
            <div className="form-group"><label className="form-label">Current balance <span className="form-hint">Optional</span></label><input type="number" min="0" step="0.01" className="form-input" placeholder="Same as original" value={formData.remainingAmount} onChange={(event) => setFormData((current) => ({ ...current, remainingAmount: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Interest rate (APR %)</label><input type="number" min="0" step="0.01" className="form-input" value={formData.interestRate} onChange={(event) => setFormData((current) => ({ ...current, interestRate: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Minimum payment</label><input type="number" min="0" step="0.01" className="form-input" value={formData.minimumPayment} onChange={(event) => setFormData((current) => ({ ...current, minimumPayment: event.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Next due date</label><input type="date" className="form-input" value={formData.dueDate} onChange={(event) => setFormData((current) => ({ ...current, dueDate: event.target.value }))} /></div>
          </div>
          <div className="button-row"><button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button><button className="btn-primary">Save debt <Check size={17} /></button></div>
        </form>
      )}

      {debts.length === 0 ? (
        <section className="glass-card empty-state"><div><Trophy size={34} /><h2>No debt balances added</h2><p>If you have debt, add it here to build a clear payoff view.</p></div></section>
      ) : (
        <section className="dashboard-grid">
          {[...debts].sort((a, b) => Number(b.interestRate) - Number(a.interestRate)).map((debt) => {
            const progress = Number(debt.totalAmount) ? Math.max(0, Math.min(100, ((Number(debt.totalAmount) - Number(debt.remainingAmount)) / Number(debt.totalAmount)) * 100)) : 0;
            return (
              <article className="glass-card" key={debt.id}>
                <div className="card-header"><div><p className="card-kicker">{Number(debt.interestRate).toFixed(1)}% APR {focusDebt?.id === debt.id && '· Focus first'}</p><h2 className="card-heading">{debt.name}</h2></div><button className="icon-button" onClick={() => removeDebt(debt)} title="Delete debt"><Trash2 size={16} /></button></div>
                <div className="balance-value" style={{ fontSize: '2rem', marginTop: 18 }}>{formatMoney(debt.remainingAmount, currency)}</div>
                <p className="muted" style={{ fontSize: '.78rem' }}>{formatMoney(Number(debt.totalAmount) - Number(debt.remainingAmount), currency)} paid off</p>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div className="progress-caption"><span>{progress.toFixed(0)}% complete</span><span>Min. {formatMoney(debt.minimumPayment, currency)}</span></div>
                {payingId === debt.id ? (
                  <div className="button-row" style={{ alignItems: 'center' }}><input className="form-input" style={{ maxWidth: 180 }} type="number" min="0.01" step="0.01" placeholder="Payment amount" value={payment} onChange={(event) => setPayment(event.target.value)} autoFocus /><button className="btn-primary" onClick={() => recordPayment(debt)}>Record</button></div>
                ) : <div className="button-row"><button className="btn-secondary" onClick={() => setPayingId(debt.id)}><Banknote size={16} /> Record payment</button></div>}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
