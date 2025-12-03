import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import './DashboardPage.css';

function DashboardPage() {
    const [projects, setProjects] = useState([]); // 내 프로젝트 (Active)
    const [invitations, setInvitations] = useState([]); // 초대된 프로젝트 (Pending)
    const [activeTab, setActiveTab] = useState('my_projects'); // 현재 탭 상태
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();
    
    const outletContext = useOutletContext();
    const setHeaderTitle = outletContext?.setHeaderTitle || (() => {});
    const setMembers = outletContext?.setMembers || (() => {});
    const setCurrentProjectId = outletContext?.setCurrentProjectId || (() => {});

    useEffect(() => {
        setHeaderTitle('대시보드');
        setMembers([]); 
        setCurrentProjectId(null); 
    }, [setHeaderTitle, setMembers, setCurrentProjectId]);

    // 데이터 불러오기 함수
    const fetchData = async () => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        try {
            // 1. 내 프로젝트 목록
            const projRes = await axios.get('https://api.render.com/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/api/projects', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(projRes.data.projects);

            // 2. 초대된 프로젝트 목록
            const invRes = await axios.get('https://api.render.com/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/api/invitations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvitations(invRes.data.invitations);

        } catch (error) {
            console.error('데이터 로딩 실패:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [navigate]);

    // 초대 응답 핸들러 (수락/거절)
    const handleRespond = async (projectId, accept) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`https://api.render.com/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/api/invitations/${projectId}/respond`, 
                { accept }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // 목록 새로고침
            fetchData();
            alert(accept ? '프로젝트에 참여했습니다!' : '초대를 거절했습니다.');
        } catch (error) {
            alert('처리에 실패했습니다.');
        }
    };

    // 프로젝트 생성 핸들러
    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('https://api.render.com/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YAm/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/api/projects', 
                { name: newProjectName },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setProjects([...projects, { id: response.data.projectId, name: newProjectName }]);
            setNewProjectName('');
            setIsCreating(false);
        } catch (error) {
            alert('프로젝트 생성 실패');
        }
    };

    return (
        <div className="dashboard-content">
            {/* --- 탭 메뉴 --- */}
            <div className="dashboard-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'my_projects' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my_projects')}
                >
                    내 프로젝트 ({projects.length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'invitations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invitations')}
                >
                    초대된 프로젝트 ({invitations.length})
                    {invitations.length > 0 && <span className="new-badge">N</span>}
                </button>
            </div>

            <main className="project-list-container">
                
                {/* --- 1. 내 프로젝트 탭 --- */}
                {activeTab === 'my_projects' && (
                    <div className="project-list">
                        {/* 새 프로젝트 생성 카드 */}
                        <div className={`project-card create-card ${isCreating ? 'active' : ''}`}>
                            {isCreating ? (
                                <form onSubmit={handleCreateProject} className="card-form">
                                    <input autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="프로젝트 이름" />
                                    <div className="card-actions">
                                        <button type="submit" className="btn-create">생성</button>
                                        <button type="button" className="btn-cancel" onClick={() => {setIsCreating(false); setNewProjectName('');}}>취소</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="create-placeholder" onClick={() => setIsCreating(true)}>
                                    <span className="plus-icon">+</span><span>새 프로젝트</span>
                                </div>
                            )}
                        </div>

                        {/* 프로젝트 목록 */}
                        {projects.map(project => (
                            <Link to={`/project/${project.id}`} key={project.id} className="project-card-link">
                                <div className="project-card">
                                    <h3>{project.name}</h3>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* --- 2. 초대된 프로젝트 탭 --- */}
                {activeTab === 'invitations' && (
                    <div className="invitation-list">
                        {invitations.length > 0 ? (
                            invitations.map(invite => (
                                <div key={invite.id} className="invitation-card">
                                    <div className="invite-info">
                                        <h3>{invite.name}</h3>
                                        <p>초대한 사람: <strong>{invite.inviter_name}</strong></p>
                                    </div>
                                    <div className="invite-actions">
                                        <button onClick={() => handleRespond(invite.id, true)} className="btn-accept">수락</button>
                                        <button onClick={() => handleRespond(invite.id, false)} className="btn-decline">거절</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="no-invites">받은 초대가 없습니다.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default DashboardPage;