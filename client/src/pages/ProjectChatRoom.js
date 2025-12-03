import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { FaPaperclip } from 'react-icons/fa'; // ‼️ 아이콘 추가
import './ProjectChatRoom.css';

function formatTime(timestamp) { return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: 'numeric', hour12: true }); }
function formatDate(timestamp) { return new Date(timestamp).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); }
function isNewDay(timestamp1, timestamp2) {
    if (!timestamp2) return true;
    const d1 = new Date(timestamp1); const d2 = new Date(timestamp2);
    return d1.getFullYear() !== d2.getFullYear() || d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate();
}

function ProjectChatRoom() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const { setHeaderTitle, setMembers, socket, myUserName } = useOutletContext();
    const { projectId } = useParams();
    const navigate = useNavigate();
    const messageEndRef = useRef(null);
    const fileInputRef = useRef(null); // ‼️ 파일 입력창 참조
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            setUserId(decodedToken.userId);
        } catch (e) {}

        setMessages([]); 

        if (socket) {
            socket.emit('joinRoom', projectId);
            const messageListener = (data) => {
                if (String(data.projectId) === String(projectId)) {
                    setMessages((prevMessages) => [...prevMessages, data]);
                }
            };
            socket.on('receiveMessage', messageListener);
            return () => {
                socket.off('receiveMessage', messageListener);
                socket.emit('leaveRoom', projectId);
            };
        }
    }, [projectId, socket, navigate]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const fetchData = async () => {
            try {
                const detailsRes = await axios.get(`https://tphelper.onrender.com Authorization: `Bearer ${token}` } });
                setHeaderTitle(`채팅: ${detailsRes.data.details.project.name}`);
                setMembers(detailsRes.data.details.members);
                const msgRes = await axios.get(`https://tphelper.onrender.comeaders: { Authorization: `Bearer ${token}` } });
                setMessages(msgRes.data.messages);
            } catch (e) { if (e.response && (e.response.status === 401 || e.response.status === 403)) navigate('/'); }
        };
        fetchData();
    }, [projectId, setHeaderTitle, setMembers, navigate]);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !userId || !socket) return;
        const messageData = {
            projectId: projectId,
            senderName: myUserName,
            message: newMessage,
            userId: userId,
            type: 'text' // ‼️ 텍스트 타입 명시
        };
        socket.emit('sendMessage', messageData);
        setNewMessage('');
    };

    // --- ‼️ (신규) 파일 업로드 핸들러 ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('https://tphelper.onrender.com
                headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
            });

            // 업로드 성공 후 소켓으로 이미지/파일 정보 전송
            const messageData = {
                projectId: projectId,
                senderName: myUserName,
                message: res.data.fileUrl, // 메시지 내용 = 파일 경로
                userId: userId,
                type: res.data.fileType, // 'image' 또는 'file'
                original_name: res.data.originalName
            };
            socket.emit('sendMessage', messageData);

        } catch (error) {
            alert('파일 전송 실패');
        }
    };

    const handleExportChat = () => {
        let logContent = `대화 내역\n저장한 날짜: ${formatDate(new Date())}\n\n`;
        messages.forEach((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            if (isNewDay(msg.timestamp, prevMsg ? prevMsg.timestamp : null)) {
                logContent += `\n---------- ${formatDate(msg.timestamp)} ----------\n\n`;
            }
            // 파일인 경우 표시
            const content = msg.type === 'image' ? '[사진]' : (msg.type === 'file' ? `[파일] ${msg.original_name}` : msg.message);
            logContent += `[${formatTime(msg.timestamp)}] ${msg.senderName}: ${content}\n`;
        });
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `채팅내역.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="chat-room-container">
            <button onClick={handleExportChat} className="print-button">채팅 내보내기 (.txt)</button>
            <div className="message-list">
                {messages.map((msg, index) => {
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const msgUserId = msg.user_id || msg.userId; 
                    const isMyMessage = String(msgUserId) === String(userId);
                    const showDateSeparator = isNewDay(msg.timestamp, prevMsg ? prevMsg.timestamp : null);
                    const prevMsgUserId = prevMsg ? (prevMsg.user_id || prevMsg.userId) : null;
                    const isGrouped = !showDateSeparator && prevMsg && String(prevMsgUserId) === String(msgUserId);
                    const senderName = msg.sender_name || msg.senderName;
                    const showSenderName = !isMyMessage && !isGrouped;
                    const isMentioned = msg.type === 'text' && msg.message.includes(`@${myUserName}`);
                    const bubbleStyle = isMentioned && !isMyMessage ? { backgroundColor: '#fffacd', border: '2px solid #ffcc00' } : {};

                    return (
                        <React.Fragment key={index}>
                            {showDateSeparator && <div className="date-separator"><span>{formatDate(msg.timestamp)}</span></div>}
                            <div className={`message-item ${isMyMessage ? 'my-message' : 'other-message'} ${isGrouped ? 'is-grouped' : ''}`}>
                                <div className="message-body">
                                    {showSenderName && <span className="message-sender">{senderName}</span>}
                                    
                                    {/* ‼️ 메시지 타입에 따른 렌더링 분기 */}
                                    <div className="message-content" style={bubbleStyle}>
                                        {msg.type === 'image' ? (
                                            <img 
                                                src={`https://tphelper.onrender.com
                                                alt="채팅 이미지" 
                                                className="chat-image" 
                                            />
                                        ) : msg.type === 'file' ? (
                                            <a href={`https://tphelper.onrender.com5dTGX6YAm/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/${msg.message}`} download target="_blank" rel="noreferrer" className="chat-file-link">
                                                📁 {msg.original_name || '파일 다운로드'}
                                            </a>
                                        ) : (
                                            msg.message
                                        )}
                                    </div>
                                </div>
                                <span className="message-time">{formatTime(msg.timestamp)}</span>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messageEndRef} />
            </div>
            <form className="message-input-form" onSubmit={handleSendMessage}>
                {/* ‼️ 파일 업로드 버튼 추가 */}
                <button type="button" className="file-upload-btn" onClick={() => fileInputRef.current.click()}>
                    <FaPaperclip />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display:'none'}} 
                    onChange={handleFileUpload} 
                />
                
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="메시지를 입력하세요..." />
                <button type="submit">전송</button>
            </form>
        </div>
    );
}

export default ProjectChatRoom;