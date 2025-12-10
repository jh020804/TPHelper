import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';
import ProjectChatRoom from './ProjectChatRoom';
import TaskModal from '../components/TaskModal';
import './ProjectPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const socket = io(API_URL, {
    withCredentials: true
});

function ProjectPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    
    // 모달 관련 상태
    const [selectedTask, setSelectedTask] = useState(null);

    // 칸반 컬럼 정의
    const columns = {
        'To Do': { title: '할 일', items: [] },
        'In Progress': { title: '진행 중', items: [] },
        'Done': { title: '완료', items: [] }
    };

    // 태스크를 컬럼별로 분류
    tasks.forEach(task => {
        if (columns[task.status]) {
            columns[task.status].items.push(task);
        }
    });

    useEffect(() => {
        fetchProjectData();
        socket.emit('joinRoom', projectId);

        socket.on('taskCreated', (newTask) => {
            setTasks(prev => [...prev, newTask]);
        });
        socket.on('taskUpdated', (updatedTask) => {
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        });
        socket.on('taskDeleted', (deletedTaskId) => {
            setTasks(prev => prev.filter(t => t.id !== parseInt(deletedTaskId)));
        });

        return () => {
            socket.emit('leaveRoom', projectId);
            socket.off('taskCreated');
            socket.off('taskUpdated');
            socket.off('taskDeleted');
        };
    }, [projectId]);

    const fetchProjectData = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProject(res.data.details.project);
            setTasks(res.data.details.tasks);
            setMembers(res.data.details.members);
        } catch (error) {
            console.error('프로젝트 정보 로드 실패', error);
            // 권한 없으면 홈으로
            navigate('/dashboard');
        }
    };

    const handleInvite = async () => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/invite`, 
                { email: inviteEmail },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('초대장을 보냈습니다!');
            setInviteEmail('');
            setShowInvite(false);
        } catch (error) {
            alert('초대 실패: ' + (error.response?.data?.message || '알 수 없는 오류'));
        }
    };

    const handleCreateTask = async (status = 'To Do') => {
        const content = prompt('새 업무 내용을 입력하세요:');
        if (!content) return;

        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/tasks`, 
                { content, status }, // status는 초기엔 보통 To Do지만 확장성을 위해
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // 소켓으로 업데이트되므로 여기서 setTasks 안 해도 됨
        } catch (e) {
            console.error(e);
        }
    };

    const handleOnDragEnd = async (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            // UI를 즉시 업데이트 (낙관적 업데이트)
            const movedTask = tasks.find(t => t.id.toString() === draggableId);
            const updatedTasks = tasks.map(t => 
                t.id.toString() === draggableId ? { ...t, status: destination.droppableId } : t
            );
            setTasks(updatedTasks);

            // 서버에 변경 요청
            const token = localStorage.getItem('token');
            try {
                await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                    { status: destination.droppableId },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } catch (e) {
                console.error('상태 변경 실패', e);
                fetchProjectData(); // 실패 시 롤백
            }
        }
    };

    // 모달 저장 핸들러
    const handleTaskSave = (updatedTask) => {
        // 소켓이 처리하므로 로컬 상태 업데이트는 생략 가능하지만, 빠른 반영을 위해
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    };

    // 모달 삭제 핸들러
    const handleTaskDelete = async (taskId) => {
        if(!window.confirm('정말 삭제하시겠습니까?')) return;
        
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_URL}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 모달 닫기
            setSelectedTask(null);
        } catch (e) {
            alert('삭제 실패');
        }
    };

    if (!project) return <div>로딩 중...</div>;

    return (
        <div className="project-page-container">
            <header className="project-header">
                <div className="header-left">
                    <button onClick={() => navigate('/dashboard')} className="btn-back">← 나가기</button>
                    <h2>{project.name}</h2>
                </div>
                <div className="header-right">
                    <div className="member-list">
                        {members.map(m => (
                            <span key={m.id} className="member-badge" title={m.email}>{m.name[0]}</span>
                        ))}
                    </div>
                    <button onClick={() => setShowInvite(!showInvite)} className="btn-invite">+ 팀원 초대</button>
                </div>
            </header>

            {showInvite && (
                <div className="invite-box">
                    <input 
                        type="email" 
                        placeholder="팀원 이메일" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button onClick={handleInvite}>보내기</button>
                </div>
            )}

            <div className="project-content">
                {/* 왼쪽: 칸반 보드 */}
                <div className="kanban-board">
                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        {Object.entries(columns).map(([columnId, column]) => (
                            <div key={columnId} className="kanban-column">
                                <div className="column-header">
                                    <h3>{column.title}</h3>
                                    <span className="count">{column.items.length}</span>
                                </div>
                                <Droppable droppableId={columnId}>
                                    {(provided) => (
                                        <div 
                                            className="task-list"
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                        >
                                            {column.items.map((task, index) => (
                                                <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                                                    {(provided) => (
                                                        <div 
                                                            className="task-card"
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            onClick={() => setSelectedTask(task)} // 클릭 시 모달 열기
                                                        >
                                                            <div className="task-content">{task.content}</div>
                                                            <div className="task-footer">
                                                                <span className="assignee">
                                                                    {task.assignee_name ? task.assignee_name : '미정'}
                                                                </span>
                                                                {task.due_date && (
                                                                    <span className="due-date">
                                                                        ~{new Date(task.due_date).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            <button className="btn-add-task" onClick={() => handleCreateTask(columnId)}>
                                                + 업무 추가
                                            </button>
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </DragDropContext>
                </div>

                {/* 오른쪽: 채팅창 */}
                <div className="project-chat-section">
                    <ProjectChatRoom projectId={projectId} />
                </div>
            </div>

            {/* 업무 상세 모달 */}
            {selectedTask && (
                <TaskModal 
                    task={selectedTask} 
                    members={members}
                    onClose={() => setSelectedTask(null)}
                    onSave={handleTaskSave}
                    onDelete={handleTaskDelete}
                />
            )}
        </div>
    );
}

export default ProjectPage;