import { db } from '../db';

const merchantNoise = new Set([
  'card', 'purchase', 'payment', 'debit', 'credit', 'online', 'bank', 'transfer',
  'transaction', 'ref', 'reference', 'pos', 'visa', 'mastercard', 'za', 'zaf'
]);

export function toLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const localMatch = text.match(/^(\d{1,2})[\s/.-](\d{1,2}|[A-Za-z]{3,9})[\s/.-](\d{2,4})/);
  if (localMatch) {
    const year = Number(localMatch[3]) < 100 ? 2000 + Number(localMatch[3]) : Number(localMatch[3]);
    const monthText = localMatch[2];
    const month = /^\d+$/.test(monthText)
      ? Number(monthText) - 1
      : ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthText.slice(0, 3).toLowerCase());
    const parsed = new Date(year, month, Number(localMatch[1]));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toISODate(value) {
  const date = toLocalDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMoney(amount, currency = 'ZAR', compact = false) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2
  }).format(Number(amount) || 0);
}

export function normalizeMerchant(description = '') {
  const cleaned = String(description)
    .toLowerCase()
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^a-z0-9&]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !merchantNoise.has(word))
    .slice(0, 5)
    .join(' ');
  return cleaned || String(description).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}

function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function transactionFingerprint(transaction) {
  const basis = [
    toISODate(transaction.date),
    Number(transaction.amount || 0).toFixed(2),
    transaction.type || 'expense',
    normalizeMerchant(transaction.description)
  ].join('|');
  return hashText(basis);
}

const categoryKeywords = {
  Groceries: ['checkers', 'shoprite', 'pick n pay', 'pnp', 'woolworths food', 'spar', 'food lovers', 'grocery'],
  Dining: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mugg bean', 'nandos', 'kfc', 'mcdonalds', 'uber eats', 'mr d'],
  Transportation: ['uber', 'bolt', 'engen', 'shell', 'sasol', 'bp ', 'petrol', 'fuel', 'gautrain', 'parking'],
  Housing: ['rent', 'bond repayment', 'home loan', 'levy'],
  Utilities: ['eskom', 'municipal', 'city of', 'vodacom', 'mtn', 'telkom', 'rain ', 'electricity', 'water'],
  Healthcare: ['dis chem', 'clicks', 'pharmacy', 'doctor', 'mediclinic', 'netcare', 'medical'],
  Insurance: ['insurance', 'outsurance', 'discovery insure', 'santam'],
  Entertainment: ['netflix', 'spotify', 'showmax', 'dstv', 'cinema', 'steam'],
  'Debt payments': ['credit card payment', 'loan repayment', 'vehicle finance'],
  Savings: ['savings', 'investment', 'easy equities'],
  Salary: ['salary', 'payroll', 'wages'],
  'Other income': ['refund', 'cashback', 'interest received']
};

export function suggestCategory({ description, type, categories, rules = [], transactions = [] }) {
  const merchant = normalizeMerchant(description);
  if (!merchant) return null;

  const learned = [...rules]
    .filter((rule) => rule.type === type && rule.merchant === merchant)
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))[0];
  if (learned) return { categoryId: learned.categoryId, reason: 'learned' };

  const previous = [...transactions].reverse().find((transaction) =>
    transaction.type === type && normalizeMerchant(transaction.description) === merchant
  );
  if (previous) return { categoryId: previous.categoryId, reason: 'history' };

  const descriptionText = String(description).toLowerCase();
  const match = Object.entries(categoryKeywords).find(([, keywords]) =>
    keywords.some((keyword) => descriptionText.includes(keyword))
  );
  if (match) {
    const category = categories.find((item) => item.name === match[0] && item.type === type);
    if (category) return { categoryId: category.id, reason: 'suggested' };
  }
  return null;
}

export async function learnCategory({ description, type, categoryId, source = 'confirmed' }) {
  const merchant = normalizeMerchant(description);
  if (!merchant || !categoryId) return;
  const ruleKey = `${type}:${merchant}`;
  const existing = await db.categoryRules.where('ruleKey').equals(ruleKey).first();
  const now = new Date().toISOString();
  if (existing) {
    await db.categoryRules.update(existing.id, {
      categoryId: Number(categoryId),
      useCount: (existing.useCount || 0) + 1,
      lastUsed: now,
      source
    });
  } else {
    await db.categoryRules.add({
      ruleKey,
      merchant,
      type,
      categoryId: Number(categoryId),
      useCount: 1,
      lastUsed: now,
      source
    });
  }
}

export function getBudgetCycle(payday, now = new Date()) {
  const safePayday = Math.min(28, Math.max(1, Number(payday) || 1));
  let start = new Date(now.getFullYear(), now.getMonth(), safePayday);
  if (now < start) start = new Date(now.getFullYear(), now.getMonth() - 1, safePayday);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, safePayday - 1, 23, 59, 59, 999);
  return { start, end };
}
