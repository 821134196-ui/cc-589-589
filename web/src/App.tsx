import { NavLink, Route, Routes } from 'react-router-dom';
import { useUsers } from './user';
import { ROLE_LABELS } from './labels';
import MapPage from './pages/MapPage';
import SamplesPage from './pages/SamplesPage';
import NewSamplePage from './pages/NewSamplePage';
import SampleDetailPage from './pages/SampleDetailPage';
import LabPage from './pages/LabPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import DemoPage from './pages/DemoPage';

export default function App() {
  const { users, current, switchUser } = useUsers();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">💧</span> 社区水井水质采样送检系统
        </div>
        <nav>
          <NavLink to="/" end>点位图</NavLink>
          <NavLink to="/samples">样品批次</NavLink>
          <NavLink to="/samples/new">采样登记</NavLink>
          <NavLink to="/lab">实验室</NavLink>
          <NavLink to="/announcements">居民公告</NavLink>
          <NavLink to="/demo">规则演示</NavLink>
        </nav>
        <div className="user-switch">
          <span className="muted">当前身份</span>
          <select value={current ? String(current.id) : ''} onChange={(e) => switchUser(e.target.value)}>
            <option value="">未选择</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（{ROLE_LABELS[u.role]}{u.canPublish ? '·可发公告' : ''}）
              </option>
            ))}
          </select>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/samples" element={<SamplesPage />} />
          <Route path="/samples/new" element={<NewSamplePage />} />
          <Route path="/samples/:id" element={<SampleDetailPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/demo" element={<DemoPage />} />
        </Routes>
      </main>
    </div>
  );
}
