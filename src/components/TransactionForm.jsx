import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, ArrowUpRight, Brain, Check } from 'lucide-react';
import { db } from '../db';
import { formatMoney, learnCategory, normalizeMerchant, suggestCategory, transactionFingerprint } from '../utils/finance';

const EMPTY_ARRAY = [];

export function TransactionForm({ onSuccess, onCancel, initialData }) {
  const categories = useLiveQuery(() => db.categories.toArray()) || EMPTY_ARRAY;
  const rules = useLiveQuery(() => db.categoryRules.toArray()) || EMPTY_ARRAY;
  const transactions = useLiveQuery(() => db.transactions.toArray()) || EMPTY_ARRAY;
  const settings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const currency = settings.find((item) => item.key === 'currency')?.value || 'ZAR';
  const [saving, setSaving] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initialData?.categoryId));
  const [suggestionReason, setSuggestionReason] = useState('');
  const [formData, setFormData] = useState({
    type: initialData?.type || 'expense',
    amount: initialData?.amount || '',
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    categoryId: initialData?.categoryId || '',
    isBusiness: initialData?.isBusiness || false
  });

  const availableCategories = useMemo(() => categories.filter((category) => category.type === formData.type), [categories, formData.type]);

  useEffect(() => {
    if (categoryTouched || formData.description.trim().length < 3) return;
    const suggestion = suggestCategory({ description: formData.description, type: formData.type, categories, rules, transactions });
    if (suggestion) {
      setFormData((current) => ({ ...current, categoryId: suggestion.categoryId }));
      setSuggestionReason(suggestion.reason);
    }
  }, [formData.description, formData.type, categoryTouched, categories, rules, transactions]);

  const changeType = (type) => {
    setCategoryTouched(false);
    setSuggestionReason('');
    setFormData((current) => ({ ...current, type, categoryId: '', isBusiness: type === 'expense' ? current.isBusiness : false }));
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'categoryId') {
      setCategoryTouched(true);
      setSuggestionReason('');
    }
    setFormData((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.amount || !formData.categoryId || !formData.description.trim()) return;
    setSaving(true);
    const transaction = {
      type: formData.type,
      amount: Math.abs(Number(formData.amount)),
      description: formData.description.trim(),
      date: formData.date,
      categoryId: Number(formData.categoryId),
      isBusiness: formData.type === 'expense' && formData.isBusiness,
      merchant: normalizeMerchant(formData.description),
      source: initialData ? 'receipt' : 'manual'
    };
    transaction.fingerprint = transactionFingerprint(transaction);
    await db.transactions.add(transaction);
    await learnCategory({ description: transaction.description, type: transaction.type, categoryId: transaction.categoryId, source: 'confirmed' });
    setSaving(false);
    onSuccess?.();
  };

  return (
    <div className="glass-card form-card animate-fade-in">
      <div className="card-header">
        <div><p className="eyebrow">Quick capture</p><h2 style={{ margin: 0 }}>{initialData ? 'Review transaction' : 'Add transaction'}</h2></div>
        {formData.amount && <span className="status-pill">{formatMoney(formData.amount, currency)}</span>}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="segmented" role="group" aria-label="Transaction type">
          <button type="button" className={`segment${formData.type === 'expense' ? ' active-expense' : ''}`} onClick={() => changeType('expense')}><ArrowDownRight size={17} /> Expense</button>
          <button type="button" className={`segment${formData.type === 'income' ? ' active-income' : ''}`} onClick={() => changeType('income')}><ArrowUpRight size={17} /> Income</button>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" className="form-input" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={formData.amount} onChange={handleChange} required autoFocus={!initialData} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="description">Merchant or description</label>
          <input id="description" name="description" className="form-input" type="text" placeholder="e.g. Checkers, rent, salary" value={formData.description} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="categoryId">Category {suggestionReason && <span className="form-hint learn-badge"><Brain size={12} style={{ verticalAlign: -2 }} /> {suggestionReason === 'learned' ? 'Learned from you' : suggestionReason === 'history' ? 'Matched from history' : 'Suggested'}</span>}</label>
          <select id="categoryId" name="categoryId" className="form-input" value={formData.categoryId} onChange={handleChange} required>
            <option value="">Choose a category</option>
            {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="date">Date</label>
          <input id="date" name="date" className="form-input" type="date" value={formData.date} onChange={handleChange} required />
        </div>

        {formData.type === 'expense' && (
          <div className="check-row">
            <input id="isBusiness" name="isBusiness" type="checkbox" checked={formData.isBusiness} onChange={handleChange} />
            <label htmlFor="isBusiness"><strong>Business or claimable expense</strong><br /><span className="form-hint">Keep it visible for reimbursements or tax-time review.</span></label>
          </div>
        )}

        <div className="button-row">
          {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={saving || !formData.categoryId}>{saving ? 'Saving…' : 'Save transaction'} <Check size={17} /></button>
        </div>
      </form>
    </div>
  );
}
