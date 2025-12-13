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
    
    // 🚨 [추가] myUserId 추출 로직
    let myUserId = null;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            myUserId = payload.userId;
        } catch (e) {
            console.error("Token decoding failed:", e);
        }
    }
    
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
                
                // 🚨 [핵심 수정] 내가 생성/수정한 이벤트는 무시하여 중복 출력을 방지합니다.
                // (내가 보낸 이벤트는 HTTP 응답 후 로컬 상태에 이미 반영되었으므로)
                if (myUserId && updatedTask.created_by && updatedTask.created_by === myUserId) {
                    console.log("Filtered my own task update from socket:", updatedTask.id);
                    return;
                }
                
                if (!updatedTask || !updatedTask.id) return; 

                setProjectData(prevData => {
                    if (!prevData) return prevData;
                    
                    let newTasks = filterSafeTasks(prevData.tasks); 
                    const taskIndex = newTasks.findIndex(t => t.id === updatedTask.id);
                    
                    if (taskIndex > -1) {
                        const oldTask = newTasks[taskIndex];
                        
                        // 상태가 변경되었으면 기존 위치에서 삭제하고 리스트 끝에 다시 추가
                        if (oldTask.status !== updatedTask.status) {
                            newTasks.splice(taskIndex, 1);
                            newTasks.push(updatedTask);
                        } else {
                            // 상태가 같으면 데이터만 업데이트
                            newTasks[taskIndex] = updatedTask;
                        }
                    } else {
                        // Task가 목록에 없으면 (다른 사람이 생성했거나 새로운 Task) 추가
                        newTasks.push(updatedTask);
                    }
                    
                    const uniqueTasks = Array.from(new Set(newTasks.map(t => t && t.id)))
                                          .map(id => newTasks.find(t => t.id === id));
                    
                    return { ...prevData, tasks: filterSafeTasks(uniqueTasks) };
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
    }, [projectId, fetchProjectDetails, socket, myUserId]); // 의존성 배열에 myUserId 추가

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
            
            // 🚨 HTTP 응답을 받은 후 로컬 상태에 직접 추가 (첫 번째 출력)
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
        if (!updatedTask || !updatedTask.id) {
             console.error("Modal updated with invalid task data:", updatedTask);
             return;
        }

        setProjectData(prevData => {
            if (!prevData) return prevData;
            
            const safeTasks = filterSafeTasks(prevData.tasks); 
            
            const newTasks = safeTasks.map(t => 
                (t.id === updatedTask.id) ? updatedTask : t
            );
            
            return { ...prevData, tasks: filterSafeTasks(newTasks) }; 
        });
        
        setSelectedTask(updatedTask); 
    }


    // ----------------------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------------------
    if (loading) return <div className="loading">로딩 중...</div>;
    
    const renderableTasks = filterSafeTasks(projectData?.tasks); 
    const isModalVisible = isModalOpen && selectedTask && selectedTask.id;

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
                                                .sort((a, b) => {
                                                    if (!a || !a.id) return 1; 
                                                    if (!b || !b.id) return -1; 
                                                    return b.id - a.id; 
                                                })
                                                .map((task, index) => {
                                                    if (!task || !task.id) return null; 

                                                    return (
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

            {isModalVisible && (
                <TaskModal 
                    task={selectedTask}
                    members={projectData.members}
                    onClose={() => {
                         setIsModalOpen(false);
                         setSelectedTask(null);
                    }}
                    onUpdate={handleModalUpdate}
                />
            )}
        </div>
    );
}

export default ProjectPage;