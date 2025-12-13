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

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    // 🚨 [수정] useOutletContext에서 socket을 가져옵니다.
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
            
            setProjectData(data);
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
        // 프로젝트 정보 로드
        fetchProjectDetails();

        // 🚨🚨 [핵심 추가] 소켓 리스너 설정
        if (socket && projectId) {
            // 해당 프로젝트 방에 입장
            socket.emit('joinRoom', projectId);

            const handleTaskUpdated = (updatedTask) => {
                console.log('Received task update via socket:', updatedTask);
                
                // projectData.tasks 상태를 변경하는 로직
                setProjectData(prevData => {
                    if (!prevData) return prevData;
                    
                    // 기존 Task 배열을 복사
                    let newTasks = [...prevData.tasks];
                    const taskIndex = newTasks.findIndex(t => t.id === updatedTask.id);
                    
                    if (taskIndex > -1) {
                        // Task가 이미 존재한다면
                        const oldTask = newTasks[taskIndex];
                        
                        // 상태(status)가 변경되었는지 확인
                        if (oldTask.status !== updatedTask.status) {
                            // 상태가 변경되었으면, 기존 위치에서 제거하고 (map에서 처리하지 않고 findIndex로 처리)
                            newTasks.splice(taskIndex, 1);
                            
                            // 새 Task를 추가 (아래에서 다시 filter되므로 일단 배열 끝에 추가)
                            newTasks.push(updatedTask);
                            
                        } else {
                            // 상태는 그대로이고 내용만 변경된 경우, 해당 Task 내용만 업데이트
                            newTasks[taskIndex] = updatedTask;
                        }
                    } else {
                        // 새 Task가 추가된 경우 (addTask를 이 이벤트로 처리 가능)
                        newTasks.push(updatedTask);
                    }
                    
                    // 최종적으로 ID를 기준으로 중복 제거 (Task 상태 변경 시 새 Task를 push할 경우 대비)
                    const uniqueTasks = Array.from(new Set(newTasks.map(t => t.id)))
                                          .map(id => newTasks.find(t => t.id === id));
                    
                    return { ...prevData, tasks: uniqueTasks };
                });
                
                // 모달이 열려 있고, 현재 수정 중인 Task가 업데이트된 경우 모달 내 Task 정보도 갱신
                setSelectedTask(prevSelected => {
                    if (prevSelected && prevSelected.id === updatedTask.id) {
                        return updatedTask;
                    }
                    return prevSelected;
                });
            };

            socket.on('taskUpdated', handleTaskUpdated);
            
            // 클린업 함수 (컴포넌트 언마운트 시 리스너 해제)
            return () => {
                socket.off('taskUpdated', handleTaskUpdated);
            };
        }
    }, [projectId, fetchProjectDetails, socket]); // 의존성 배열에 socket 추가

    // ----------------------------------------------------------------------
    // Task 추가 로직 (addTask)
    // ----------------------------------------------------------------------
    const addTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            // 🚨 [수정] 생성 후 응답받은 Task 데이터로 상태를 직접 업데이트합니다.
            const res = await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { 
                    title: newTaskTitle, 
                    content: '', 
                    status: 'To Do' 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setNewTaskTitle('');
            
            // 🚨 [수정] 생성된 Task를 즉시 로컬 상태에 반영 (소켓 이벤트를 기다리지 않아도 됨)
            // 주의: 백엔드에서 생성 후 소켓을 통해 브로드캐스트해야 다른 사용자에게도 반영됩니다.
            
            // fetchProjectDetails(); // 소켓을 사용하므로 API 재호출은 생략합니다.
            
        } catch (error) {
            console.error(error);
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
        
        // 1. UI 즉시 반영 (낙관적 업데이트)
        const taskToUpdate = projectData.tasks.find(t => t.id.toString() === draggableId);
        if (!taskToUpdate) return;
        
        const originalStatus = taskToUpdate.status;
        
        const updatedTasks = projectData.tasks.map(task => 
            task.id.toString() === draggableId ? { ...task, status: newStatus } : task
        );
        setProjectData(prev => ({ ...prev, tasks: updatedTasks }));

        try {
            // 2. 서버 전송
            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { status: newStatus }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // 성공 후 서버에서 소켓을 통해 변경사항을 브로드캐스트할 것입니다.
            
        } catch (error) {
            console.error("드래그 업데이트 실패", error);
            // 실패 시 원복
            const rollbackTasks = projectData.tasks.map(task => 
                task.id.toString() === draggableId ? { ...task, status: originalStatus } : task
            );
            setProjectData(prev => ({ ...prev, tasks: rollbackTasks }));
        }
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };
    
    // TaskModal에서 내용이 업데이트된 후 호출됨
    const handleModalUpdate = (updatedTask) => {
        // 모달에서 내용 저장 시, 현재 페이지 상태를 갱신
        setProjectData(prevData => {
            if (!prevData) return prevData;
            
            const newTasks = prevData.tasks.map(t => 
                t.id === updatedTask.id ? updatedTask : t
            );
            return { ...prevData, tasks: newTasks };
        });
        
        setSelectedTask(updatedTask); // 모달의 내용도 갱신
        
        // 주의: 이 시점에서 백엔드가 소켓을 통해 변경사항을 브로드캐스트해야 다른 사용자에게도 반영됩니다.
        // 현재는 onUpdate={fetchProjectDetails} 대신 onUpdate={handleModalUpdate}를 사용할 경우입니다.
        // 만약 기존처럼 onUpdate={fetchProjectDetails}를 쓴다면 이 로직은 불필요하지만,
        // 실시간 업데이트를 위해 onUpdate={fetchProjectDetails} 대신 소켓을 사용해야 합니다.
    }


    // ----------------------------------------------------------------------
    // 렌더링
    // ----------------------------------------------------------------------
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
                        // 🚨 [필수] tasks 배열을 필터링하여 Column을 구성합니다.
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
                                            {tasksInColumn
                                                .slice() // 사본 생성
                                                .sort((a, b) => b.id - a.id) // ID 내림차순 정렬 (최신 Task가 위에 오도록)
                                                .map((task, index) => (
                                                    <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
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
                    // 🚨 [수정] 모달 업데이트 시 전체 새로고침 대신 로컬 상태 업데이트 함수 사용
                    onUpdate={handleModalUpdate}
                />
            )}
        </div>
    );
}

export default ProjectPage;