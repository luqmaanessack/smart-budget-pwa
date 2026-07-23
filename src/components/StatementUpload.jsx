import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Upload, FileText, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

export function StatementUpload() {
  const [parsedData, setParsedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray()) || [];

  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const keySetting = settings.find(s => s.key === 'openai_api_key');
    if (keySetting && keySetting.value) {
      setApiKey(keySetting.value);
    } else if (import.meta.env.VITE_OPENAI_API_KEY) {
      setApiKey(import.meta.env.VITE_OPENAI_API_KEY);
    }
  }, [settings]);

  // Fallback local intelligence
  const guessCategoryLocal = (description) => {
    if (!description) return null;
    const descLower = description.toLowerCase();
    
    const prevMatch = transactions.find(t => t.description.toLowerCase() === descLower);
    if (prevMatch) return prevMatch.categoryId;

    if (descLower.includes('uber') || descLower.includes('lyft') || descLower.includes('gas')) {
      return categories.find(c => c.name === 'Transportation')?.id || null;
    }
    if (descLower.includes('grocery') || descLower.includes('walmart') || descLower.includes('target')) {
      return categories.find(c => c.name === 'Groceries')?.id || null;
    }
    if (descLower.includes('restaurant') || descLower.includes('cafe') || descLower.includes('starbucks')) {
      return categories.find(c => c.name === 'Dining')?.id || null;
    }
    return null;
  };

  const getAIAssistedCategories = async (transactionsPreview) => {
    if (!apiKey) return transactionsPreview;

    try {
      const descriptions = transactionsPreview.map((t, i) => `${i}: ${t.description}`);
      const categoryList = categories.map(c => `${c.id}: ${c.name}`).join(', ');

      const prompt = `You are a financial categorization assistant. I have a list of transaction descriptions. 
Match each description to the most appropriate category ID from this list: [${categoryList}].
Return ONLY a valid JSON object mapping the transaction index to the category ID. Example: {"0": 1, "1": 5}
If you are unsure, do not include the index in the JSON.
Descriptions to categorize:
${descriptions.join('\n')}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) throw new Error('API Request Failed');
      
      const data = await response.json();
      const mappingString = data.choices[0].message.content;
      const mapping = JSON.parse(mappingString);

      return transactionsPreview.map((t, i) => {
        if (mapping[i.toString()] !== undefined) {
          return { ...t, categoryId: Number(mapping[i.toString()]), aiGuessed: true };
        }
        return t;
      });

    } catch (err) {
      console.error("AI Categorization failed:", err);
      // Fallback to local if AI fails
      return transactionsPreview;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let transactionsPreview = results.data.map(row => {
            const dateVal = row['Date'] || row['date'] || row['Posting Date'] || '';
            const amountVal = row['Amount'] || row['amount'] || '';
            const descVal = row['Description'] || row['description'] || row['Payee'] || 'Unknown';
            
            let parsedAmount = parseFloat(amountVal.toString().replace(/[^0-9.-]+/g,""));
            if (isNaN(parsedAmount)) parsedAmount = 0;

            const type = parsedAmount < 0 ? 'expense' : 'income';
            
            return {
              originalRow: row,
              date: dateVal ? new Date(dateVal).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              amount: Math.abs(parsedAmount),
              description: descVal,
              type: type,
              categoryId: guessCategoryLocal(descVal) || '', // start with local guess
              aiGuessed: false
            };
          }).filter(t => t.amount > 0);

          // If AI is enabled, enhance the categorization
          if (apiKey) {
            transactionsPreview = await getAIAssistedCategories(transactionsPreview);
          }

          setParsedData(transactionsPreview);
        } catch (err) {
          setError('Failed to parse the CSV format. Please ensure it has Date, Amount, and Description headers.');
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        setError(error.message);
        setIsProcessing(false);
      }
    });
  };

  const handleImport = async () => {
    const validTransactions = parsedData.filter(t => t.categoryId !== '');
    
    await db.transactions.bulkAdd(validTransactions.map(t => ({
      type: t.type,
      amount: t.amount,
      description: t.description,
      date: t.date,
      categoryId: t.categoryId
    })));

    window.history.back();
  };

  const handleCategoryChange = (index, catId) => {
    const newData = [...parsedData];
    newData[index].categoryId = catId ? Number(catId) : '';
    newData[index].aiGuessed = false; // user override
    setParsedData(newData);
  };

  if (isProcessing) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4rem', gap: '1rem' }}>
        <Loader2 size={48} className="animate-spin" color="var(--accent-primary)" />
        <h2 className="text-gradient">Analyzing Data...</h2>
        {apiKey && <p style={{ color: 'var(--accent-secondary)' }}><Sparkles size={16} style={{ display: 'inline' }}/> AI is categorizing your transactions</p>}
      </div>
    );
  }

  if (parsedData.length > 0) {
    const readyToImport = parsedData.filter(t => t.categoryId !== '').length;
    
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: '0.5rem' }}>Review Transactions</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {apiKey ? <><Sparkles size={16} color="var(--accent-secondary)" style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> AI assisted categorization active.</> : 'Local categorization active.'}
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleImport}
            disabled={readyToImport === 0}
          >
            Import {readyToImport} Transactions
          </button>
        </header>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {parsedData.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '1rem', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
              <div>{t.date}</div>
              <div style={{ fontWeight: '500' }}>
                {t.description}
                {t.aiGuessed && <Sparkles size={12} color="var(--accent-secondary)" style={{ marginLeft: '0.5rem' }} />}
              </div>
              <div style={{ fontWeight: '600', color: t.type === 'income' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
              </div>
              <div>
                <select 
                  className="form-input"
                  style={{ 
                    appearance: 'none', 
                    padding: '0.5rem',
                    background: t.aiGuessed ? 'var(--accent-secondary-glow)' : 'rgba(0,0,0,0.4)',
                    borderColor: t.aiGuessed ? 'var(--accent-secondary)' : 'var(--glass-border)'
                  }}
                  value={t.categoryId || ''}
                  onChange={(e) => handleCategoryChange(i, e.target.value)}
                >
                  <option value="" disabled>Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Import Data</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Upload your bank statement (CSV format) to bulk import transactions.</p>
        {!apiKey && (
          <p style={{ color: 'var(--accent-warning)', fontSize: '0.85rem', marginTop: '1rem' }}>
            Tip: Go to Settings to add an OpenAI key for supercharged AI categorization!
          </p>
        )}
      </header>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-danger)' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <label className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: 'pointer', width: '300px', padding: '3rem 2rem' }}>
        <div style={{ padding: '1rem', background: 'var(--accent-primary-glow)', borderRadius: '50%' }}>
          <FileText size={40} color="var(--accent-primary)" />
        </div>
        <h3 style={{ margin: 0 }}>Select CSV File</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
          Ensure your CSV has Date, Amount, and Description columns.
        </p>
        <input 
          type="file" 
          accept=".csv" 
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
}
