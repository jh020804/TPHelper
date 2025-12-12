import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        console.log("로그인 시도...");

        try {
            const response = await axios.post(`${API_URL}/api/users/login`, { email, password });
            console.log('서버 응답:', response.data);

            if (response.data.token) {
                // 1. 토큰 저장 (필수)
                localStorage.setItem('token', response.data.token);

                // 2. 유저 정보 저장 (안전하게 처리: user 정보가 있을 때만 저장)
                // 🚨 여기서 에러가 났던 것입니다. if문으로 감싸서 해결!
                if (response.data.user) {
                    localStorage.setItem('userId', response.data.user.id);
                    localStorage.setItem('userName', response.data.user.name);
                } else {
                    console.log('주의: 서버 응답에 유저 상세 정보가 없습니다. (토큰만 저장됨)');
                }
                
                // 3. 대시보드로 이동
                alert('로그인 성공!');
                navigate('/dashboard');
            } else {
                alert('로그인 실패: 토큰이 없습니다.');
            }

        } catch (error) {
            console.error('로그인 에러:', error);
            alert('로그인 에러: ' + (error.response?.data?.message || '알 수 없는 오류'));
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