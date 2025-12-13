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
    let myUserId = null;
    if (token) {
        try {
            // 🚨 토큰에서 myUserId 안전하게 추출
            const payload = JSON.parse(atob(token.split('.')[1]));
            myUserId = payload.userId;
        } catch (e) {
            console.error("Token decoding failed:", e);
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 1. 데이터 로드 (API)
    const fetchChatData = useCallback(async () => {
        // ... (fetchChatData 로직은 동일)
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
            const msgProjectId = data.projectId || data.project_id;
            
            if (String(msgProjectId) === String(projectId)) {
                // 🚨 [핵심 필터링] 자기 자신이 보낸 메시지(user_id가 일치)는 로컬 상태에 추가하지 않음
                if (data.user_id !== myUserId) {
                    setMessages((prev) => [...prev, data]);
                    setTimeout(scrollToBottom, 100);
                } else {
                     console.log("Filtered my own message from socket:", data);
                }
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);

        // 🚨 [핵심 수정] 클린업 함수: 컴포넌트 언마운트 시 리스너 해제 (중복 리스너 방지)
        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [socket, projectId, myUserId]);

    // 3. 메시지 전송
    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        const messageToSend = messageInput;
        setMessageInput(''); // 입력창 초기화

        try {
            // (1) DB 저장 요청 (서버는 저장 후 최종 메시지 객체를 반환)
            const response = await axios.post(`${API_URL}/api/projects/${projectId}/chat`, 
                { content: messageToSend }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const savedMessage = response.data; // 서버에서 반환된 최종 메시지 객체

            // 🚨 [핵심 수정] 서버 응답을 받은 후, 로컬 상태에 직접 추가 (첫 번째 출력)
            setMessages((prev) => [...prev, savedMessage]);
            setTimeout(scrollToBottom, 100);
            
            // (2) 소켓 전송 (다른 사용자에게 알리기 위함)
            if (socket) {
                socket.emit('sendMessage', { 
                    ...savedMessage, 
                    projectId: projectId
                });
            }

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