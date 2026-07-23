import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home, PieChart, Camera, Upload, Wallet, Settings as SettingsIcon } from 'lucide-react';

import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { DebtManagement } from './components/DebtManagement';
import { ReceiptScanner } from './components/ReceiptScanner';
import { StatementUpload } from './components/StatementUpload';
import { Settings } from './components/Settings';

function Navigation() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--glass-border)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-around',
      zIndex: 50
    }}>
      <Link to="/" className="btn-icon" style={{ background: 'transparent', border: 'none', flexDirection: 'column', gap: '0.25rem' }}>
        <Home size={24} color="var(--accent-primary)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)' }}>Home</span>
      </Link>
      <Link to="/settings" className="btn-icon" style={{ background: 'transparent', border: 'none', flexDirection: 'column', gap: '0.25rem' }}>
        <SettingsIcon size={24} color="var(--text-secondary)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Settings</span>
      </Link>
      <Link to="/scan" className="btn-icon" style={{ background: 'transparent', border: 'none', flexDirection: 'column', gap: '0.25rem' }}>
        <Camera size={24} color="var(--text-secondary)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Scan</span>
      </Link>
      <div style={{ position: 'relative', top: '-20px' }}>
        <Link to="/add" className="btn-primary" style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, textDecoration: 'none' }}>
          <span style={{ fontSize: '2rem', lineHeight: '1' }}>+</span>
        </Link>
      </div>
      <Link to="/debts" className="btn-icon" style={{ background: 'transparent', border: 'none', flexDirection: 'column', gap: '0.25rem' }}>
        <Wallet size={24} color="var(--text-secondary)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Debts</span>
      </Link>
      <Link to="/upload" className="btn-icon" style={{ background: 'transparent', border: 'none', flexDirection: 'column', gap: '0.25rem' }}>
        <Upload size={24} color="var(--text-secondary)" />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Import</span>
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {/* Placeholders for other routes */}
            <Route path="/add" element={<TransactionForm onSuccess={() => window.history.back()} onCancel={() => window.history.back()} />} />
            <Route path="/scan" element={<ReceiptScanner />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/debts" element={<DebtManagement />} />
            <Route path="/upload" element={<StatementUpload />} />
          </Routes>
        </main>
        <Navigation />
      </div>
    </Router>
  );
}

export default App;
