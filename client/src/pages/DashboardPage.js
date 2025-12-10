import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DashboardPage.css';

// Vercel 환경 변수 사용 (없으면 로컬 주소 사용)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DashboardPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        // 사용자 정보 가져오기
        axios.get(`${API_URL}/api/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => setUser(res.data.user))
        .catch(() => {
            localStorage.removeItem('token');
            navigate('/');
        });

        // 프로젝트 목록 가져오기
        fetchProjects();
        // 초대 목록 가져오기
        fetchInvitations();
    }, [navigate]);

    const fetchProjects = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res.data.projects);
        } catch (error) {
            console.error('프로젝트 목록 로드 실패', error);
        }
    };

    const fetchInvitations = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/invitations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvitations(res.data.invitations);
        } catch (error) {
            console.error('초대 목록 로드 실패', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/api/projects`, 
                { name: newProjectName },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setShowCreateModal(false);
            setNewProjectName('');
            fetchProjects();
        } catch (error) {
            alert('프로젝트 생성 실패');
        }
    };

    const handleRespondInvitation = async (projectId, accept) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/api/invitations/${projectId}/respond`,
                { accept },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchInvitations();
            if (accept) fetchProjects();
        } catch (error) {
            alert('초대 응답 처리 실패');
        }
    };

    if (!user) return <div>로딩 중...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-left">
                    <h2>TPHelper</h2>
                </div>
                <div className="header-right">
                    <span className="user-name">{user.name}님 환영합니다!</span>
                    <button onClick={handleLogout} className="btn-logout">로그아웃</button>
                </div>
            </header>

            <div className="dashboard-content">
                {/* 초대 목록 섹션 */}
                {invitations.length > 0 && (
                    <div className="invitations-section">
                        <h3>📬 도착한 초대장이 있습니다!</h3>
                        <ul className="invitation-list">
                            {invitations.map(inv => (
                                <li key={inv.id} className="invitation-item">
                                    <span>
                                        <strong>{inv.inviter_name}</strong>님이 
                                        <strong> [{inv.name}] </strong> 프로젝트에 초대했습니다.
                                    </span>
                                    <div className="invitation-buttons">
                                        <button onClick={() => handleRespondInvitation(inv.id, true)} className="btn-accept">수락</button>
                                        <button onClick={() => handleRespondInvitation(inv.id, false)} className="btn-reject">거절</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="projects-section">
                    <div className="section-header">
                        <h3>내 프로젝트</h3>
                        <button onClick={() => setShowCreateModal(true)} className="btn-create">+ 새 프로젝트</button>
                    </div>

                    <div className="project-grid">
                        {projects.map(project => (
                            <div key={project.id} className="project-card" onClick={() => navigate(`/projects/${project.id}`)}>
                                <h4>{project.name}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>새 프로젝트 생성</h3>
                        <input 
                            type="text" 
                            placeholder="프로젝트 이름"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setShowCreateModal(false)}>취소</button>
                            <button onClick={handleCreateProject} className="btn-primary">생성</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardPage;