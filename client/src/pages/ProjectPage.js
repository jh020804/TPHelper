import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskModal from '../components/TaskModal'; // 모달 컴포넌트 불러오기
import './ProjectPage.css';

// 환경 변수 또는 기본 URL 사용
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 칸반 보드 컬럼 정의
const STATUS_COLUMNS = {
    'To Do': '할 일',
    'In Progress': '진행 중',
    'Done': '완료'
};

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    const [projectData, setProjectData] = useState(null);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);

    // 모달 관련 상태
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjectData(res.data.details);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    // 1. 업무 추가 (To Do로 생성)
    const addTask = async () => {
        if (!newTask.trim()) return;
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { content: newTask, status: 'To Do' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewTask('');
            fetchProjectDetails(); // 목록 새로고침
        } catch (error) {
            alert('업무 추가 실패');
        }
    };

    // 2. 드래그 앤 드롭 핸들러
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        
        // UI 즉시 업데이트 (낙관적 업데이트)
        const updatedTasks = projectData.tasks.map(task => 
            task.id.toString() === draggableId ? { ...task, status: newStatus } : task
        );
        setProjectData(prev => ({ ...prev, tasks: updatedTasks }));

        // 서버 전송
        try {
            const task = projectData.tasks.find(t => t.id.toString() === draggableId);
            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { ...task, status: newStatus }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            fetchProjectDetails(); // 에러 시 원복
        }
    };

    // 3. 업무 클릭 시 모달 열기
    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
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

            {/* 업무 추가 입력창 */}
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

            {/* 칸반 보드 영역 */}
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
                                                            onClick={() => handleTaskClick(task)} // 클릭 시 모달 오픈
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

            {/* 하단 멤버 목록 */}
            <div className="project-footer">
                <h3>참여 멤버</h3>
                <div className="member-avatars">
                    {projectData.members.map(member => (
                        <div key={member.id} className="footer-member" title={member.name}>{member.name[0]}</div>
                    ))}
                </div>
            </div>

            {/* 업무 상세 모달 */}
            {isModalOpen && selectedTask && (
                <TaskModal 
                    task={selectedTask}
                    members={projectData.members}
                    onClose={() => setIsModalOpen(false)}
                    onUpdate={fetchProjectDetails} // 수정/삭제 후 목록 갱신
                />
            )}
        </div>
    );
}

export default ProjectPage;