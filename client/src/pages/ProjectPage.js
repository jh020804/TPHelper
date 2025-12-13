import React, { useEffect, useState, useCallback } from 'react';
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

// 배열 내 Task 객체의 유효성을 확인하고 유효한 Task만 반환하는 헬퍼 함수
const filterSafeTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter(t => t && t.id);
}

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    const { setHeaderTitle, setMembers, setCurrentProjectId, socket } = useOutletContext(); 

    const [projectData, setProjectData] = useState(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 1. 프로젝트 상세 정보 로드 함수 (API 호출)
    const fetchProjectDetails = useCallback(async () => {
        if (!token) {
            navigate('/login');
            return;
        }
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data.details;
            
            // 초기 로드 시 null/undefined Task 제거
            const safeTasks = filterSafeTasks(data.tasks);
            setProjectData({ ...data, tasks: safeTasks });
            
            setHeaderTitle(data.project.name);
            setMembers(data.members);
            setCurrentProjectId(projectId);
            setLoading(false);
        } catch (error) {
            console.error("프로젝트 로딩 실패", error);
            setLoading(false);
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
    }, [projectId, token, setHeaderTitle, setMembers, setCurrentProjectId, navigate]);

    // 2. 초기 로딩 및 소켓 설정 (useEffect)
    useEffect(() => {
        fetchProjectDetails();

        if (socket && projectId) {
            socket.emit('joinRoom', projectId);

            const handleTaskUpdated = (updatedTask) => {
                if (!updatedTask || !updatedTask.id) return; 

                setProjectData(prevData => {
                    if (!prevData) return prevData;
                    
                    let newTasks = filterSafeTasks(prevData.tasks); 
                    const taskIndex = newTasks.findIndex(t => t.id === updatedTask.id);
                    
                    if (taskIndex > -1) {
                        const oldTask = newTasks[taskIndex];
                        
                        if (oldTask.status !== updatedTask.status) {
                            newTasks.splice(taskIndex, 1);
                            newTasks.push(updatedTask);
                        } else {
                            newTasks[taskIndex] = updatedTask;
                        }
                    } else {
                        newTasks.push(updatedTask);
                    }
                    
                    const uniqueTasks = Array.from(new Set(newTasks.map(t => t && t.id)))
                                          .map(id => newTasks.find(t => t.id === id));
                    
                    return { ...prevData, tasks: filterSafeTasks(uniqueTasks) }; // 최종 반환 시 헬퍼 함수 사용
                });
                
                setSelectedTask(prevSelected => {
                    if (prevSelected && prevSelected.id === updatedTask.id) {
                        return updatedTask;
                    }
                    return prevSelected;
                });
            };

            socket.on('taskUpdated', handleTaskUpdated);
            
            return () => {
                socket.off('taskUpdated', handleTaskUpdated);
            };
        }
    }, [projectId, fetchProjectDetails, socket]);

    // ----------------------------------------------------------------------
    // Task 추가 로직 (addTask)
    // ----------------------------------------------------------------------
    const addTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            const res = await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { 
                    title: newTaskTitle, 
                    content: '', 
                    status: 'To Do' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setNewTaskTitle('');
            
            const createdTask = res.data.task; 
            
            // Task 생성 즉시 반영 로직
            setProjectData(prevData => {
                if (!prevData) return prevData;
                
                const safeTasks = filterSafeTasks(prevData.tasks); 
                const newTasks = [...safeTasks, createdTask];
                return { ...prevData, tasks: filterSafeTasks(newTasks) }; 
            });
            
        } catch (error) {
            console.error("업무 추가 실패:", error);
            alert('업무 추가 실패: 서버 로그를 확인해주세요.');
        }
    };

    // ----------------------------------------------------------------------
    // 드래그 앤 드롭 로직 (onDragEnd)
    // ----------------------------------------------------------------------
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        
        const safeTasksBeforeDrag = filterSafeTasks(projectData.tasks);
        const taskToUpdate = safeTasksBeforeDrag.find(t => t.id.toString() === draggableId);
        if (!taskToUpdate) return;
        
        const originalStatus = taskToUpdate.status;
        
        // 1. UI 즉시 반영 (낙관적 업데이트)
        const updatedTasks = safeTasksBeforeDrag.map(task => 
            task.id.toString() === draggableId ? { ...task, status: newStatus } : task
        );
        setProjectData(prev => ({ ...prev, tasks: filterSafeTasks(updatedTasks) })); 

        try {
            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { status: newStatus }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("드래그 업데이트 실패", error);
            // 실패 시 원복
            const rollbackTasks = safeTasksBeforeDrag.map(task => 
                task.id.toString() === draggableId ? { ...task, status: originalStatus } : task
            );
            setProjectData(prev => ({ ...prev, tasks: filterSafeTasks(rollbackTasks) })); 
        }
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };
    
    // TaskModal에서 내용이 업데이트된 후 호출됨
    const handleModalUpdate = (updatedTask) => {
        setProjectData(prevData => {
            if (!prevData) return prevData;
            
            const safeTasks = filterSafeTasks(prevData.tasks); 
            const newTasks = safeTasks.map(t => 
                (t.id === updatedTask.id && updatedTask && updatedTask.id) ? updatedTask : t
            );
            return { ...prevData, tasks: filterSafeTasks(newTasks) }; 
        });
        
        setSelectedTask(updatedTask); 
    }


    // ----------------------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------------------
    if (loading) return <div className="loading">로딩 중...</div>;
    
    // 🚨 [최종 안정화] 렌더링 시 사용할 유효한 Task 목록 준비
    const renderableTasks = filterSafeTasks(projectData?.tasks); 

    if (!projectData || !Array.isArray(projectData.tasks)) return <div>데이터 로드 실패 또는 데이터 없음</div>;

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
                        // 유효한 Task 목록에서 필터링
                        const tasksInColumn = renderableTasks
                            .filter(t => t.status === statusKey); 
                        
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
                                            {tasksInColumn
                                                .slice()
                                                .sort((a, b) => b.id - a.id)
                                                .map((task, index) => {
                                                    // 🚨 [궁극의 방어] map 내부에서 다시 한 번 유효성 검사 (199 라인 방어)
                                                    if (!task || !task.id) return null; 

                                                    return (
                                                        // key와 draggableId를 String(task.id)로 명시적 변환
                                                        <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    onClick={() => handleTaskClick(task)}
                                                                >
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
                                                    );
                                                })}
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
                    onUpdate={handleModalUpdate}
                />
            )}
        </div>
    );
}

export default ProjectPage;