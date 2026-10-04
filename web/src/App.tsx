import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ROLE_LABEL } from './status';
import MapPage from './pages/MapPage';
import CollectPage from './pages/CollectPage';
import SamplesPage from './pages/SamplesPage';
import HandoversPage from './pages/HandoversPage';
import LabPage from './pages/LabPage';
import ReviewPage from './pages/ReviewPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ReportPage from './pages/ReportPage';

function TopBar() {
  const { user, users, switchUser } = useAuth();
  const tabs = [
    ['/', '井位地图'],
    ['/samples', '样品批次'],
    ['/collect', '采样登记'],
    ['/handovers', '送检交接'],
    ['/lab', '实验室'],
    ['/review', '负责人审核'],
    ['/announcements', '居民公告'],
  ] as const;
  return (
    <header className="topbar">
      <div className="logo">社区水井水质 · 采样送检批次系统</div>
      <nav>
        {tabs.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="user-switch">
        <span>当前登录：</span>
        <select value={user?.id ?? ''} onChange={(e) => switchUser(e.target.value)}>
          <option value="">（未登录）</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}（{u.roles.map((r) => ROLE_LABEL[r] ?? r).join('/')}）
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

function Shell() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/samples" element={<SamplesPage />} />
          <Route path="/samples/:id" element={<ReportPage />} />
          <Route path="/collect" element={<CollectPage />} />
          <Route path="/handovers" element={<HandoversPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
