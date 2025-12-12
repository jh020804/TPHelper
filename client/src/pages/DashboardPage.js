import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DashboardPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DashboardPage() {
    const [projects, setProjects] = useState([]);
    const [newProjectName, setNewProjectName] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName') || '사용자';

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res.data.projects);
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
            fetchProjects();
        } catch (error) {
            alert('프로젝트 생성 실패');
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