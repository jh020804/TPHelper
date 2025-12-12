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
    
    const { setHeaderTitle, setMembers, setCurrentProjectId } = useOutletContext();

    const [projectData, setProjectData] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(true);
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
            const data = res.data.details;
            
            console.log("서버에서 받은 데이터:", data.tasks); // 🚨 디버깅: 여기서 title이 있는지 확인하세요
            
            setProjectData(data);
            setHeaderTitle(data.project.name);
            setMembers(data.members);
            setCurrentProjectId(projectId);
            setLoading(false);
        } catch (error) {
            console.error("프로젝트 로딩 실패", error);
            setLoading(false);
        }
    };

    const addTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            console.log("할 일 추가 요청:", { title: newTaskTitle, status: 'To Do' }); // 🚨 디버깅
            
            await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { 
                    title: newTaskTitle,  // 제목 필드
                    content: '',          // 내용은 빈 값으로 시작
                    status: 'To Do' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewTaskTitle('');
            fetchProjectDetails();
        } catch (error) {
            console.error(error);
            alert('업무 추가 실패: 서버 로그를 확인해주세요.');
        }
    };

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        
        // 1. UI 즉시 반영 (낙관적 업데이트)
        const updatedTasks = projectData.tasks.map(task => 
            task.id.toString() === draggableId ? { ...task, status: newStatus } : task
        );
        setProjectData(prev => ({ ...prev, tasks: updatedTasks }));

        try {
            // 2. 서버 전송 (기존 데이터 유지 필수)
            const taskToUpdate = projectData.tasks.find(t => t.id.toString() === draggableId);
            if (!taskToUpdate) return;

            console.log("드래그 업데이트 요청:", { ...taskToUpdate, status: newStatus }); // 🚨 디버깅

            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { 
                    ...taskToUpdate, // 기존 title, content 유지
                    status: newStatus 
                }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("드래그 업데이트 실패", error);
            fetchProjectDetails(); // 실패 시 원복
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
                    placeholder="할 일 제목을 입력하세요"
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
                                                            {/* 🚨 화면 표시: title이 없으면 content라도 보여주게 처리 */}
                                                            <div className="task-content" style={{ fontWeight: 'bold' }}>
                                                                {task.title || "(제목 없음)"}
                                                            </div>
                                                            <div className="task-meta">
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