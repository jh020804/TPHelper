import React, { useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import './ChatPage.css'; // (CSS 파일은 6단계에서 만듭니다)

function ChatPage() {
    const { setHeaderTitle, setMembers } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        
        // 이 페이지가 보일 때, 부모(MainLayout)의 상태를 업데이트
        setHeaderTitle('채팅');
        setMembers([]); // 채팅 페이지에서는 오른쪽 참여자 목록을 비웁니다.
    }, [setHeaderTitle, setMembers, navigate]);

    return (
        <div className="chat-page-container">
            {/* 왼쪽 사이드바(SidebarChatList)에서 프로젝트를 클릭하면
                이 중앙 영역의 내용이 해당 프로젝트의 채팅창으로 바뀌어야 합니다.
                (지금은 우선 빈 화면으로 둡니다)
            */}
            <div className="chat-welcome-message">
                <h2>채팅을 시작하세요</h2>
                <p>왼쪽 목록에서 프로젝트를 선택하여 대화를 시작하세요.</p>
            </div>
        </div>
    );
}

export default ChatPage;