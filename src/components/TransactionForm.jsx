import { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export function TransactionForm({ onSuccess, onCancel }) {
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.categoryId) return;

    await db.transactions.add({
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      categoryId: Number(formData.categoryId)
    });

    if (onSuccess) onSuccess();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Add Transaction</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            className={`btn ${formData.type === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, background: formData.type === 'expense' ? 'var(--accent-danger)' : undefined, boxShadow: formData.type === 'expense' ? '0 4px 15px var(--accent-danger-glow)' : undefined }}
            onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
          >
            Expense
          </button>
          <button 
            type="button" 
            className={`btn ${formData.type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
          >
            Income
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Amount ($)</label>
          <input 
            type="number" 
            name="amount"
            step="0.01"
            className="form-input" 
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <input 
            type="text" 
            name="description"
            className="form-input" 
            placeholder="What was this for?"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Category</label>
          <select 
            name="categoryId"
            className="form-input"
            value={formData.categoryId}
            onChange={handleChange}
            required
            style={{ appearance: 'none', background: 'rgba(0, 0, 0, 0.4)' }} // Darker bg for select to match inputs
          >
            <option value="" disabled>Select a category</option>
            {categories.filter(c => c.type === formData.type).map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Date</label>
          <input 
            type="date" 
            name="date"
            className="form-input" 
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          {onCancel && (
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
            Save Transaction
          </button>
        </div>
      </form>
    </div>
  );
}
