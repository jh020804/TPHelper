import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { FaPaperPlane } from 'react-icons/fa';
import './ChatRoomPage.css';

// 🚨 수정: 환경 변수를 사용하여 API URL 정의
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001'; 

function ChatRoomPage() {
    const { projectId } = useParams();
    const { setHeaderTitle, setMembers, setCurrentProjectId, socket, myUserName } = useOutletContext();
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [projectDetails, setProjectDetails] = useState(null);
    const messagesEndRef = useRef(null);
    const token = localStorage.getItem('token');

    // 스크롤을 맨 아래로 이동
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 프로젝트 및 메시지 로딩
    const fetchChatData = useCallback(async () => {
        try {
            // 🚨 수정: API URL에 환경 변수 사용
            const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setProjectDetails(projectRes.data.details.project);
            setHeaderTitle(`팀 채팅: ${projectRes.data.details.project.name}`);
            setMembers(projectRes.data.details.members);
            setCurrentProjectId(projectId);

            // 🚨 수정: API URL에 환경 변수 사용
            const chatRes = await axios.get(`${API_URL}/api/projects/${projectId}/chat`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setMessages(chatRes.data);
            scrollToBottom();
        } catch (error) {
            console.error('Error fetching chat data:', error);
        }
    }, [projectId, setHeaderTitle, setMembers, setCurrentProjectId, token]);

    useEffect(() => {
        fetchChatData();
    }, [fetchChatData]);
    
    // 소켓 메시지 수신 및 스크롤
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (data) => {
            if (String(data.projectId) === projectId) {
                setMessages(prev => [...prev, data]);
                setTimeout(scrollToBottom, 0);
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [socket, projectId]);


    // --- 🚨 핵심 수정: 메시지 전송 핸들러 ---
    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        const messageData = {
            projectId: projectId,
            content: messageInput,
        };

        // 1. 서버에 메시지 저장 요청
        try {
            // 🚨 수정: API URL에 환경 변수 사용
            const response = await axios.post(`${API_URL}/api/projects/${projectId}/chat`, messageData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const newMessage = response.data;

            // 2. Socket.io로 팀원들에게 메시지 전송
            if (socket) {
                socket.emit('sendMessage', newMessage);
            }
            
            // 3. UI 즉시 업데이트 및 입력창 초기화
            setMessages(prev => [...prev, newMessage]);
            setMessageInput('');
            setTimeout(scrollToBottom, 0);

        } catch (error) {
            console.error('메시지 전송 실패:', error);
            alert('메시지 전송에 실패했습니다.');
        }
    };
    // ------------------------------------

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const isMentioned = (content) => {
        return content.includes(`@${myUserName}`);
    };

    // 현재 사용자 ID를 식별해야 정확한 UI 구현 가능. 
    // 여기서는 name으로만 비교 (추후 id를 사용하는 것이 정확)
    const currentUserName = myUserName; 

    return (
        <div className="chat-room-page">
            <div className="messages-container">
                {messages.map((msg, index) => {
                    const isMyMessage = msg.user_name === currentUserName;
                    const mentionClass = isMentioned(msg.content) ? 'message-mentioned' : '';

                    return (
                        <div key={index} className={`message-row ${isMyMessage ? 'my-message' : 'other-message'}`}>
                            <div className={`message-bubble ${mentionClass}`}>
                                {!isMyMessage && <div className="message-sender">{msg.user_name}</div>}
                                <div className="message-content">{msg.content}</div>
                                <div className="message-time">{formatTime(msg.timestamp)}</div>
                            </div>
                        </div>
                    );
                })}
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