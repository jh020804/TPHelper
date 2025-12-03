import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './ProjectPage.css';
import TaskModal from '../components/TaskModal';

const formatCardDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const TaskColumn = ({ title, id, taskList, setSelectedTask, children }) => {
    return (
        <Droppable droppableId={id}>
            {(provided, snapshot) => (
                <div 
                    className="kanban-column" 
                    id={id}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ backgroundColor: snapshot.isDraggingOver ? '#e3e5e8' : '#f4f5f7' }}
                >
                    <h3>{title}</h3>
                    {children}
                    {taskList.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    className="kanban-card"
                                    onClick={() => setSelectedTask(task)}
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                        ...provided.draggableProps.style,
                                        opacity: snapshot.isDragging ? 0.8 : 1,
                                        transform: snapshot.isDragging ? provided.draggableProps.style.transform + ' rotate(2deg)' : provided.draggableProps.style.transform
                                    }}
                                >
                                    <p>{task.content}</p>
                                    <div className="card-meta">
                                        {task.due_date && <span className="card-due-date">🗓 {formatCardDate(task.due_date)}</span>}
                                        {task.assignee_name && <span className="card-assignee">👤 {task.assignee_name}</span>}
                                    </div>
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    );
};

function ProjectPage() {
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setLocalMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [newTaskContent, setNewTaskContent] = useState('');
    const [newAssigneeId, setNewAssigneeId] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    
    const [selectedTask, setSelectedTask] = useState(null); 
    const [currentUserId, setCurrentUserId] = useState(null);

    const { projectId } = useParams();
    const navigate = useNavigate();
    
    // ‼️ MainLayout에서 socket을 받아옵니다.
    const { setHeaderTitle, setMembers, setCurrentProjectId, socket } = useOutletContext(); 

    // 1. 데이터 로딩
    const fetchProjectDetails = async () => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            setCurrentUserId(decoded.userId);
        } catch (e) {}

        try {
            const response = await axios.get(`https://tphelper.onrender.com
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const projectDetails = response.data.details.project;
            setProject(projectDetails);
            setTasks(response.data.details.tasks);
            setLocalMembers(response.data.details.members);
            setLoading(false);
            
            setHeaderTitle(projectDetails.name);
            setMembers(response.data.details.members);
            setCurrentProjectId(projectId);
            
        } catch (err) {
            console.error('로딩 실패:', err);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                navigate('/');
            }
            setError('불러오기 실패');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjectDetails();
        return () => {
            setHeaderTitle('');
            setMembers([]);
            setCurrentProjectId(null);
        };
    }, [projectId, navigate, setHeaderTitle, setMembers, setCurrentProjectId]); 

    // --- ‼️ 2. 소켓 리스너 설정 (실시간 동기화 핵심) ---
    useEffect(() => {
        if (!socket) return;

        // 방 입장 (MainLayout에서 이미 했을 수도 있지만 안전하게 한번 더)
        socket.emit('joinRoom', projectId);

        // (1) 업무 생성됨
        const handleTaskCreated = (newTask) => {
            // 이미 목록에 있는지 확인 (중복 방지)
            setTasks(prev => {
                if (prev.find(t => t.id === newTask.id)) return prev;
                return [...prev, newTask];
            });
        };

        // (2) 업무 수정됨 (상태 변경, 내용 변경 등)
        const handleTaskUpdated = (updatedTask) => {
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        };

        // (3) 업무 삭제됨
        const handleTaskDeleted = (taskId) => {
            setTasks(prev => prev.filter(t => t.id !== Number(taskId))); // ID 타입 변환 주의
        };

        socket.on('taskCreated', handleTaskCreated);
        socket.on('taskUpdated', handleTaskUpdated);
        socket.on('taskDeleted', handleTaskDeleted);

        return () => {
            socket.off('taskCreated', handleTaskCreated);
            socket.off('taskUpdated', handleTaskUpdated);
            socket.off('taskDeleted', handleTaskDeleted);
        };
    }, [socket, projectId]);
    // ----------------------------------------------------


    // 드래그 종료 (상태 변경)
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        
        // 1. 낙관적 업데이트 (내 화면 먼저 바꿈 - 드래그감 향상)
        const updatedTasks = tasks.map(task => {
            if (String(task.id) === draggableId) {
                return { ...task, status: newStatus };
            }
            return task;
        });
        setTasks(updatedTasks);

        // 2. 서버 전송 (서버가 방송하면 handleTaskUpdated가 실행되어 덮어씀)
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`https://tphelper.onrender.com
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("상태 변경 실패:", error);
            fetchProjectDetails(); // 실패 시 롤백
        }
    };

    // 업무 생성 요청
    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTaskContent.trim()) return;

        const token = localStorage.getItem('token');
        try {
            await axios.post(
                `https://tphelper.onrender.com
                { 
                    content: newTaskContent,
                    assignee_id: newAssigneeId || null,
                    due_date: newDueDate || null
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // ‼️ (수정됨) 여기서 수동으로 setTasks 하지 않음! 소켓 이벤트를 기다림.
            
            setNewTaskContent('');
            setNewAssigneeId('');
            setNewDueDate('');
        } catch (err) {
            alert('생성 실패');
        }
    };

    const handleDeleteProject = async () => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`https://tphelper.onrender.com
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('삭제되었습니다.');
            navigate('/');
        } catch (err) {
            alert('삭제 실패');
        }
    };

    const handleTaskUpdate = (updatedTask) => {
        // 모달에서 저장했을 때도 소켓이 방송해주므로, 
        // 여기서 수동 업데이트 안 해도 되지만, 즉각적인 반응을 위해 남겨둘 수 있음.
        // 다만 소켓 로직과 충돌하지 않도록 주의. (여기서는 일단 둠)
        setTasks(tasks.map(task => task.id === updatedTask.id ? updatedTask : task));
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('삭제하시겠습니까?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`https://tphelper.onrender.com
                headers: { Authorization: `Bearer ${token}` }
            });
            // ‼️ (수정됨) 수동 setTasks 제거. 소켓 기다림.
            setSelectedTask(null); 
        } catch (err) {
            alert('삭제 실패');
        }
    };
    
    if (loading) return <div className="loading">로딩 중...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="kanban-board-container">
            <div className="project-controls">
                {project && project.owner_id === currentUserId && (
                    <button onClick={handleDeleteProject} className="btn-delete-project">
                        프로젝트 삭제
                    </button>
                )}
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    <TaskColumn title="업무 내용" id="To Do" taskList={tasks.filter(t => t.status === 'To Do')} setSelectedTask={setSelectedTask}>
                        <form onSubmit={handleCreateTask} className="add-task-form">
                            <textarea value={newTaskContent} onChange={(e) => setNewTaskContent(e.target.value)} placeholder="새 업무 내용" rows="3" />
                            <div className="task-form-extras">
                                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                                <select value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)}>
                                    <option value="">담당자 없음</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <button type="submit">추가</button>
                        </form>
                    </TaskColumn>

                    <TaskColumn title="진행 중" id="In Progress" taskList={tasks.filter(t => t.status === 'In Progress')} setSelectedTask={setSelectedTask} />
                    <TaskColumn title="완료" id="Done" taskList={tasks.filter(t => t.status === 'Done')} setSelectedTask={setSelectedTask} />
                </div>
            </DragDropContext>

            {selectedTask && (
                <TaskModal 
                    task={selectedTask}
                    members={members}
                    onClose={() => setSelectedTask(null)}
                    onSave={handleTaskUpdate}
                    onDelete={handleDeleteTask}
                />
            )}
        </div>
    );
}

export default ProjectPage;