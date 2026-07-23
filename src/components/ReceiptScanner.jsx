import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Upload, FileText, Loader2, Check } from 'lucide-react';
import { TransactionForm } from './TransactionForm';

export function ReceiptScanner() {
  const [image, setImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedData, setParsedData] = useState(null);
  
  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setIsProcessing(true);
    setParsedData(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(parseInt(m.progress * 100));
          }
        }
      });

      const text = result.data.text;
      
      // Simple Regex to find total amount (looks for Total followed by a number with decimals)
      const amountRegex = /(?:total|amount due|balance).*?\$?\s*(\d+\.\d{2})/i;
      const amountMatch = text.match(amountRegex);
      
      // Simple Regex to find dates
      const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
      const dateMatch = text.match(dateRegex);

      // Find all prices and get the max one as a fallback total
      const allPricesRegex = /\$?\s*(\d+\.\d{2})/g;
      const allPrices = [...text.matchAll(allPricesRegex)].map(m => parseFloat(m[1]));
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      let parsedAmount = amountMatch ? parseFloat(amountMatch[1]) : maxPrice;
      
      // Format date
      let parsedDate = new Date().toISOString().split('T')[0]; // fallback to today
      if (dateMatch) {
        const d = new Date(dateMatch[1]);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      }

      setParsedData({
        amount: parsedAmount > 0 ? parsedAmount.toString() : '',
        date: parsedDate,
        description: 'Scanned Receipt',
        type: 'expense'
      });

    } catch (err) {
      console.error("OCR Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (parsedData) {
    return (
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check color="var(--accent-primary)" /> Receipt Scanned
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Please verify the extracted amounts and categorize it.</p>
        </header>
        
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
        <p style={{ color: 'var(--text-secondary)' }}>Automatically extract total amounts and dates.</p>
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
            <span style={{ fontWeight: '500' }}>Analyzing Receipt... {progress}%</span>
          </div>
          
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--gradient-primary)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
