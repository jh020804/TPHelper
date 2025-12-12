import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './MainLayout.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SidebarChatList({ socket, notifications }) {
    const [chatRooms, setChatRooms] = useState([]);
    const { projectId: currentProjectId } = useParams();
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchChatRooms = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/projects`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setChatRooms(res.data.projects);
            } catch (error) {
                console.error('채팅 목록 로드 실패', error);
            }
        };
        fetchChatRooms();
    }, [token]);

    return (
        <div className="sidebar-chat-list">
            {/* 🗑️ 기존 h4 태그 삭제 (MainLayout에서 헤더 처리) */}
            
            <ul className="chat-nav-links" style={{ listStyle: 'none', padding: 0 }}>
                {chatRooms.map((room) => {
                    const notif = notifications[room.id];
                    const hasNew = notif && notif.hasNew;
                    const isActive = String(currentProjectId) === String(room.id);

                    return (
                        <li key={room.id}>
                            <Link 
                                to={`/chat/${room.id}`} 
                                className={`sidebar-link ${isActive ? 'active' : ''} ${hasNew ? 'has-new-message' : ''}`}
                                style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '8px 15px', /* 간격 살짝 조정 */
                                    textDecoration: 'none',
                                    color: isActive ? '#007bff' : '#555',
                                    backgroundColor: isActive ? '#e6f2ff' : 'transparent',
                                    fontWeight: (isActive || hasNew) ? 'bold' : 'normal',
                                    fontSize: '0.95rem'
                                }}
                            >
                                <span className="room-name"># {room.name}</span>
                                
                                {hasNew && !isActive && (
                                    <span style={{ 
                                        backgroundColor: '#ff4444', 
                                        color: 'white', 
                                        fontSize: '10px', 
                                        padding: '2px 6px', 
                                        borderRadius: '10px',
                                        marginLeft: '5px'
                                    }}>
                                        N
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default SidebarChatList;