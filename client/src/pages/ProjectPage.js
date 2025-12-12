import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskModal from '../components/TaskModal';
import './ProjectPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const STATUS_COLUMNS = {
    'To Do': '할 일',
    'In Progress': '진행 중',
    'Done': '완료'
};

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    // 🚨 1. MainLayout과 소통하기 위한 Context 가져오기
    const { setHeaderTitle, setMembers, setCurrentProjectId } = useOutletContext();

    const [projectData, setProjectData] = useState(null);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);

    // 모달 관련 상태
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 🚨 2. 초대 기능용 상태 추가
    const [inviteEmail, setInviteEmail] = useState('');

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const data = res.data.details;
            setProjectData(data);
            
            // 🚨 3. 레이아웃(오른쪽 사이드바)에 현재 프로젝트 정보 전달
            // 이걸 해야 오른쪽 사이드바가 나오고 거기서도 초대가 됩니다.
            setHeaderTitle(data.project.name);
            setMembers(data.members);
            setCurrentProjectId(projectId);
            
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
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

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        
        const updatedTasks = projectData.tasks.map(task => 
            task.id.toString() === draggableId ? { ...task, status: newStatus } : task
        );
        setProjectData(prev => ({ ...prev, tasks: updatedTasks }));

        try {
            const task = projectData.tasks.find(t => t.id.toString() === draggableId);
            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { ...task, status: newStatus }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            fetchProjectDetails();
        }
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    // 🚨 4. 팀원 초대 함수
    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/invite`, 
                { email: inviteEmail }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('초대가 완료되었습니다.');
            setInviteEmail('');
            fetchProjectDetails(); // 멤버 목록 갱신
        } catch (error) {
            alert('초대 실패: 이메일을 확인하거나 이미 멤버인지 확인하세요.');
        }
    };

    if (loading) return <div className="loading">로딩 중...</div>;
    if (!projectData) return <div>데이터 없음</div>;

    return (
        <div className="project-container">
            <header className="project-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard')}>← 뒤로</button>
                    <h2 className="project-title">{projectData.project.name}</h2>
                </div>
                <button className="chat-link-btn" onClick={() => navigate(`/chat/${projectId}`)}>💬 채팅방</button>
            </header>

            <div className="task-input-section">
                <input 
                    type="text" 
                    className="task-input"
                    value={newTask} 
                    onChange={(e) => setNewTask(e.target.value)} 
                    placeholder="새로운 할 일을 입력하세요"
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                />
                <button onClick={addTask} className="add-task-btn">추가</button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.entries(STATUS_COLUMNS).map(([statusKey, statusLabel]) => {
                        const tasksInColumn = projectData.tasks.filter(t => t.status === statusKey);
                        return (
                            <div key={statusKey} className="kanban-column">
                                <h3 className={`column-header header-${statusKey.replace(' ', '-').toLowerCase()}`}>
                                    {statusLabel} <span className="count-badge">{tasksInColumn.length}</span>
                                </h3>
                                <Droppable droppableId={statusKey}>
                                    {(provided, snapshot) => (
                                        <div
                                            className={`task-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        >
                                            {tasksInColumn.map((task, index) => (
                                                <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => handleTaskClick(task)}
                                                        >
                                                            <div className="task-content">{task.content}</div>
                                                            <div className="task-meta">
                                                                {task.assignee_name && <span className="task-assignee">👤 {task.assignee_name}</span>}
                                                                {task.due_date && <span className="task-date">📅 {task.due_date.split('T')[0]}</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* 🚨 5. 하단 멤버 섹션 + 초대 입력창 */}
            <div className="project-footer">
                <div className="footer-left">
                    <h3>참여 멤버 ({projectData.members.length})</h3>
                    <div className="member-avatars">
                        {projectData.members.map(member => (
                            <div key={member.id} className="footer-member" title={member.name}>{member.name[0]}</div>
                        ))}
                    </div>
                </div>
                
                {/* 상세 페이지에서 직접 초대하는 입력창 */}
                <div className="footer-invite">
                    <input 
                        type="email" 
                        placeholder="이메일로 팀원 초대" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="invite-input-small"
                    />
                    <button onClick={handleInvite} className="invite-btn-small">초대</button>
                </div>
            </div>

            {isModalOpen && selectedTask && (
                <TaskModal 
                    task={selectedTask}
                    members={projectData.members}
                    onClose={() => setIsModalOpen(false)}
                    onUpdate={fetchProjectDetails}
                />
            )}
        </div>
    );
}

export default ProjectPage;