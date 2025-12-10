import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

// 페이지 import
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProjectPage from './pages/ProjectPage'; // (중복 삭제함)
import ChatPage from './pages/ChatPage';
import ProjectChatRoom from './pages/ProjectChatRoom';
import MainLayout from './components/MainLayout';

function App() {
  return (
    <Router>
      <Routes>
        {/* 1. 로그인/회원가입 (레이아웃 없음) */}
        {/* 처음 접속 시(/) 로그인 페이지로 이동 */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 2. 메인 서비스 (MainLayout 사용 - 상단바 포함) */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* ‼️ [중요] 여기에 's'를 붙여서 /projects 로 맞춰야 에러가 해결됩니다! */}
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          
          <Route path="/chat" element={<ChatPage />} /> 
          <Route path="/chat/:projectId" element={<ProjectChatRoom />} />
        </Route>
        
      </Routes>
    </Router>
  );
}

export default App;