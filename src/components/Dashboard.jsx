import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function Dashboard() {
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];

  // Calculate totals
  const { totalBalance, monthlyExpenses } = useMemo(() => {
    let balance = 0;
    let expenses = 0;
    
    // Simplistic calculation for current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(t => {
      if (t.type === 'income') balance += t.amount;
      if (t.type === 'expense') {
        balance -= t.amount;
        
        const txDate = new Date(t.date);
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          expenses += t.amount;
        }
      }
    });
    return { totalBalance: balance, monthlyExpenses: expenses };
  }, [transactions]);

  const totalDebt = useMemo(() => debts.reduce((sum, d) => sum + d.remainingAmount, 0), [debts]);

  // Chart Data
  const chartData = useMemo(() => {
    const expenseByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      expenseByCategory[t.categoryId] = (expenseByCategory[t.categoryId] || 0) + t.amount;
    });

    return Object.entries(expenseByCategory).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === Number(catId)) || { name: 'Unknown', color: '#888' };
      return { name: cat.name, value: amount, color: cat.color };
    });
  }, [transactions, categories]);

  // Mock data for empty state
  const displayChartData = chartData.length > 0 ? chartData : [
    { name: 'Housing', value: 400, color: '#8b5cf6' },
    { name: 'Food', value: 300, color: '#f59e0b' },
    { name: 'Transport', value: 150, color: '#3b82f6' }
  ];

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back to your financial dashboard.</p>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Balance</h3>
            <div style={{ padding: '0.5rem', background: 'var(--accent-primary-glow)', borderRadius: 'var(--border-radius-full)' }}>
              <Wallet size={20} color="var(--accent-primary)" />
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
            ${totalBalance.toFixed(2)}
          </div>
          <div style={{ color: 'var(--accent-primary)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={16} />
            <span>Healthy balance</span>
          </div>
        </div>
        
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Monthly Expenses</h3>
            <div style={{ padding: '0.5rem', background: 'var(--accent-danger-glow)', borderRadius: 'var(--border-radius-full)' }}>
              <TrendingDown size={20} color="var(--accent-danger)" />
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
            ${monthlyExpenses.toFixed(2)}
          </div>
          <div style={{ color: 'var(--accent-warning)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Tracking higher than usual
          </div>
        </div>
        
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Debt</h3>
            <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.25)', borderRadius: 'var(--border-radius-full)' }}>
              <CreditCard size={20} color="var(--accent-secondary)" />
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
            ${totalDebt.toFixed(2)}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Focus on high-interest first
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-card" style={{ height: '350px' }}>
          <h3 style={{ marginBottom: '1rem' }}>Expenses by Category</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {displayChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Recent Transactions</h3>
            <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>View All</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                No transactions yet. Start adding some!
              </div>
            ) : (
              transactions.slice(0, 5).map((t, i) => {
                const cat = categories.find(c => c.id === t.categoryId);
                return (
                  <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: i !== transactions.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: cat ? `${cat.color}20` : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Wallet size={20} color={cat ? cat.color : 'var(--text-secondary)'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{t.description || (cat ? cat.name : 'Transaction')}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(t.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: '600', color: t.type === 'income' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
