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
    
    // MainLayout과 소통하기 위한 Context (오른쪽 사이드바 제어용)
    const { setHeaderTitle, setMembers, setCurrentProjectId } = useOutletContext();

    const [projectData, setProjectData] = useState(null);
    // 🚨 변수명 의미 명확화: newTask -> newTaskTitle
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(true);

    // 모달 관련 상태
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchProjectDetails();
        // eslint-disable-next-line
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const data = res.data.details;
            setProjectData(data);
            
            // MainLayout(오른쪽 사이드바)에 정보 전달
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
        if (!newTaskTitle.trim()) return;
        try {
            // 🚨 수정: content가 아니라 title로 전송
            await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { 
                    title: newTaskTitle, // 제목으로 저장
                    content: '',         // 내용은 비워둠 (상세에서 입력)
                    status: 'To Do' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewTaskTitle('');
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
                    value={newTaskTitle} 
                    onChange={(e) => setNewTaskTitle(e.target.value)} 
                    placeholder="할 일 제목을 입력하세요" // 🚨 플레이스홀더 변경
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
                                                            {/* 🚨 수정: content 대신 title 표시 */}
                                                            <div className="task-content" style={{ fontWeight: 'bold' }}>
                                                                {task.title}
                                                            </div>
                                                            
                                                            <div className="task-meta">
                                                                {/* 내용이 있으면 아이콘 표시 (선택사항) */}
                                                                {task.content && <span style={{ marginRight: '5px' }}>📝</span>}
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