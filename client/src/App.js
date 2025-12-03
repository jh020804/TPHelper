import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProjectPage from './pages/ProjectPage';
import MainLayout from './components/MainLayout';
import ChatPage from './pages/ChatPage';
import ProjectChatRoom from './pages/ProjectChatRoom'; // 1. ProjectChatRoom 불러오기

function App() {
  return (
    <Router>
      <Routes>
        {/* 레이아웃이 필요 없는 페이지 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* MainLayout을 사용하는 페이지 (중첩 라우팅) */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/project/:projectId" element={<ProjectPage />} />
          <Route path="/chat" element={<ChatPage />} /> 
          <Route path="/chat/:projectId" element={<ProjectChatRoom />} /> {/* 2. 채팅방 경로 추가 */}
        </Route>
        
      </Routes>
    </Router>
  );
}

export default App;