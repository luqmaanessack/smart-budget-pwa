import { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { CreditCard, Plus, ArrowRight } from 'lucide-react';

export function DebtManagement() {
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    totalAmount: '',
    remainingAmount: '',
    interestRate: '',
    minimumPayment: '',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await db.debts.add({
      name: formData.name,
      totalAmount: parseFloat(formData.totalAmount),
      remainingAmount: parseFloat(formData.remainingAmount || formData.totalAmount),
      interestRate: parseFloat(formData.interestRate || 0),
      minimumPayment: parseFloat(formData.minimumPayment || 0),
      dueDate: formData.dueDate
    });
    setShowAddForm(false);
    setFormData({ name: '', totalAmount: '', remainingAmount: '', interestRate: '', minimumPayment: '', dueDate: new Date().toISOString().split('T')[0] });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Debt Payoff</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Total remaining: <strong style={{ color: 'var(--text-primary)' }}>${totalDebt.toFixed(2)}</strong></p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={20} /> Add Debt
        </button>
      </header>

      {showAddForm && (
        <div className="glass-card animate-fade-in" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add New Debt</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Debt Name</label>
              <input type="text" name="name" className="form-input" placeholder="e.g. Credit Card" value={formData.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Total Amount ($)</label>
              <input type="number" step="0.01" name="totalAmount" className="form-input" value={formData.totalAmount} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Remaining Amount ($)</label>
              <input type="number" step="0.01" name="remainingAmount" className="form-input" placeholder="Optional" value={formData.remainingAmount} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Interest Rate (%)</label>
              <input type="number" step="0.01" name="interestRate" className="form-input" value={formData.interestRate} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Payment ($)</label>
              <input type="number" step="0.01" name="minimumPayment" className="form-input" value={formData.minimumPayment} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Next Due Date</label>
              <input type="date" name="dueDate" className="form-input" value={formData.dueDate} onChange={handleChange} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Debt</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {debts.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>You don't have any debts added yet. Great job!</p>
          </div>
        ) : (
          debts.map(debt => {
            const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100;
            return (
              <div key={debt.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--border-radius-md)' }}>
                      <CreditCard size={24} color="var(--accent-secondary)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{debt.name}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>{debt.interestRate}% APR</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: 0 }}>${debt.remainingAmount.toFixed(2)}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>left</p>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gradient-primary)', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Next Payment</p>
                    <p style={{ fontWeight: '500', margin: 0 }}>${debt.minimumPayment.toFixed(2)} on {new Date(debt.dueDate).toLocaleDateString()}</p>
                  </div>
                  <button className="btn-icon">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
