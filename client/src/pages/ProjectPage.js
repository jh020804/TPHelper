import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ProjectPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [projectData, setProjectData] = useState(null);
    const [newTask, setNewTask] = useState('');

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjectData(res.data.details);
        } catch (error) {
            alert('정보를 불러오지 못했습니다.');
        }
    };

    const addTask = async () => {
        if (!newTask.trim()) return;
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { content: newTask, status: 'To Do' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewTask('');
            fetchProjectDetails();
        } catch (error) {
            alert('업무 추가 실패');
        }
    };

    if (!projectData) return <div className="loading">로딩 중...</div>;

    return (
        <div className="project-container">
            <header className="project-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard')}>← 뒤로</button>
                    <h2 className="project-title">{projectData.project.name}</h2>
                </div>
                <button 
                    className="chat-link-btn" 
                    onClick={() => navigate(`/chat/${projectId}`)}
                >
                    💬 프로젝트 채팅방
                </button>
            </header>

            <main className="project-content">
                <div className="task-section">
                    <h3>할 일 목록 (Tasks)</h3>
                    <div className="task-input-wrapper">
                        <input 
                            type="text" 
                            className="task-input"
                            value={newTask} 
                            onChange={(e) => setNewTask(e.target.value)} 
                            placeholder="할 일을 입력하고 추가하세요"
                        />
                        <button onClick={addTask} className="add-task-btn">추가</button>
                    </div>

                    <div className="task-list">
                        {projectData.tasks.length === 0 && <p className="no-tasks">등록된 업무가 없습니다.</p>}
                        {projectData.tasks.map(task => (
                            <div key={task.id} className={`task-item status-${task.status.toLowerCase().replace(' ', '-')}`}>
                                <div className="task-content">
                                    <p>{task.content}</p>
                                    <span className="task-badge">{task.status}</span>
                                </div>
                                {/* <div className="task-assignee">{task.assignee_name || '미배정'}</div> */}
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="member-section">
                    <h3>멤버 ({projectData.members.length})</h3>
                    <ul className="member-list">
                        {projectData.members.map(member => (
                            <li key={member.id} className="member-item">
                                <span className="member-avatar">{member.name[0]}</span>
                                <span className="member-name">{member.name}</span>
                            </li>
                        ))}
                    </ul>
                </aside>
            </main>
        </div>
    );
}

export default ProjectPage;