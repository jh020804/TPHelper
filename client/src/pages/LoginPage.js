import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css'; // CSS 파일 임포트

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_URL}/api/users/login`, { email, password });
            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                // 본인 확인을 위해 userId도 저장해두면 좋습니다 (채팅 등에서 사용)
                localStorage.setItem('userId', response.data.user.id); 
                localStorage.setItem('userName', response.data.user.name);
                navigate('/dashboard');
            }
        } catch (error) {
            alert('로그인 실패: 이메일과 비밀번호를 확인해주세요.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2 className="login-title">TPHelper 로그인</h2>
                <form className="login-form" onSubmit={onSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">이메일</label>
                        <input 
                            type="email" 
                            id="email"
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="이메일을 입력하세요"
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">비밀번호</label>
                        <input 
                            type="password" 
                            id="password"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="비밀번호를 입력하세요"
                            required 
                        />
                    </div>
                    <button type="submit" className="login-btn">로그인</button>
                </form>
                <div className="signup-link">
                    계정이 없으신가요? <span onClick={() => navigate('/signup')}>회원가입</span>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;