import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './MainLayout.css';
import SidebarNav from './SidebarNav';
import SidebarChatList from './SidebarChatList';
import { FaBars, FaUsers, FaTimes, FaChevronDown, FaSignOutAlt, FaCamera } from 'react-icons/fa';

function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const isChatActive = location.pathname.startsWith('/chat');

    const [socket, setSocket] = useState(null);
    const [notifications, setNotifications] = useState({});
    
    // --- ‼️ (수정) 내 정보 (이름, 이미지) 상태 ---
    const [myUser, setMyUser] = useState({ name: '', profile_image: null });
    
    const [headerTitle, setHeaderTitle] = useState('');
    const [members, setMembers] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteError, setInviteError] = useState('');

    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // ‼️ (추가) 파일 입력창 참조
    const fileInputRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        // ‼️ (수정) 토큰 대신 API로 최신 프로필 정보 불러오기
        const fetchProfile = async () => {
            try {
                const response = await axios.get('https://tphelper.onrender.com/api/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setMyUser(response.data.user);
            } catch (e) {
                console.error('Profile fetch failed:', e);
            }
        };
        fetchProfile();

        const newSocket = io('https://tphelper.onrender.com');
        setSocket(newSocket);

        return () => newSocket.disconnect();
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handleReceiveMessage = (data) => {
            const currentPathId = location.pathname.split('/chat/')[1];
            if (currentPathId !== String(data.projectId)) {
                setNotifications(prev => {
                    const currentNotif = prev[data.projectId] || { count: 0, hasNew: false };
                    const isMentioned = data.message.includes(`@${myUser.name}`);
                    const newCount = isMentioned ? currentNotif.count + 1 : currentNotif.count;
                    return { ...prev, [data.projectId]: { hasNew: true, count: newCount } };
                });
            }
        };
        socket.on('receiveMessage', handleReceiveMessage);
        return () => { socket.off('receiveMessage', handleReceiveMessage); };
    }, [socket, location.pathname, myUser.name]);

    // ... (기존 useEffect 동일)
    useEffect(() => {
        setIsLeftSidebarOpen(false);
        setIsRightSidebarOpen(false);
        if (location.pathname.startsWith('/chat/')) {
            const projectId = location.pathname.split('/chat/')[1];
            setNotifications(prev => ({ ...prev, [projectId]: { count: 0, hasNew: false } }));
            if(socket) socket.emit('joinRoom', projectId);
        }
    }, [location.pathname, socket]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        if(socket) socket.disconnect();
        navigate('/login');
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        // ... (기존 코드와 동일)
        if (!inviteEmail.trim() || !currentProjectId) return;
        const token = localStorage.getItem('token');
        setInviteError('');
        try {
            await axios.post(`https://tphelper.onrender.com/api/projects/${currentProjectId}/invite`, { email: inviteEmail }, { headers: { Authorization: `Bearer ${token}` } });
            const response = await axios.get(`https://tphelper.onrender.com/api/projects/${currentProjectId}`, { headers: { Authorization: `Bearer ${token}` } });
            setMembers(response.data.details.members);
            setInviteEmail(''); 
        } catch (err) { setInviteError('초대 실패'); }
    };

    // --- ‼️ (신규) 프로필 이미지 업로드 핸들러 ---
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('https://tphelper.onrender.com/api/users/profile-image', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });
            // 업로드 성공 시 상태 업데이트 (즉시 반영)
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
        <div className="app-layout">
            <header className="app-header">
                <div className="header-left">
                    <button className="sidebar-toggle-btn" onClick={() => setIsLeftSidebarOpen(true)}><FaBars /></button>
                    <div className="project-title-section">{headerTitle}</div>
                </div>

                <div className="header-right">
                    <div className="profile-dropdown">
                        <div className="profile-trigger" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                            {/* ‼️ 프로필 이미지 표시 */}
                            {myUser.profile_image ? (
                                <img 
                                    src={`https://tphelper.onrender.com/${myUser.profile_image}`} 
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
                                {/* ‼️ 사진 변경 버튼 */}
                                <div className="dropdown-item" onClick={triggerFileInput}>
                                    <FaCamera /> 사진 변경
                                </div>
                                <div className="dropdown-item" onClick={handleLogout}>
                                    <FaSignOutAlt /> 로그아웃
                                </div>
                            </div>
                        )}
                        {/* ‼️ 숨겨진 파일 입력창 */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                    </div>

                    <button className="sidebar-toggle-btn" onClick={() => setIsRightSidebarOpen(true)}><FaUsers /></button>
                </div>
            </header>

            <nav className={`app-sidebar ${isLeftSidebarOpen ? 'open' : ''}`}>
                {/* ... (기존 사이드바 코드 동일) ... */}
                <div className="sidebar-header">
                    <Link to="/" className="sidebar-logo">TPHelper</Link>
                    <button className="sidebar-close-btn-mobile" onClick={() => setIsLeftSidebarOpen(false)}><FaTimes /></button>
                </div>
                <div className="sidebar-menu-container">
                    <ul className="main-nav-links">
                        <li><Link to="/">내 프로젝트</Link></li>
                        <li><Link to="/chat">팀 채팅</Link></li>
                    </ul>
                    <hr className="sidebar-divider" />
                    {isChatActive ? <SidebarChatList socket={socket} notifications={notifications} /> : null}
                </div>
            </nav>

            <main className="app-content">
                {/* ‼️ myUser.name을 자식에게 전달 */}
                <Outlet context={{ setHeaderTitle, setMembers, setCurrentProjectId, socket, myUserName: myUser.name }} />
            </main>

            <aside className={`app-aside ${isRightSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header mobile-only">
                     <span className="sidebar-title">참여자</span>
                     <button onClick={() => setIsRightSidebarOpen(false)}><FaTimes /></button>
                </div>
                <h4>참여자 ({members.length}명)</h4>
                <ul className="member-list">
                    {members.map(member => (
                        <li key={member.id} className="member-item">
                            <span className="member-name">{member.name}</span>
                        </li>
                    ))}
                </ul>
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
            
            {(isLeftSidebarOpen || isRightSidebarOpen) && (
                <div className="overlay" onClick={() => { setIsLeftSidebarOpen(false); setIsRightSidebarOpen(false); setIsProfileMenuOpen(false); }}></div>
            )}
        </div>
    );
}

export default MainLayout;