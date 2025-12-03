import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
// ‼️ 드래그 앤 드롭 라이브러리 import
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function SidebarChatList({ socket, notifications }) {
    const [projects, setProjects] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchProjects = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/projects', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                // ‼️ 서버에서 가져온 프로젝트 목록
                const fetchedProjects = response.data.projects;

                // ‼️ LocalStorage에 저장된 순서 불러오기
                const savedOrder = localStorage.getItem('projectOrder');
                
                if (savedOrder) {
                    const orderArray = JSON.parse(savedOrder);
                    // 저장된 ID 순서대로 정렬
                    fetchedProjects.sort((a, b) => {
                        const indexA = orderArray.indexOf(String(a.id));
                        const indexB = orderArray.indexOf(String(b.id));
                        // 저장된 순서에 없으면 뒤로 보냄
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                    });
                }

                setProjects(fetchedProjects);

                if (socket) {
                    fetchedProjects.forEach(project => {
                        socket.emit('joinRoom', String(project.id));
                    });
                }

            } catch (error) {
                console.error('프로젝트 로딩 실패:', error);
            }
        };

        fetchProjects();
    }, [navigate, socket]);

    // ‼️ 드래그가 끝났을 때 실행되는 함수
    const handleOnDragEnd = (result) => {
        // 드래그가 리스트 밖에서 끝났으면 무시
        if (!result.destination) return;

        // 배열의 순서 재배치 로직
        const items = Array.from(projects);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        // 상태 업데이트 (화면 즉시 반영)
        setProjects(items);

        // ‼️ 변경된 순서(ID 배열)를 LocalStorage에 저장
        const idOrder = items.map(item => String(item.id));
        localStorage.setItem('projectOrder', JSON.stringify(idOrder));
    };

    return (
        <div className="sidebar-chat-list">
            <h4>
                <Link to="/" className="back-to-projects">← 모든 프로젝트</Link>
            </h4>
            <p>참여 중인 프로젝트</p>
            
            {/* ‼️ 드래그 앤 드롭 영역 시작 */}
            <DragDropContext onDragEnd={handleOnDragEnd}>
                <Droppable droppableId="projects">
                    {(provided) => (
                        <ul 
                            {...provided.droppableProps} 
                            ref={provided.innerRef}
                            style={{ padding: 0, margin: 0, listStyle: 'none' }}
                        >
                            {projects.map((project, index) => {
                                const notif = notifications[project.id] || { count: 0, hasNew: false };
                                
                                return (
                                    <Draggable 
                                        key={project.id} 
                                        draggableId={String(project.id)} 
                                        index={index}
                                    >
                                        {(provided, snapshot) => (
                                            <li 
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                style={{
                                                    ...provided.draggableProps.style,
                                                    // 드래그 중일 때 약간 투명하게 효과
                                                    opacity: snapshot.isDragging ? 0.5 : 1,
                                                    background: snapshot.isDragging ? '#e0e0e0' : 'transparent',
                                                    borderRadius: '4px'
                                                }}
                                            >
                                                <Link 
                                                    to={`/chat/${project.id}`}
                                                    className={notif.hasNew ? 'has-new-message' : ''}
                                                    // 드래그 시 링크 클릭 방지 (선택 사항)
                                                    onClick={e => {
                                                        if (snapshot.isDragging) e.preventDefault();
                                                    }}
                                                >
                                                    {project.name}
                                                    
                                                    {notif.count > 0 && (
                                                        <span className="mention-badge">{notif.count}</span>
                                                    )}
                                                </Link>
                                            </li>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </ul>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
}

export default SidebarChatList;