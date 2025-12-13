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
    const myUserId = JSON.parse(atob(token.split('.')[1])).userId; // 토큰에서 userId 추출

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
            const msgProjectId = data.projectId || data.project_id;
            
            if (String(msgProjectId) === String(projectId)) {
                // 🚨 [핵심 수정] 1: 자기 자신이 보낸 메시지가 아닐 경우에만 상태에 추가
                // (자신이 보낸 메시지는 handleSendMessage에서 이미 로컬 상태에 추가했으므로)
                if (data.user_id !== myUserId) {
                    setMessages((prev) => [...prev, data]);
                    setTimeout(scrollToBottom, 100);
                }
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);

        // 🚨 [핵심 수정] 2: 컴포넌트 언마운트 시 리스너 해제 (중복 리스너 방지)
        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [socket, projectId, myUserId]); // 의존성 배열에 myUserId 추가

    // 3. 메시지 전송
    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        const messageToSend = messageInput; // 현재 입력 값 저장
        setMessageInput(''); // 입력창 초기화 (낙관적 UI)

        try {
            // (1) DB 저장 요청
            const response = await axios.post(`${API_URL}/api/projects/${projectId}/chat`, 
                { content: messageToSend }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const savedMessage = response.data; // 서버에서 반환된 최종 메시지 객체

            // 🚨 [핵심 수정] 3: 서버 응답을 받은 후, 소켓 리스너를 통하지 않고 로컬 상태에 직접 추가
            setMessages((prev) => [...prev, savedMessage]);
            setTimeout(scrollToBottom, 100);
            
            // (2) 소켓 전송 (다른 사용자에게 알리기 위함)
            if (socket) {
                // savedMessage에는 user_id가 포함되어 있으므로, 이를 이용해 수신자가 필터링할 수 있음
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
                            {/* timestamp 필드가 존재하면 표시, 아니면 현재 시간 사용 */}
                            <div className="message-time">{formatTime(msg.timestamp || new Date().toISOString())}</div>
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