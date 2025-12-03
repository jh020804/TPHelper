import React from 'react';
import { Link } from 'react-router-dom';

function SidebarNav() {
    return (
        <ul>
            <li><Link to="/">내 프로젝트</Link></li>
            {/* --- 이 부분의 텍스트를 수정했습니다 --- */}
            <li><Link to="/chat">팀 채팅</Link></li>
            <li>맨션 된 프로젝트 (구현 예정)</li>
        </ul>
    );
}

export default SidebarNav;