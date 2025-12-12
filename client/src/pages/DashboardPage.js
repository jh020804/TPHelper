import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DashboardPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DashboardPage() {
    const [projects, setProjects] = useState([]);
    const [invitations, setInvitations] = useState([]); // 🆕 초대 목록 상태
    const [newProjectName, setNewProjectName] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName') || '사용자';

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. 내 프로젝트 목록
            const projRes = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(projRes.data.projects);

            // 2. 초대 목록 불러오기
            const inviteRes = await axios.get(`${API_URL}/api/projects/invitations/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvitations(inviteRes.data.invitations);

        } catch (error) {
            console.error(error);
        }
    };

    const createProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            await axios.post(`${API_URL}/api/projects`, 
                { name: newProjectName }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewProjectName('');
            fetchData();
        } catch (error) {
            alert('프로젝트 생성 실패');
        }
    };

    // 🆕 초대 응답 처리 (수락/거절)
    const handleInvitation = async (projectId, accept) => {
        try {
            await axios.post(`${API_URL}/api/projects/invitations/${projectId}/respond`, 
                { accept },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(accept ? '프로젝트에 참여했습니다!' : '초대를 거절했습니다.');
            fetchData(); // 목록 새로고침
        } catch (error) {
            alert('요청 처리 실패');
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>{userName}님의 대시보드</h1>
                <div className="create-project-area">
                    <input 
                        type="text" 
                        placeholder="새 프로젝트 이름" 
                        value={newProjectName} 
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="create-input"
                    />
                    <button onClick={createProject} className="create-btn">프로젝트 생성</button>
                </div>
            </header>

            {/* 🆕 초대 요청 섹션 (초대가 있을 때만 표시) */}
            {invitations.length > 0 && (
                <section className="invitation-section">
                    <h3>💌 도착한 초대장</h3>
                    <div className="invitation-list">
                        {invitations.map(invite => (
                            <div key={invite.id} className="invitation-card">
                                <div className="invite-info">
                                    <span className="invite-project">{invite.name}</span>
                                    <span className="invite-owner">초대자: {invite.owner_name}</span>
                                </div>
                                <div className="invite-actions">
                                    <button className="accept-btn" onClick={() => handleInvitation(invite.id, true)}>수락</button>
                                    <button className="decline-btn" onClick={() => handleInvitation(invite.id, false)}>거절</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="project-list-section">
                <h3>내 프로젝트 목록</h3>
                {projects.length === 0 ? (
                    <div className="no-projects">참여 중인 프로젝트가 없습니다.</div>
                ) : (
                    <div className="project-grid">
                        {projects.map((project) => (
                            <div 
                                key={project.id} 
                                className="project-card" 
                                onClick={() => navigate(`/projects/${project.id}`)}
                            >
                                <div className="card-icon">📁</div>
                                <div className="card-title">{project.name}</div>
                                <div className="card-arrow">→</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default DashboardPage;