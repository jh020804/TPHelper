import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css'; // CSS 파일이 없다면 이 줄은 지우셔도 됩니다.

// Vercel 환경 변수 (없으면 로컬)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        
        try {
            // 1. 서버에 로그인 요청
            const response = await axios.post(`${API_URL}/api/users/login`, {
                email,
                password
            });

            // 2. 서버가 준 응답 확인 (로그로 확인용)
            console.log('로그인 응답:', response.data);

            // 3. 토큰이 있는지 확인
            if (response.data.token) {
                // 4. 로컬 스토리지에 토큰 저장 (매우 중요!)
                localStorage.setItem('token', response.data.token);
                
                // 5. 로그인 성공 알림 (선택 사항)
                alert('로그인 성공! 대시보드로 이동합니다.');

                // 6. 대시보드로 강제 이동 🚀
                navigate('/dashboard'); 
            } else {
                alert('로그인 실패: 토큰을 받지 못했습니다.');
            }

        } catch (error) {
            console.error('로그인 에러:', error);
            // 에러 메시지 표시
            if (error.response && error.response.data) {
                alert(`로그인 실패: ${error.response.data.message}`);
            } else {
                alert('로그인 중 네트워크 오류가 발생했습니다.');
            }
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>로그인</h2>
            <form onSubmit={onSubmit}>
                <div style={{ marginBottom: '10px' }}>
                    <label>이메일</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="이메일을 입력하세요"
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        required
                    />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label>비밀번호</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="비밀번호를 입력하세요"
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        required
                    />
                </div>
                <button 
                    type="submit" 
                    style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    로그인
                </button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
                계정이 없으신가요? <span onClick={() => navigate('/signup')} style={{ color: '#007bff', cursor: 'pointer' }}>회원가입</span>
            </p>
        </div>
    );
}

export default LoginPage;