import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { FaPaperPlane } from 'react-icons/fa';
import './ChatRoomPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ChatRoomPage() {
    const { projectId } = useParams();
    const { setHeaderTitle, setMembers, setCurrentProjectId, socket, myUserName } = useOutletContext();
    
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef(null);
    const token = localStorage.getItem('token');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 1. 데이터 로드 (API)
    const fetchChatData = useCallback(async () => {
        try {
            const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            const project = projectRes.data.details.project;
            setHeaderTitle(`팀 채팅: ${project.name}`);
            setMembers(projectRes.data.details.members);
            setCurrentProjectId(projectId);

            const chatRes = await axios.get(`${API_URL}/api/projects/${projectId}/chat`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setMessages(chatRes.data);
            setTimeout(scrollToBottom, 100);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    }, [projectId, setHeaderTitle, setMembers, setCurrentProjectId, token]);

    useEffect(() => {
        fetchChatData();
    }, [fetchChatData]);
    
    // 2. 소켓 리스너 (실시간 수신)
    useEffect(() => {
        if (!socket) return;

        // 방 입장
        socket.emit('joinRoom', projectId);

        const handleReceiveMessage = (data) => {
            // 🚨 핵심 수정: 변수명 불일치 해결 (projectId 또는 project_id 확인)
            const msgProjectId = data.projectId || data.project_id;
            
            if (String(msgProjectId) === String(projectId)) {
                setMessages((prev) => [...prev, data]);
                setTimeout(scrollToBottom, 100);
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [socket, projectId]);

    // 3. 메시지 전송
    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        try {
            // (1) DB 저장 요청
            const response = await axios.post(`${API_URL}/api/projects/${projectId}/chat`, 
                { content: messageInput }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const savedMessage = response.data;

            // (2) 소켓 전송
            if (socket) {
                // 🚨 핵심 수정: 서버가 방을 찾을 수 있도록 projectId를 명시적으로 추가해서 보냄
                socket.emit('sendMessage', { 
                    ...savedMessage, 
                    projectId: projectId // 이거 없으면 실시간 안됨!
                });
            }

            setMessageInput('');
        } catch (error) {
            console.error('전송 실패:', error);
            alert('메시지 전송 실패');
        }
    };

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const isMentioned = (content) => content && content.includes(`@${myUserName}`);
    const isMyMessage = (msgName) => msgName === myUserName;

    return (
        <div className="chat-room-page">
            <div className="messages-container">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-row ${isMyMessage(msg.user_name) ? 'my-message' : 'other-message'}`}>
                        <div className={`message-bubble ${isMentioned(msg.content) ? 'message-mentioned' : ''}`}>
                            {!isMyMessage(msg.user_name) && <div className="message-sender">{msg.user_name}</div>}
                            <div className="message-content">{msg.content}</div>
                            <div className="message-time">{formatTime(msg.timestamp)}</div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="input-area">
                <input
                    type="text"
                    className="message-input"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="메시지를 입력하세요..."
                />
                <button 
                    className="send-button" 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                >
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
}

export default ChatRoomPage;