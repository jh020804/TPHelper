import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './ProjectPage.css';

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
            alert('프로젝트 정보를 불러오지 못했습니다.');
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

    // --- 🖱️ 드래그 앤 드롭 핸들러 ---
    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;

        // 1. 드롭한 곳이 없거나, 제자리에 놓았으면 무시
        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        // 2. 변경된 상태값 (Destination Column ID)
        const newStatus = destination.droppableId; // 'To Do', 'In Progress', 'Done'

        // 3. UI 즉시 업데이트 (낙관적 업데이트)
        const updatedTasks = projectData.tasks.map(task => {
            if (task.id.toString() === draggableId) {
                return { ...task, status: newStatus };
            }
            return task;
        });

        setProjectData(prev => ({
            ...prev,
            tasks: updatedTasks
        }));

        // 4. 서버에 상태 변경 요청
        try {
            await axios.patch(`${API_URL}/api/tasks/${draggableId}`, 
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`Task ${draggableId} moved to ${newStatus}`);
        } catch (error) {
            console.error('상태 업데이트 실패:', error);
            alert('상태 변경 저장 실패 (새로고침 됩니다)');
            fetchProjectDetails(); // 실패 시 원복
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
                <button 
                    className="chat-link-btn" 
                    onClick={() => navigate(`/chat/${projectId}`)}
                >
                    💬 채팅방
                </button>
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

            {/* --- 🏁 칸반 보드 영역 --- */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {Object.entries(STATUS_COLUMNS).map(([statusKey, statusLabel]) => {
                        // 해당 상태의 태스크만 필터링
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
                                                <Draggable 
                                                    key={task.id} 
                                                    draggableId={task.id.toString()} 
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <div className="task-content">{task.content}</div>
                                                            {task.assignee_name && (
                                                                <div className="task-assignee">
                                                                    👤 {task.assignee_name}
                                                                </div>
                                                            )}
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

            {/* 하단 멤버 섹션 */}
            <div className="project-footer">
                <h3>참여 멤버</h3>
                <div className="member-avatars">
                    {projectData.members.map(member => (
                        <div key={member.id} className="footer-member" title={member.name}>
                            {member.name[0]}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ProjectPage;