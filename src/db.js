import Dexie from 'dexie';

export const db = new Dexie('SmartBudgetDB');

db.version(1).stores({
  transactions: '++id, amount, date, categoryId, type, description', // type: 'expense' | 'income'
  categories: '++id, name, color, icon, type', // type: 'expense' | 'income'
  bills: '++id, name, amount, dueDate, frequency, categoryId, lastPaid',
  debts: '++id, name, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate',
  settings: 'id, key, value' // for things like learning behavior model data or preferences
});

db.version(2).stores({
  transactions: '++id, amount, date, categoryId, type, description, isBusiness',
});

// Seed initial categories if none exist
db.on('populate', () => {
  db.categories.bulkAdd([
    { name: 'Groceries', color: '#10b981', icon: 'shopping-cart', type: 'expense' },
    { name: 'Dining', color: '#f59e0b', icon: 'coffee', type: 'expense' },
    { name: 'Transportation', color: '#3b82f6', icon: 'car', type: 'expense' },
    { name: 'Housing', color: '#8b5cf6', icon: 'home', type: 'expense' },
    { name: 'Utilities', color: '#0ea5e9', icon: 'zap', type: 'expense' },
    { name: 'Entertainment', color: '#ec4899', icon: 'film', type: 'expense' },
    { name: 'Salary', color: '#10b981', icon: 'briefcase', type: 'income' },
  ]);
});
