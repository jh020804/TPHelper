import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { FaPaperPlane } from 'react-icons/fa';
import './ChatRoomPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ChatRoomPage() {
    const { projectId } = useParams();
    // MainLayout에서 전달해준 socket과 내 이름 가져오기
    const { setHeaderTitle, setMembers, setCurrentProjectId, socket, myUserName } = useOutletContext();
    
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const messagesEndRef = useRef(null);
    const token = localStorage.getItem('token');

    // 스크롤 하단 이동
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 1. 초기 데이터 로드 (이전 채팅 내역 + 프로젝트 정보)
    const fetchChatData = useCallback(async () => {
        try {
            // 프로젝트 정보 로드
            const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            const project = projectRes.data.details.project;
            setHeaderTitle(`팀 채팅: ${project.name}`);
            setMembers(projectRes.data.details.members);
            setCurrentProjectId(projectId);

            // 이전 메시지 내역 로드
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
    
    // 🚨 2. 실시간 소켓 연결 및 리스너 설정 (여기가 핵심!)
    useEffect(() => {
        if (!socket) return;

        // (1) 방 입장 신호 보내기
        socket.emit('joinRoom', projectId);

        // (2) 메시지 수신 리스너 정의
        const handleReceiveMessage = (data) => {
            // 현재 보고 있는 방의 메시지인지 확인 (문자열 변환 후 비교)
            if (String(data.projectId) === String(projectId)) {
                setMessages((prev) => [...prev, data]); // 기존 메시지 뒤에 추가
                setTimeout(scrollToBottom, 100);
            }
        };

        // (3) 이벤트 구독
        socket.on('receiveMessage', handleReceiveMessage);

        // (4) 청소 (언마운트 시 구독 해제)
        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [socket, projectId]); // projectId가 바뀌면 다시 실행

    // 3. 메시지 전송 핸들러
    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;

        // 보낼 데이터 준비
        const tempMessage = {
            projectId: projectId,
            content: messageInput,
            user_name: myUserName, // 내 이름 (화면에 바로 띄우기 위함)
            timestamp: new Date().toISOString()
        };

        try {
            // (1) 서버 DB에 저장 요청 (POST)
            const response = await axios.post(`${API_URL}/api/projects/${projectId}/chat`, 
                { content: messageInput }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // 서버가 저장 후 돌려준 정확한 데이터 (ID 포함)
            const savedMessage = response.data;

            // (2) 소켓으로 다른 사람들에게 "나 보냈어!" 알림
            if (socket) {
                socket.emit('sendMessage', savedMessage);
            }

            // (3) 입력창 비우기
            setMessageInput('');

            // (4) 내 화면에는 즉시 추가하지 않아도 됨 
            // -> 왜냐하면 서버가 'sendMessage'를 받으면 나를 포함한 모두에게 'receiveMessage'를 보내주기 때문입니다.
            // 하지만 반응 속도를 위해 미리 추가해도 됩니다. 여기서는 소켓 수신으로 처리하겠습니다.

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