import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './MainLayout.css';
import SidebarChatList from './SidebarChatList';
import { FaBars, FaUsers, FaTimes, FaChevronDown, FaChevronRight, FaSignOutAlt, FaCamera } from 'react-icons/fa';

// 🚨 API URL과 SOCKET URL 설정
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SOCKET_URL = API_URL.replace('/api', '');

function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // 현재 채팅 페이지인지 확인
    const isChatPage = location.pathname.startsWith('/chat');
    
    const [socket, setSocket] = useState(null);
    const [notifications, setNotifications] = useState({}); // 🚨 알림 상태 (채팅방 ID별)
    
    const [myUser, setMyUser] = useState({ name: '', profile_image: null });
    
    const [headerTitle, setHeaderTitle] = useState('');
    const [members, setMembers] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteError, setInviteError] = useState('');

    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // 🆕 채팅 목록 열림/닫힘 상태 (기본값: true - 열림)
    const [isChatListOpen, setIsChatListOpen] = useState(true);

    const fileInputRef = useRef(null);

    // 오른쪽 사이드바는 프로젝트 상세 혹은 채팅방에서만 표시
    const showRightSidebar = currentProjectId || isChatPage;

    // 1. 초기화: 로그인 체크, 프로필 로드, 소켓 연결
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        const fetchProfile = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/users/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMyUser(response.data.user);
            } catch (e) {
                console.error('Profile fetch failed:', e);
                
                // 🚨🚨 [핵심 수정] 401 Unauthorized 에러 발생 시 강제 로그아웃
                if (e.response && e.response.status === 401) {
                    console.log('401 Unauthorized: 토큰 만료/무효, 강제 로그아웃 처리');
                    localStorage.removeItem('token');
                    // 페이지 전체를 새로 로드하여 상태 꼬임을 방지
                    window.location.href = '/login'; 
                    return; // 함수 종료
                }
            }
        };
        fetchProfile();

        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });
        setSocket(newSocket);

        return () => newSocket.disconnect();
    }, [navigate]); // navigate를 의존성 배열에 추가 (React Hooks 규칙)

    // 2. 실시간 메시지 수신 및 알림 처리 (기존과 동일)
    useEffect(() => {
        if (!socket) return;
        
        const handleReceiveMessage = (data) => {
            // 현재 내가 보고 있는 채팅방 ID (없으면 null)
            const currentPathId = location.pathname.startsWith('/chat/') 
                ? location.pathname.split('/chat/')[1] 
                : null;
            
            // 메시지가 도착한 방 ID
            const msgProjectId = String(data.projectId || data.project_id);

            // "내가 지금 그 방을 보고 있지 않다면" -> 알림 추가!
            if (currentPathId !== msgProjectId) {
                setNotifications(prev => {
                    const currentNotif = prev[msgProjectId] || { count: 0, hasNew: false };
                    return { 
                        ...prev, 
                        [msgProjectId]: { hasNew: true, count: currentNotif.count + 1 } 
                    };
                });
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);
        return () => { socket.off('receiveMessage', handleReceiveMessage); };
    }, [socket, location.pathname]);

    // 3. 페이지 이동 시 상태 관리 (알림 끄기 등) (기존과 동일)
    useEffect(() => {
        setIsLeftSidebarOpen(false);
        setIsRightSidebarOpen(false);

        // 채팅방에 들어왔으면 그 방의 알림 끄기
        if (location.pathname.startsWith('/chat/')) {
            const projectId = location.pathname.split('/chat/')[1];
            setNotifications(prev => ({ 
                ...prev, 
                [projectId]: { count: 0, hasNew: false } // 알림 초기화
            }));
            
            // 해당 방 소켓 룸 입장
            if(socket) socket.emit('joinRoom', projectId);
        }

        // 대시보드면 헤더 초기화
        if (location.pathname === '/dashboard') {
            setCurrentProjectId(null);
            setHeaderTitle('대시보드');
        }
    }, [location.pathname, socket]);

    // 로그아웃 (기존과 동일)
    const handleLogout = () => {
        localStorage.removeItem('token');
        if(socket) socket.disconnect();
        navigate('/login');
    };

    // 팀원 초대 (기존과 동일)
    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !currentProjectId) return;
        const token = localStorage.getItem('token');
        setInviteError('');
        try {
            await axios.post(`${API_URL}/api/projects/${currentProjectId}/invite`, { email: inviteEmail }, { headers: { Authorization: `Bearer ${token}` } });
            const response = await axios.get(`${API_URL}/api/projects/${currentProjectId}`, { headers: { Authorization: `Bearer ${token}` } });
            setMembers(response.data.details.members);
            setInviteEmail(''); 
            alert('초대장을 보냈습니다.');
        } catch (err) { setInviteError('초대 실패'); }
    };

    // 프로필 이미지 업로드 (기존과 동일)
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/api/users/profile-image`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });
            setMyUser(prev => ({ ...prev, profile_image: response.data.profileImage }));
            alert('프로필 사진이 변경되었습니다.');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('업로드 실패');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    return (
        <div className={`app-layout ${showRightSidebar ? 'with-aside' : ''}`}>
            <header className="app-header">
                <div className="header-left">
                    <button className="sidebar-toggle-btn" onClick={() => setIsLeftSidebarOpen(true)}><FaBars /></button>
                    <div className="project-title-section">{headerTitle}</div>
                </div>

                <div className="header-right">
                    <div className="profile-dropdown">
                        <div className="profile-trigger" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                            {myUser.profile_image ? (
                                <img 
                                    src={`${API_URL}/${myUser.profile_image}`} 
                                    alt="Profile" 
                                    className="header-profile-img"
                                />
                            ) : (
                                <div className="header-profile-placeholder">{myUser.name?.[0]}</div>
                            )}
                            <span className="profile-name">{myUser.name} <FaChevronDown size={12}/></span>
                        </div>

                        {isProfileMenuOpen && (
                            <div className="dropdown-menu">
                                <div className="dropdown-item" onClick={triggerFileInput}>
                                    <FaCamera /> 사진 변경
                                </div>
                                <div className="dropdown-item" onClick={handleLogout}>
                                    <FaSignOutAlt /> 로그아웃
                                </div>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                    </div>

                    {showRightSidebar && (
                        <button className="sidebar-toggle-btn" onClick={() => setIsRightSidebarOpen(true)}><FaUsers /></button>
                    )}
                </div>
            </header>

            <nav className={`app-sidebar ${isLeftSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <Link to="/dashboard" className="sidebar-logo">TPHelper</Link>
                    <button className="sidebar-close-btn-mobile" onClick={() => setIsLeftSidebarOpen(false)}><FaTimes /></button>
                </div>
                <div className="sidebar-menu-container">
                    <ul className="main-nav-links">
                        <li><Link to="/dashboard">내 프로젝트</Link></li> 
                        
                        {/* 🆕 토글 가능한 팀 채팅 목록 헤더 */}
                        <li onClick={() => setIsChatListOpen(!isChatListOpen)} style={{ cursor: 'pointer' }}>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '12px 15px', 
                                color: '#333', 
                                fontWeight: 'bold' 
                            }}>
                                <span>팀 채팅 목록</span>
                                {/* 상태에 따라 아이콘 변경 (아래/오른쪽) */}
                                {isChatListOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                            </div>
                        </li>
                    </ul>
                    
                    {/* 🆕 상태가 true일 때만 목록 표시 */}
                    {isChatListOpen && (
                        <div className="sidebar-chat-wrapper" style={{ paddingLeft: '10px' }}>
                            <SidebarChatList socket={socket} notifications={notifications} />
                        </div>
                    )}
                    
                </div>
            </nav>

            <main className="app-content">
                <Outlet context={{ setHeaderTitle, setMembers, setCurrentProjectId, socket, myUserName: myUser.name }} />
            </main>

            {showRightSidebar && (
                <aside className={`app-aside ${isRightSidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-header mobile-only">
                        <span className="sidebar-title">참여자</span>
                        <button onClick={() => setIsRightSidebarOpen(false)}><FaTimes /></button>
                    </div>
                    <h4>참여자 ({members.length}명)</h4>
                    
                    {/* 👇👇👇 수정된 부분: 이미지와 이름 함께 출력 👇👇👇 */}
                    <ul className="member-list" style={{ listStyle: 'none', padding: 0 }}>
                        {members.map(member => (
                            <li key={member.id} className="member-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                {/* 프로필 이미지 또는 기본 아바타 */}
                                {member.profile_image ? (
                                    <img 
                                        src={`${API_URL}/${member.profile_image}`} 
                                        alt={member.name}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            marginRight: '10px',
                                            border: '1px solid #eee'
                                        }}
                                        onError={(e) => {
                                            e.target.style.display='none'; // 이미지 로드 실패시 숨김 처리 (혹은 기본이미지로 대체)
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: '#ddd',
                                        color: '#555',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        marginRight: '10px'
                                    }}>
                                        {member.name ? member.name[0] : '?'}
                                    </div>
                                )}
                                <span className="member-name">{member.name}</span>
                            </li>
                        ))}
                    </ul>
                    {/* 👆👆👆 수정 완료 👆👆👆 */}

                    {currentProjectId && (
                        <div className="invite-section">
                            <h4>팀원 초대하기</h4>
                            <form onSubmit={handleInviteSubmit} className="invite-form">
                                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="초대할 이메일" />
                                <button type="submit">초대</button>
                                {inviteError && <p className="invite-error">{inviteError}</p>}
                            </form>
                        </div>
                    )}
                </aside>
            )}
            
            {(isLeftSidebarOpen || isRightSidebarOpen) && (
                <div className="overlay" onClick={() => { setIsLeftSidebarOpen(false); setIsRightSidebarOpen(false); setIsProfileMenuOpen(false); }}></div>
            )}
        </div>
    );
}

export default MainLayout;