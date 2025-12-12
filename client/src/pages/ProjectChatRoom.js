import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ProjectChatRoom.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ProjectChatRoom() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    // 로컬 스토리지에 저장된 내 이름 (메시지 구분용)
    const myName = localStorage.getItem('userName'); 
    
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null); // 자동 스크롤용

    // 메시지 폴링 (3초마다)
    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [projectId]);

    // 새 메시지 오면 자동 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/projects/${projectId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(res.data.messages);
        } catch (error) {
            console.error('채팅 로드 실패');
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        // (현재 백엔드에는 메시지 저장 API가 없으므로 UI 테스트용 로그만 출력하거나, 
        //  추후 socket.io 또는 POST API 구현 시 여기에 작성)
        console.log("전송:", newMessage);
        setNewMessage('');
        // 임시로 화면에 추가 (백엔드 완성 전 테스트용)
        // setMessages([...messages, { id: Date.now(), sender_name: myName, message: newMessage }]);
    };

    return (
        <div className="chat-room-container">
            <header className="chat-header">
                <button className="back-btn" onClick={() => navigate(`/projects/${projectId}`)}>← 나가기</button>
                <h3>프로젝트 채팅방</h3>
            </header>

            <div className="chat-messages-area">
                {messages.length === 0 && <div className="no-chat">대화를 시작해보세요!</div>}
                
                {messages.map((msg) => {
                    // 내 이름과 같으면 'my-message', 다르면 'other-message' 클래스 적용
                    const isMe = msg.sender_name === myName;
                    return (
                        <div key={msg.id} className={`message-wrapper ${isMe ? 'my-message' : 'other-message'}`}>
                            {!isMe && <div className="sender-name">{msg.sender_name}</div>}
                            <div className="message-bubble">
                                {msg.message}
                            </div>
                            <div className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <input 
                    type="text" 
                    className="chat-input"
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="메시지를 입력하세요..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="send-btn">전송</button>
            </div>
        </div>
    );
}

export default ProjectChatRoom;