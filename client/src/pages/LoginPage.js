import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

// 🚨 API URL을 환경변수에서 가져오되, 없으면 기본값(localhost) 사용
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        console.log("로그인 시도 중...");

        try {
            // 🚨 환경 변수 API_URL 사용
            const response = await axios.post(`${API_URL}/api/users/login`, { email, password });
            console.log('서버 응답:', response.data);

            if (response.data.token) {
                // 1. 토큰 저장 (필수)
                localStorage.setItem('token', response.data.token);

                // 2. 유저 정보 저장 (안전하게 처리)
                // 서버가 user 정보를 주면 저장하고, 안 주면 경고만 띄우고 넘어갑니다.
                if (response.data.user) {
                    localStorage.setItem('userId', response.data.user.id);
                    localStorage.setItem('userName', response.data.user.name);
                } else {
                    console.warn('주의: 서버 응답에 유저 상세 정보가 없습니다. (토큰만 저장됨)');
                }
                
                // 3. 대시보드로 이동
                alert('로그인 성공!');
                navigate('/dashboard');
            } else {
                alert('로그인 실패: 서버로부터 토큰을 받지 못했습니다.');
            }

        } catch (error) {
            console.error('로그인 에러:', error);
            // 에러 메시지를 좀 더 구체적으로 보여줍니다.
            const errorMessage = error.response?.data?.message || '로그인 중 알 수 없는 오류가 발생했습니다.';
            alert(`로그인 에러: ${errorMessage}`);
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