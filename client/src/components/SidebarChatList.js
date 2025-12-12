import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './MainLayout.css'; // CSS 스타일 공유

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SidebarChatList({ socket, notifications }) {
    const [chatRooms, setChatRooms] = useState([]);
    const { projectId: currentProjectId } = useParams(); // 현재 보고 있는 채팅방 ID
    const token = localStorage.getItem('token');

    // 채팅방 목록 불러오기
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
            <h4 className="sidebar-subtitle" style={{ padding: '0 20px', fontSize: '0.85rem', color: '#888', marginTop: '15px' }}>
                채팅 목록
            </h4>
            <ul className="chat-nav-links" style={{ listStyle: 'none', padding: 0 }}>
                {chatRooms.map((room) => {
                    // 🚨 알림 상태 확인 (이 부분이 핵심!)
                    const notif = notifications[room.id];
                    const hasNew = notif && notif.hasNew; // 새 메시지 여부
                    const count = notif ? notif.count : 0; // 안 읽은 메시지 수 (선택 사항)
                    
                    // 현재 보고 있는 방인지 확인
                    const isActive = String(currentProjectId) === String(room.id);

                    return (
                        <li key={room.id}>
                            <Link 
                                to={`/chat/${room.id}`} 
                                // 🚨 has-new-message 클래스를 조건부로 추가
                                className={`sidebar-link ${isActive ? 'active' : ''} ${hasNew ? 'has-new-message' : ''}`}
                                style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '10px 20px',
                                    textDecoration: 'none',
                                    color: isActive ? '#007bff' : '#333',
                                    backgroundColor: isActive ? '#e6f2ff' : 'transparent',
                                    fontWeight: (isActive || hasNew) ? 'bold' : 'normal'
                                }}
                            >
                                <span className="room-name"># {room.name}</span>
                                
                                {/* 🔴 새 메시지 뱃지 (N) */}
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