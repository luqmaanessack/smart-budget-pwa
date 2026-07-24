import Dexie from 'dexie';

export const db = new Dexie('SmartBudgetDB');

db.version(1).stores({
  transactions: '++id, amount, date, categoryId, type, description',
  categories: '++id, name, color, icon, type',
  bills: '++id, name, amount, dueDate, frequency, categoryId, lastPaid',
  debts: '++id, name, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate',
  settings: 'id, key, value'
});

db.version(2).stores({
  transactions: '++id, amount, date, categoryId, type, description, isBusiness'
});

// Settings now auto-increment correctly, imported rows carry duplicate-detection
// metadata, and category rules provide a small, private learning layer.
db.version(3).stores({
  transactions: '++id, amount, date, categoryId, type, description, isBusiness, fingerprint, merchant, source',
  categories: '++id, name, color, icon, type',
  bills: '++id, name, amount, dueDate, frequency, categoryId, lastPaid',
  debts: '++id, name, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate',
  settings: '++id, key, value',
  categoryRules: '++id, &ruleKey, merchant, type, categoryId, useCount, lastUsed'
});

export const defaultCategories = [
  { name: 'Groceries', color: '#22c55e', icon: 'shopping-cart', type: 'expense' },
  { name: 'Dining', color: '#f59e0b', icon: 'coffee', type: 'expense' },
  { name: 'Transportation', color: '#38bdf8', icon: 'car', type: 'expense' },
  { name: 'Housing', color: '#a78bfa', icon: 'home', type: 'expense' },
  { name: 'Utilities', color: '#06b6d4', icon: 'zap', type: 'expense' },
  { name: 'Healthcare', color: '#fb7185', icon: 'heart-pulse', type: 'expense' },
  { name: 'Insurance', color: '#818cf8', icon: 'shield', type: 'expense' },
  { name: 'Education', color: '#f97316', icon: 'book-open', type: 'expense' },
  { name: 'Entertainment', color: '#e879f9', icon: 'film', type: 'expense' },
  { name: 'Personal', color: '#f472b6', icon: 'user', type: 'expense' },
  { name: 'Debt payments', color: '#ef4444', icon: 'credit-card', type: 'expense' },
  { name: 'Savings', color: '#14b8a6', icon: 'piggy-bank', type: 'expense' },
  { name: 'Other', color: '#94a3b8', icon: 'circle', type: 'expense' },
  { name: 'Salary', color: '#10b981', icon: 'briefcase', type: 'income' },
  { name: 'Other income', color: '#34d399', icon: 'wallet', type: 'income' }
];

db.on('populate', () => db.categories.bulkAdd(defaultCategories));

// Existing installations may only have the original small category set.
db.on('ready', async () => {
  const existing = await db.categories.toArray();
  const names = new Set(existing.map((category) => category.name.toLowerCase()));
  const missing = defaultCategories.filter((category) => !names.has(category.name.toLowerCase()));
  if (missing.length) await db.categories.bulkAdd(missing);
});

export async function upsertSetting(key, value) {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing) return db.settings.update(existing.id, { value: String(value) });
  return db.settings.add({ key, value: String(value) });
}
