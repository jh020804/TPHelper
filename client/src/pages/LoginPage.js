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
        e.preventDefault(); // 1. 새로고침 방지 (매우 중요)
        
        console.log("로그인 시도 중..."); // 로그 확인

        try {
            const response = await axios.post(`${API_URL}/api/users/login`, { email, password });
            
            // 2. 서버가 준 전체 응답 확인
            console.log('서버 응답 전체:', response);
            console.log('서버가 준 데이터:', response.data);

            // 3. 토큰이 진짜 있는지 확인
            if (response.data.token) {
                console.log('토큰 발견! 저장합니다:', response.data.token);
                
                // 토큰 저장
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userId', response.data.user.id);
                localStorage.setItem('userName', response.data.user.name);
                
                // 저장 확인
                const savedToken = localStorage.getItem('token');
                if (savedToken) {
                    alert(`로그인 성공! 대시보드로 이동합니다.\n(토큰: ${savedToken.substring(0, 10)}...)`);
                    navigate('/dashboard'); // 4. 이동 명령
                } else {
                    alert('토큰 저장 실패! (브라우저 문제)');
                }
            } else {
                console.error('응답에 토큰이 없습니다!', response.data);
                alert('로그인은 성공했지만, 서버가 토큰을 주지 않았습니다.');
            }

        } catch (error) {
            console.error('로그인 에러 발생:', error);
            alert('로그인 에러: ' + (error.response?.data?.message || error.message));
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