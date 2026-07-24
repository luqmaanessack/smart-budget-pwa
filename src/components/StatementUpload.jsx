import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Brain, CheckCircle2, FileSpreadsheet,
  Loader2, RotateCcw, ShieldCheck, Upload
} from 'lucide-react';
import { db } from '../db';
import {
  formatMoney, learnCategory, normalizeMerchant, suggestCategory, toISODate, transactionFingerprint
} from '../utils/finance';
import { detectStatementColumns, parseStatementAmount } from '../utils/statement';

export function StatementUpload() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const rules = useLiveQuery(() => db.categoryRules.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const currency = settings.find((item) => item.key === 'currency')?.value || 'ZAR';

  const summary = useMemo(() => {
    const included = rows.filter((row) => row.include && row.categoryId && !row.duplicate);
    return {
      included: included.length,
      duplicates: rows.filter((row) => row.duplicate).length,
      needsReview: rows.filter((row) => row.include && !row.categoryId).length,
      total: included.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : -row.amount), 0)
    };
  }, [rows]);

  const processFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (result) => {
        try {
          const fields = result.meta.fields || [];
          const { date: dateColumn, description: descriptionColumn, amount: amountColumn, debit: debitColumn, credit: creditColumn } = detectStatementColumns(fields);

          if (!dateColumn || !descriptionColumn || (!amountColumn && !debitColumn && !creditColumn)) {
            throw new Error(`I couldn't identify the statement columns. Found: ${fields.join(', ') || 'no headers'}.`);
          }

          const knownFingerprints = new Set(transactions.map((transaction) => transaction.fingerprint || transactionFingerprint(transaction)));
          const seenInFile = new Set();
          const parsed = result.data.map((rawRow, index) => {
            let signedAmount;
            let type;
            if (debitColumn || creditColumn) {
              const debit = Math.abs(parseStatementAmount(rawRow[debitColumn]));
              const credit = Math.abs(parseStatementAmount(rawRow[creditColumn]));
              type = debit > 0 ? 'expense' : 'income';
              signedAmount = debit > 0 ? debit : credit;
            } else {
              const amount = parseStatementAmount(rawRow[amountColumn]);
              type = amount < 0 ? 'expense' : 'income';
              signedAmount = Math.abs(amount);
            }

            const description = String(rawRow[descriptionColumn] || 'Unknown transaction').trim();
            const date = toISODate(rawRow[dateColumn]);
            const suggestion = suggestCategory({ description, type, categories, rules, transactions });
            const transaction = { date, amount: signedAmount, description, type };
            const fingerprint = transactionFingerprint(transaction);
            const duplicate = knownFingerprints.has(fingerprint) || seenInFile.has(fingerprint);
            seenInFile.add(fingerprint);
            return {
              id: `${index}-${fingerprint}`,
              date,
              amount: signedAmount,
              description,
              type,
              categoryId: suggestion?.categoryId || '',
              matchReason: suggestion?.reason || '',
              include: Boolean(date && signedAmount) && !duplicate,
              duplicate,
              fingerprint,
              categoryConfirmed: false
            };
          }).filter((row) => row.amount > 0 || row.description !== 'Unknown transaction');

          if (!parsed.length) throw new Error('No valid transactions were found in this file.');
          setRows(parsed);
        } catch (caught) {
          setError(caught.message || 'This statement could not be read. Try exporting it as CSV from your bank.');
        } finally {
          setIsProcessing(false);
          event.target.value = '';
        }
      },
      error: (caught) => {
        setError(caught.message || 'The file could not be read.');
        setIsProcessing(false);
      }
    });
  };

  const updateRow = (id, patch) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));

  const changeType = (row) => {
    const type = row.type === 'expense' ? 'income' : 'expense';
    const suggestion = suggestCategory({ description: row.description, type, categories, rules, transactions });
    updateRow(row.id, { type, categoryId: suggestion?.categoryId || '', matchReason: suggestion?.reason || '', categoryConfirmed: false });
  };

  const importRows = async () => {
    const ready = rows.filter((row) => row.include && row.categoryId && !row.duplicate);
    if (!ready.length) return;
    setIsImporting(true);
    const importedAt = new Date().toISOString();
    const records = ready.map((row) => ({
      type: row.type,
      amount: row.amount,
      description: row.description,
      date: row.date,
      categoryId: Number(row.categoryId),
      isBusiness: false,
      merchant: normalizeMerchant(row.description),
      fingerprint: row.fingerprint,
      source: 'statement',
      importedAt
    }));
    await db.transactions.bulkAdd(records);
    // Keep this sequential so repeated merchants in one file strengthen one rule
    // instead of racing to create the same unique rule.
    for (const record of records) {
      await learnCategory({
        description: record.description,
        type: record.type,
        categoryId: record.categoryId,
        source: 'statement-confirmed'
      });
    }
    setIsImporting(false);
    window.history.back();
  };

  if (isProcessing) {
    return <div className="processing-state"><div><Loader2 className="spinner" size={42} color="var(--accent-primary)" /><h2 style={{ margin: '18px 0 6px' }}>Reading your statement</h2><p className="muted">Detecting columns, duplicates, and familiar merchants…</p></div></div>;
  }

  if (rows.length) {
    return (
      <div className="page">
        <header className="page-header">
          <div><p className="eyebrow">Review before saving</p><h1 className="page-title">Statement preview</h1><p className="page-subtitle">{fileName} · Nothing is imported until you confirm.</p></div>
          <div className="upload-actions"><button className="btn-secondary" onClick={() => setRows([])}><RotateCcw size={16} /> Start over</button><button className="btn-primary" disabled={!summary.included || summary.needsReview > 0 || isImporting} onClick={importRows}>{isImporting ? 'Importing…' : `Import ${summary.included}`} <CheckCircle2 size={17} /></button></div>
        </header>

        <div className="review-summary">
          <div className="review-stat"><span>Ready to import</span><strong>{summary.included}</strong></div>
          <div className="review-stat"><span>Needs a category</span><strong style={{ color: summary.needsReview ? 'var(--accent-warning)' : undefined }}>{summary.needsReview}</strong></div>
          <div className="review-stat"><span>Duplicates skipped</span><strong>{summary.duplicates}</strong></div>
          <div className="review-stat"><span>Net movement</span><strong style={{ color: summary.total >= 0 ? 'var(--accent-primary)' : undefined }}>{formatMoney(summary.total, currency)}</strong></div>
        </div>

        <div className="glass-card statement-table">
          <div className="statement-head"><span>Use</span><span>Date</span><span>Description</span><span>Amount</span><span>Category</span><span>Type</span></div>
          {rows.map((row) => (
            <div key={row.id} className={`statement-row${!row.include ? ' excluded' : ''}${row.duplicate ? ' duplicate' : ''}`}>
              <input type="checkbox" aria-label={`Include ${row.description}`} checked={row.include} disabled={row.duplicate || !row.date || !row.amount} onChange={(event) => updateRow(row.id, { include: event.target.checked })} />
              <span>{row.date || <span style={{ color: 'var(--accent-danger)' }}>Bad date</span>}</span>
              <div className="row-description"><strong>{row.description}</strong><span>{row.duplicate ? 'Duplicate already recorded' : row.matchReason === 'learned' ? <span className="learn-badge"><Brain size={11} style={{ verticalAlign: -2 }} /> Learned match</span> : row.matchReason ? `${row.matchReason} match` : 'Needs your input'}</span></div>
              <strong style={{ color: row.type === 'income' ? 'var(--accent-primary)' : undefined }}>{row.type === 'income' ? '+' : '−'}{formatMoney(row.amount, currency)}</strong>
              <select className="form-input" value={row.categoryId} disabled={!row.include} onChange={(event) => updateRow(row.id, { categoryId: event.target.value ? Number(event.target.value) : '', matchReason: '', categoryConfirmed: true })}>
                <option value="">Choose category</option>
                {categories.filter((category) => category.type === row.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <button className="type-toggle" disabled={!row.include} onClick={() => changeType(row)}>{row.type === 'income' ? <><ArrowUpRight size={12} /> Income</> : <><ArrowDownRight size={12} /> Expense</>}</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Bring your history together</p><h1 className="page-title">Import a statement</h1><p className="page-subtitle">Upload a CSV export from your bank. Smart Budget detects common formats and learns from every category you confirm.</p></div>
        <span className="status-pill success"><ShieldCheck size={14} /> Processed in this browser</span>
      </header>
      <div style={{ display: 'grid', placeItems: 'center', paddingTop: 24 }}>
        {error && <div className="alert error"><AlertCircle size={18} /> <span>{error}</span></div>}
        <label className="drop-zone">
          <span className="upload-icon"><FileSpreadsheet size={31} /></span>
          <h2 style={{ margin: 0 }}>Choose your bank CSV</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 430 }}>We’ll show every row for review, skip likely duplicates, and suggest categories from your history.</p>
          <span className="btn-primary" style={{ marginTop: 8 }}><Upload size={16} /> Select statement</span>
          <div className="supported-columns"><span>Date / Posting Date</span><span>Description / Narrative</span><span>Amount or Debit + Credit</span></div>
          <input type="file" accept=".csv,text/csv,.txt" hidden onChange={processFile} />
        </label>
      </div>
    </div>
  );
}
