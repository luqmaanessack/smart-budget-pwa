import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownRight, ArrowUpRight, Brain, CalendarDays, CreditCard, Gauge, Lightbulb,
  ReceiptText, Sparkles, Trash2, TrendingUp, Wallet
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { db } from '../db';
import { formatMoney, getBudgetCycle, toLocalDate } from '../utils/finance';

const EMPTY_ARRAY = [];

export function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray()) || EMPTY_ARRAY;
  const categories = useLiveQuery(() => db.categories.toArray()) || EMPTY_ARRAY;
  const debts = useLiveQuery(() => db.debts.toArray()) || EMPTY_ARRAY;
  const settings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const learnedRules = useLiveQuery(() => db.categoryRules.count()) || 0;

  const profile = useMemo(() => {
    const setting = (key, fallback = '') => settings.find((item) => item.key === key)?.value ?? fallback;
    let categoryBudgets = {};
    try { categoryBudgets = JSON.parse(setting('category_budgets', '{}')); } catch { categoryBudgets = {}; }
    return {
      payday: Number(setting('payday', '1')),
      monthlyIncome: Number(setting('monthly_income', '0')),
      currency: setting('currency', 'ZAR'),
      goal: setting('financial_goal', 'Spend mindfully'),
      categoryBudgets
    };
  }, [settings]);

  const cycle = useMemo(() => getBudgetCycle(profile.payday), [profile.payday]);
  const cycleTransactions = useMemo(() => transactions.filter((transaction) => {
    const date = toLocalDate(transaction.date);
    return date && date >= cycle.start && date <= cycle.end;
  }), [transactions, cycle]);

  const totals = useMemo(() => cycleTransactions.reduce((summary, transaction) => {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'income') summary.income += amount;
    else {
      summary.expenses += amount;
      if (transaction.isBusiness) summary.business += amount;
      summary.byCategory[transaction.categoryId] = (summary.byCategory[transaction.categoryId] || 0) + amount;
    }
    return summary;
  }, { income: 0, expenses: 0, business: 0, byCategory: {} }), [cycleTransactions]);

  const plannedIncome = profile.monthlyIncome || totals.income;
  const available = plannedIncome - totals.expenses;
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((cycle.end - cycle.start) / 86400000));
  const elapsedDays = Math.max(1, Math.min(totalDays, Math.ceil((now - cycle.start) / 86400000)));
  const daysLeft = Math.max(1, Math.ceil((cycle.end - now) / 86400000));
  const dailySafe = Math.max(0, available) / daysLeft;
  const spendRatio = plannedIncome > 0 ? totals.expenses / plannedIncome : 0;
  const timeRatio = elapsedDays / totalDays;
  const totalDebt = debts.reduce((sum, debt) => sum + (Number(debt.remainingAmount) || 0), 0);

  const categorySpending = useMemo(() => Object.entries(totals.byCategory)
    .map(([categoryId, amount]) => {
      const category = categories.find((item) => item.id === Number(categoryId));
      const budget = Number(profile.categoryBudgets[categoryId] || 0);
      return { id: categoryId, name: category?.name || 'Other', color: category?.color || '#94a3b8', amount, budget };
    })
    .sort((a, b) => b.amount - a.amount), [totals.byCategory, categories, profile.categoryBudgets]);

  const trendData = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = new Date();
    month.setDate(1);
    month.setMonth(month.getMonth() - (5 - index));
    const amount = transactions.reduce((sum, transaction) => {
      const date = toLocalDate(transaction.date);
      return transaction.type === 'expense' && date && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
        ? sum + (Number(transaction.amount) || 0) : sum;
    }, 0);
    return { month: month.toLocaleDateString('en-ZA', { month: 'short' }), amount };
  }), [transactions]);

  const paceDelta = Math.round(Math.abs(spendRatio - timeRatio) * 100);
  const topCategory = categorySpending[0];

  const deleteTransaction = async (id) => {
    if (window.confirm('Delete this transaction? This cannot be undone.')) await db.transactions.delete(id);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your money today</p>
          <h1 className="page-title">Financial overview</h1>
          <p className="page-subtitle">Focused on your goal: {profile.goal.toLowerCase()}.</p>
        </div>
        <span className="cycle-pill"><CalendarDays size={15} /> {cycle.start.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – {cycle.end.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
      </header>

      <section className="glass-card hero-balance">
        <div>
          <div className="balance-label"><Wallet size={17} /> Available this cycle</div>
          <div className="balance-value" style={{ color: available < 0 ? 'var(--accent-danger)' : undefined }}>{formatMoney(available, profile.currency)}</div>
          <p className="balance-copy">Planned income minus recorded expenses</p>
          <div className="progress-track"><div className={`progress-fill${spendRatio > .9 ? ' danger' : ''}`} style={{ width: `${Math.min(100, spendRatio * 100)}%` }} /></div>
          <div className="progress-caption"><span>{formatMoney(totals.expenses, profile.currency)} spent</span><span>{Math.round(spendRatio * 100)}% of {formatMoney(plannedIncome, profile.currency)}</span></div>
        </div>
        <div className="pace-panel">
          <div><p className="card-kicker">Safe daily pace</p><div className="pace-number">{formatMoney(dailySafe, profile.currency)}</div><p className="balance-copy">per day for the next {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</p></div>
          <span className={`status-pill ${spendRatio <= timeRatio ? 'success' : 'warning'}`}><Gauge size={14} /> {spendRatio <= timeRatio ? 'On a comfortable pace' : `${paceDelta}% ahead of cycle pace`}</span>
        </div>
      </section>

      <section className="metric-grid">
        <div className="glass-card metric-card"><span className="metric-icon"><ArrowDownRight size={20} /></span><div><p className="card-kicker">Income recorded</p><p className="metric-value">{formatMoney(totals.income, profile.currency, true)}</p></div></div>
        <div className="glass-card metric-card"><span className="metric-icon blue"><TrendingUp size={20} /></span><div><p className="card-kicker">Cycle spending</p><p className="metric-value">{formatMoney(totals.expenses, profile.currency, true)}</p></div></div>
        <div className="glass-card metric-card"><span className="metric-icon pink"><CreditCard size={20} /></span><div><p className="card-kicker">Debt remaining</p><p className="metric-value">{formatMoney(totalDebt, profile.currency, true)}</p></div></div>
      </section>

      <section className="dashboard-grid">
        <div className="glass-card chart-card">
          <div className="card-header"><div><p className="card-kicker">Six month view</p><h2 className="card-heading">Spending trend</h2></div></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71877f', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.025)' }} formatter={(value) => formatMoney(value, profile.currency)} contentStyle={{ background: '#12201d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10 }} />
                <Bar dataKey="amount" fill="#5edba2" radius={[6, 6, 2, 2]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card">
          <div className="card-header"><div><p className="card-kicker">What needs attention</p><h2 className="card-heading">Smart check-in</h2></div><Lightbulb size={19} color="var(--accent-primary)" /></div>
          <div className="insight-list">
            <div className="insight"><Gauge size={18} /><div><strong>{spendRatio <= timeRatio ? 'Spending is tracking well' : 'Ease up on the daily pace'}</strong><p>You’ve used {Math.round(spendRatio * 100)}% of planned income across {Math.round(timeRatio * 100)}% of the cycle.</p></div></div>
            <div className="insight"><ReceiptText size={18} /><div><strong>{topCategory ? `${topCategory.name} is your largest category` : 'Start recording everyday spending'}</strong><p>{topCategory ? `${formatMoney(topCategory.amount, profile.currency)} recorded this cycle${topCategory.budget ? ` against a ${formatMoney(topCategory.budget, profile.currency)} limit` : ''}.` : 'Add a transaction or import a bank statement to reveal your patterns.'}</p></div></div>
            <div className="insight"><Brain size={18} /><div><strong>{learnedRules ? `${learnedRules} categorisation ${learnedRules === 1 ? 'rule' : 'rules'} learned` : 'Ready to learn your merchants'}</strong><p>Every category you confirm helps the next statement import require less work.</p></div></div>
          </div>
        </div>
      </section>

      {categorySpending.length > 0 && (
        <section className="glass-card" style={{ marginBottom: 18 }}>
          <div className="card-header"><div><p className="card-kicker">This cycle</p><h2 className="card-heading">Category pulse</h2></div><Link className="status-pill" to="/settings">Set limits</Link></div>
          <div className="insight-list">
            {categorySpending.slice(0, 5).map((category) => {
              const percentage = category.budget ? Math.min(100, (category.amount / category.budget) * 100) : Math.min(100, (category.amount / Math.max(1, totals.expenses)) * 100);
              return <div key={category.id}>
                <div className="progress-caption" style={{ marginBottom: 6 }}><span style={{ color: 'var(--text-primary)' }}>{category.name}</span><span>{formatMoney(category.amount, profile.currency)}{category.budget ? ` / ${formatMoney(category.budget, profile.currency)}` : ''}</span></div>
                <div className="progress-track" style={{ margin: 0 }}><div className={`progress-fill${category.budget && category.amount > category.budget ? ' danger' : ''}`} style={{ width: `${percentage}%`, background: category.amount <= category.budget || !category.budget ? category.color : undefined }} /></div>
              </div>;
            })}
          </div>
        </section>
      )}

      <section className="glass-card">
        <div className="card-header"><div><p className="card-kicker">Latest activity</p><h2 className="card-heading">Recent transactions</h2></div>{totals.business > 0 && <span className="status-pill success"><Sparkles size={13} /> {formatMoney(totals.business, profile.currency)} claimable</span>}</div>
        {transactions.length === 0 ? (
          <div className="empty-state"><div><ReceiptText size={30} /><p>No transactions yet. Add one or import a statement to get started.</p><Link className="btn-primary" to="/add">Add first transaction</Link></div></div>
        ) : (
          <div className="transaction-list">
            {[...transactions].sort((a, b) => (toLocalDate(b.date) || 0) - (toLocalDate(a.date) || 0)).slice(0, 10).map((transaction) => {
              const category = categories.find((item) => item.id === transaction.categoryId);
              return (
                <div className="transaction-row" key={transaction.id}>
                  <div className="transaction-main">
                    <span className="category-dot" style={{ color: category?.color, background: `${category?.color || '#94a3b8'}18` }}>{transaction.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</span>
                    <div className="transaction-copy"><p className="transaction-description">{transaction.description || category?.name || 'Transaction'}{transaction.isBusiness && <span className="tag">BIZ</span>}</p><p className="transaction-meta">{category?.name || 'Uncategorised'} · {(toLocalDate(transaction.date) || new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                  </div>
                  <span className={`transaction-amount${transaction.type === 'income' ? ' income' : ''}`}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount, profile.currency)}</span>
                  <button className="icon-button" title="Delete transaction" onClick={() => deleteTransaction(transaction.id)}><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
