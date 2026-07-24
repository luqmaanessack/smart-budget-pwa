import { useState, useEffect } from 'react';
import { Camera, Upload, Loader2, Check, Sparkles } from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatMoney } from '../utils/finance';

const EMPTY_ARRAY = [];

export function ReceiptScanner() {
  const [image, setImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState(null);
  const [statusText, setStatusText] = useState('Analyzing image...');
  
  const settings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const currency = settings.find((item) => item.key === 'currency')?.value || 'ZAR';
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const keySetting = settings.find(s => s.key === 'openai_api_key');
    if (keySetting && keySetting.value) {
      setApiKey(keySetting.value);
    } else if (import.meta.env.VITE_OPENAI_API_KEY) {
      setApiKey(import.meta.env.VITE_OPENAI_API_KEY);
    }
  }, [settings]);
  
  const extractWithAI = async (rawText) => {
    try {
      const prompt = `You are a receipt extraction AI. I am providing you raw OCR text from a receipt. 
Extract the following:
1. "shopName": The most likely name of the store or service provider.
2. "date": The date on the receipt in YYYY-MM-DD format (if found, else null).
3. "totalAmount": The final total amount paid as a number (if found, else null).
4. "items": A list of items purchased. Each item should have a "name" and "price".

Return ONLY a valid JSON object. Example:
{
  "shopName": "Walmart",
  "date": "2024-03-15",
  "totalAmount": 124.55,
  "items": [
    {"name": "Milk", "price": 4.99},
    {"name": "Bread", "price": 2.50}
  ]
}

Raw Text:
${rawText}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) throw new Error('API Request Failed');
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);

    } catch (err) {
      console.error("AI Extraction failed:", err);
      return null;
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setIsProcessing(true);
    setParsedData(null);
    setProgress(0);
    setStatusText('Running OCR...');

    try {
      // OCR is large, so load it only when the user actually scans a receipt.
      const { default: Tesseract } = await import('tesseract.js');
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(parseInt(m.progress * 100));
          }
        }
      });

      const text = result.data.text;
      
      let finalAmount = 0;
      let finalDate = new Date().toISOString().split('T')[0];
      let finalDescription = 'Scanned Receipt';
      let extractedItems = [];
      let isAiGuessed = false;

      if (apiKey) {
        setStatusText('AI Extracting details...');
        const aiData = await extractWithAI(text);
        if (aiData) {
          finalAmount = aiData.totalAmount || 0;
          finalDate = aiData.date || finalDate;
          finalDescription = aiData.shopName || 'Scanned Receipt';
          extractedItems = aiData.items || [];
          isAiGuessed = true;
        }
      }

      // Fallback if AI fails or no key
      if (!isAiGuessed) {
        const amountRegex = /(?:total|amount due|balance).*?(?:R|\$)?\s*(\d+\.\d{2})/i;
        const amountMatch = text.match(amountRegex);
        const dateRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/;
        const dateMatch = text.match(dateRegex);
        const allPrices = [...text.matchAll(/(?:R|\$)?\s*(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
        
        finalAmount = amountMatch ? parseFloat(amountMatch[1]) : maxPrice;
        if (dateMatch) {
          const d = new Date(dateMatch[1]);
          if (!isNaN(d.getTime())) finalDate = d.toISOString().split('T')[0];
        }
      }

      setParsedData({
        amount: finalAmount > 0 ? finalAmount.toString() : '',
        date: finalDate,
        description: finalDescription,
        type: 'expense',
        items: extractedItems,
        aiGuessed: isAiGuessed
      });

    } catch (err) {
      console.error("Scanning Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (parsedData) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check color="var(--accent-primary)" /> Receipt Scanned
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {parsedData.aiGuessed 
              ? <><Sparkles size={14} color="var(--accent-secondary)" style={{ display: 'inline', verticalAlign: 'middle' }}/> AI extracted the store name and items.</>
              : 'Basic extraction complete. Add an AI key in Settings for better results.'}
          </p>
        </header>

        {parsedData.items && parsedData.items.length > 0 && (
          <div className="glass-card" style={{ marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Detected Items</h3>
            {parsedData.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                <span>{item.name}</span>
                <strong>{formatMoney(item.price, currency)}</strong>
              </div>
            ))}
          </div>
        )}
        
        <TransactionForm 
          initialData={parsedData} 
          onSuccess={() => window.history.back()}
          onCancel={() => setParsedData(null)}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Scan Receipt</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Automatically extract store names, totals, and line items.</p>
      </header>

      {!isProcessing ? (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <label className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: 'pointer', width: '200px', padding: '2rem' }}>
            <div style={{ padding: '1rem', background: 'var(--accent-primary-glow)', borderRadius: '50%' }}>
              <Camera size={32} color="var(--accent-primary)" />
            </div>
            <h3 style={{ margin: 0 }}>Take Photo</h3>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              style={{ display: 'none' }}
              onChange={handleImageCapture}
            />
          </label>

          <label className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: 'pointer', width: '200px', padding: '2rem' }}>
            <div style={{ padding: '1rem', background: 'var(--accent-secondary-glow)', borderRadius: '50%' }}>
              <Upload size={32} color="var(--accent-secondary)" />
            </div>
            <h3 style={{ margin: 0 }}>Upload Image</h3>
            <input 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }}
              onChange={handleImageCapture}
            />
          </label>
        </div>
      ) : (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '400px' }}>
          {image && (
            <img src={image} alt="Receipt" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', opacity: 0.5, borderRadius: '8px' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-primary)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ fontWeight: '500' }}>{statusText} {statusText.includes('OCR') && `${progress}%`}</span>
          </div>
          
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: statusText.includes('OCR') ? `${progress}%` : '100%', background: 'var(--gradient-primary)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
