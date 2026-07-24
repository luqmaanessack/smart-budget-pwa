export const statementColumnNames = {
  date: ['date', 'transaction date', 'posting date', 'posted date', 'value date'],
  description: ['description', 'transaction description', 'details', 'narrative', 'payee', 'memo', 'merchant'],
  amount: ['amount', 'transaction amount', 'value'],
  debit: ['debit', 'withdrawal', 'money out', 'paid out'],
  credit: ['credit', 'deposit', 'money in', 'paid in']
};

export function findStatementColumn(fields, candidates) {
  return fields.find((field) => candidates.includes(field.trim().toLowerCase()));
}

export function detectStatementColumns(fields) {
  return Object.fromEntries(Object.entries(statementColumnNames).map(([key, candidates]) => [
    key,
    findStatementColumn(fields, candidates)
  ]));
}

export function parseStatementAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim();
  const negative = raw.startsWith('(') || raw.endsWith('-') || raw.startsWith('-');
  let cleaned = raw.replace(/[R$£€()\s-]/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) cleaned = cleaned.replace(/,/g, '');
  else if (/,\d{2}$/.test(cleaned)) cleaned = cleaned.replace(',', '.');
  else cleaned = cleaned.replace(/,/g, '');
  const amount = Number.parseFloat(cleaned.replace(/[^0-9.]/g, '')) || 0;
  return negative ? -amount : amount;
}
