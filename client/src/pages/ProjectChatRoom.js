import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './ProjectChatRoom.css';
import { FaPaperclip } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 소켓 연결 설정
const socket = io(API_URL, {
    withCredentials: true
});

function ProjectChatRoom({ projectId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState('');
    const chatEndRef = useRef(null);

    // 1. 사용자 정보 가져오기
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get(`${API_URL}/api/users/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                setUserId(res.data.user.id);
                setUserName(res.data.user.name);
            }).catch(err => console.error(err));
        }
    }, []);

    // 2. 소켓 연결 및 이전 메시지 불러오기
    useEffect(() => {
        if (!userId) return;

        socket.emit('joinRoom', projectId);

        // 이전 메시지 불러오기
        const token = localStorage.getItem('token');
        axios.get(`${API_URL}/api/projects/${projectId}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            setMessages(res.data.messages);
        }).catch(err => console.error(err));

        socket.on('receiveMessage', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => {
            socket.emit('leaveRoom', projectId);
            socket.off('receiveMessage');
        };
    }, [projectId, userId]);

    // 3. 스크롤 자동 이동
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (input.trim() && userId) {
            const messageData = {
                projectId,
                userId,
                senderName: userName,
                message: input,
                type: 'text',
                timestamp: new Date()
            };
            socket.emit('sendMessage', messageData);
            setInput('');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');
        try {
            const res = await axios.post(`${API_URL}/api/chat/upload`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            const { fileUrl, fileType, originalName } = res.data;
            const messageData = {
                projectId,
                userId,
                senderName: userName,
                message: fileUrl, // 파일 경로를 메시지로 전송
                type: fileType,   // 'image' 또는 'file'
                original_name: originalName,
                timestamp: new Date()
            };
            socket.emit('sendMessage', messageData);

        } catch (error) {
            alert('파일 업로드 실패');
            console.error(error);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((msg, index) => {
                    const isMyMessage = msg.user_id === userId;
                    return (
                        <div key={index} className={`message ${isMyMessage ? 'my-message' : 'other-message'}`}>
                            <div className="message-sender">{msg.sender_name}</div>
                            <div className="message-bubble">
                                {msg.type === 'image' ? (
                                    <img 
                                        src={`${API_URL}/${msg.message}`} 
                                        alt="uploaded" 
                                        style={{maxWidth: '200px', borderRadius: '8px'}} 
                                    />
                                ) : msg.type === 'file' ? (
                                    <a href={`${API_URL}/${msg.message}`} download target="_blank" rel="noreferrer">
                                        📎 {msg.original_name || '첨부파일'}
                                    </a>
                                ) : (
                                    msg.message
                                )}
                            </div>
                            <div className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    );
                })}
                <div ref={chatEndRef} />
            </div>
            
            <form className="chat-input-form" onSubmit={sendMessage}>
                <label className="file-upload-label">
                    <FaPaperclip />
                    <input type="file" style={{display:'none'}} onChange={handleFileUpload} />
                </label>
                <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="메시지를 입력하세요..." 
                />
                <button type="submit">전송</button>
            </form>
        </div>
    );
}

export default ProjectChatRoom;