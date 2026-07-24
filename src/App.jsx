import { lazy, Suspense } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Camera, CreditCard, Home, Plus, Settings as SettingsIcon, Sparkles, Upload, WalletCards
} from 'lucide-react';
import { db } from './db';
import { Onboarding } from './components/Onboarding';

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const TransactionForm = lazy(() => import('./components/TransactionForm').then((module) => ({ default: module.TransactionForm })));
const DebtManagement = lazy(() => import('./components/DebtManagement').then((module) => ({ default: module.DebtManagement })));
const ReceiptScanner = lazy(() => import('./components/ReceiptScanner').then((module) => ({ default: module.ReceiptScanner })));
const StatementUpload = lazy(() => import('./components/StatementUpload').then((module) => ({ default: module.StatementUpload })));
const Settings = lazy(() => import('./components/Settings').then((module) => ({ default: module.Settings })));

const navItems = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/upload', label: 'Statements', icon: Upload },
  { to: '/scan', label: 'Receipts', icon: Camera },
  { to: '/debts', label: 'Debt plan', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><WalletCards size={22} /></span>
      <span><strong>Smart</strong> Budget</span>
    </div>
  );
}

function Navigation() {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <Brand />
      <nav className="nav-list">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-tip">
        <Sparkles size={18} />
        <div><strong>Gets smarter locally</strong><span>Confirmed categories teach future imports.</span></div>
      </div>
    </aside>
  );
}

function MobileNavigation() {
  const visibleItems = navItems.filter((item) => item.to !== '/scan');
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {visibleItems.slice(0, 2).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}>
          <Icon size={20} /><span>{label}</span>
        </NavLink>
      ))}
      <NavLink to="/add" className="mobile-add" aria-label="Add transaction"><Plus size={26} /></NavLink>
      {visibleItems.slice(2).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}>
          <Icon size={20} /><span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function TopBar() {
  const location = useLocation();
  const current = navItems.find((item) => item.to === location.pathname)?.label || (location.pathname === '/add' ? 'New transaction' : 'Smart Budget');
  return <header className="mobile-topbar"><Brand /><span>{current}</span></header>;
}

function AppShell() {
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Navigation />
      <TopBar />
      <main className="main-content">
        <Suspense fallback={<div className="splash-screen" style={{ minHeight: '60vh' }}><p>Loading your view…</p></div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<TransactionForm onSuccess={() => window.history.back()} onCancel={() => window.history.back()} />} />
            <Route path="/scan" element={<ReceiptScanner />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/debts" element={<DebtManagement />} />
            <Route path="/upload" element={<StatementUpload />} />
          </Routes>
        </Suspense>
      </main>
      <NavLink to="/add" className="desktop-add btn btn-primary"><Plus size={19} /> Add transaction</NavLink>
      <MobileNavigation />
    </div>
  );
}

function App() {
  const settings = useLiveQuery(() => db.settings.toArray());
  if (settings === undefined) {
    return <div className="splash-screen"><span className="brand-mark"><WalletCards size={26} /></span><p>Preparing your budget…</p></div>;
  }

  const onboardingComplete = settings.some((setting) => setting.key === 'onboarding_complete' && setting.value === 'true');
  if (!onboardingComplete) return <Onboarding />;

  return <BrowserRouter><AppShell /></BrowserRouter>;
}

export default App;
