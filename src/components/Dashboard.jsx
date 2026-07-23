import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Wallet, TrendingUp, TrendingDown, CreditCard, Trash2, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

export function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray()) || [];

  // Parse user profile
  const { payday, monthlyIncome, goal } = useMemo(() => {
    return {
      payday: parseInt(settings.find(s => s.key === 'payday')?.value || '1'),
      monthlyIncome: parseFloat(settings.find(s => s.key === 'monthly_income')?.value || '0'),
      goal: settings.find(s => s.key === 'financial_goal')?.value || ''
    };
  }, [settings]);

  // Calculate Budget Cycle
  const { cycleStart, cycleEnd } = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), payday);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, payday - 1);
    
    if (now.getDate() < payday) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, payday);
      end = new Date(now.getFullYear(), now.getMonth(), payday - 1);
    }
    return { cycleStart: start, cycleEnd: end };
  }, [payday]);

  // Calculate totals
  const { cycleExpenses, claimableBusiness, safeToSpend } = useMemo(() => {
    let expenses = 0;
    let business = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        const txDate = new Date(t.date);
        if (txDate >= cycleStart && txDate <= cycleEnd) {
          expenses += t.amount;
        }
        if (t.isBusiness) {
          business += t.amount;
        }
      }
    });

    const remaining = monthlyIncome - expenses;
    return { cycleExpenses: expenses, claimableBusiness: business, safeToSpend: remaining > 0 ? remaining : 0 };
  }, [transactions, cycleStart, cycleEnd, monthlyIncome]);

  const totalDebt = useMemo(() => debts.reduce((sum, d) => sum + d.remainingAmount, 0), [debts]);
  const safePercentage = monthlyIncome > 0 ? (cycleExpenses / monthlyIncome) * 100 : 0;

  // Chart Data
  const chartData = useMemo(() => {
    const expenseByCategory = {};
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const txDate = new Date(t.date);
        if (txDate >= cycleStart && txDate <= cycleEnd) {
          expenseByCategory[t.categoryId] = (expenseByCategory[t.categoryId] || 0) + t.amount;
        }
      }
    });

    return Object.entries(expenseByCategory).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === Number(catId)) || { name: 'Unknown', color: '#888' };
      return { name: cat.name, value: amount, color: cat.color };
    });
  }, [transactions, categories, cycleStart, cycleEnd]);

  // Trends Data (last 6 months)
  const trendsData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      
      let amount = 0;
      transactions.forEach(t => {
        if (t.type === 'expense') {
          const tDate = new Date(t.date);
          if (tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear()) {
            amount += t.amount;
          }
        }
      });
      data.push({ name: monthLabel, amount });
    }
    return data;
  }, [transactions]);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      await db.transactions.delete(id);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', lineHeight: 1 }}>Overview</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Goal: {goal || 'Budgeting smartly'}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
            <Calendar size={14} /> Cycle: {cycleStart.getDate()} {cycleStart.toLocaleString('default', {month:'short'})} - {cycleEnd.getDate()} {cycleEnd.toLocaleString('default', {month:'short'})}
          </div>
        </div>
      </header>
      
      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Safe to Spend (This Cycle)</h3>
          <div style={{ padding: '0.5rem', background: 'var(--accent-primary-glow)', borderRadius: 'var(--border-radius-full)' }}>
            <Wallet size={20} color="var(--accent-primary)" />
          </div>
        </div>
        <div style={{ fontSize: '3rem', fontWeight: '700', color: safeToSpend > 0 ? 'var(--text-primary)' : 'var(--accent-danger)' }}>
          ${safeToSpend.toFixed(2)}
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem', marginBottom: '0.5rem' }}>
           <div style={{ height: '100%', width: `${Math.min(safePercentage, 100)}%`, background: safePercentage > 90 ? 'var(--accent-danger)' : 'var(--accent-primary)', transition: 'width 0.5s ease' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Spent: ${cycleExpenses.toFixed(2)}</span>
          <span>Income: ${monthlyIncome.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem' }}>Cycle Expenses</h3>
          <div style={{ flex: 1 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No expenses this cycle</div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ height: '350px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem' }}>Spending Trends</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendsData}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} />
                <Bar dataKey="amount" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3>Recent Transactions</h3>
          {claimableBusiness > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>${claimableBusiness.toFixed(2)} claimable</span>}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
              No transactions yet. Start adding some!
            </div>
          ) : (
            [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map((t, i) => {
              const cat = categories.find(c => c.id === t.categoryId);
              return (
                <div key={t.id} className="animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: cat ? `${cat.color}20` : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={20} color={cat ? cat.color : 'var(--text-secondary)'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t.description || (cat ? cat.name : 'Transaction')}
                        {t.isBusiness && <span style={{ fontSize: '0.6rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>BIZ</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(t.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: '600', color: t.type === 'income' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                    </div>
                    <button 
                      onClick={() => handleDelete(t.id)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)', opacity: 0.7, padding: '0.25rem' }}
                      title="Delete Transaction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
