import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 환경변수 적용
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
                // alert('로그인 성공!'); // 필요하면 주석 해제
                navigate('/dashboard');
            }
        } catch (error) {
            alert('로그인 실패: 이메일이나 비밀번호를 확인하세요.');
        }
    };

    return (
        <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
            <h2>로그인</h2>
            <form onSubmit={onSubmit}>
                <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '10px' }} />
                <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '10px' }} />
                <button type="submit" style={{ width: '100%', padding: '10px', background: 'blue', color: 'white', border: 'none' }}>로그인</button>
            </form>
            <p onClick={() => navigate('/signup')} style={{ cursor: 'pointer', color: 'blue', marginTop: '10px' }}>회원가입 하러가기</p>
        </div>
    );
}

export default LoginPage;