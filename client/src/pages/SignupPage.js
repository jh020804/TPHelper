import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Link 컴포넌트를 사용하기 위해 import 추가
import axios from 'axios';
import './SignupPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SignupPage() {
    // 🚨 [수정] formData에 confirmPassword 필드 추가
    const [formData, setFormData] = useState({ 
        email: '', 
        password: '', 
        confirmPassword: '', // 비밀번호 재확인 필드 추가
        name: '' 
    });
    const [error, setError] = useState(''); // 에러 메시지 상태 추가
    const [loading, setLoading] = useState(false); // 로딩 상태 추가
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // 입력 변경 시 에러 메시지 초기화
        if (error) setError('');
    };

    const validateForm = () => {
        const { name, email, password, confirmPassword } = formData;
        
        if (!name || !email || !password || !confirmPassword) {
            setError('모든 필드를 채워주세요.');
            return false;
        }

        // 🚨 [핵심] 비밀번호 일치 확인
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return false;
        }

        // 비밀번호 길이 등 추가 유효성 검사
        if (password.length < 6) {
            setError('비밀번호는 최소 6자 이상이어야 합니다.');
            return false;
        }

        setError('');
        return true;
    };


    const onSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setLoading(true);
        // 서버에 전송할 때에는 confirmPassword를 제외한 데이터만 보냅니다.
        const { confirmPassword, ...dataToSend } = formData; 

        try {
            await axios.post(`${API_URL}/api/users/signup`, dataToSend);
            alert('회원가입 성공! 로그인 해주세요.');
            navigate('/login');
        } catch (error) {
            console.error('회원가입 실패:', error.response?.data?.message || error.message);
            if (error.response && error.response.data.message) {
                setError(error.response.data.message);
            } else {
                setError('회원가입 실패: 이미 존재하는 이메일이거나 서버 오류입니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container"> {/* 클래스명은 SignupPage.css에 맞춰 조정 */}
            <div className="auth-box"> {/* 클래스명은 SignupPage.css에 맞춰 조정 */}
                <h2 className="auth-title">회원가입</h2>
                <form className="auth-form" onSubmit={onSubmit}>
                    <div className="input-group">
                        <label>이름</label>
                        <input 
                            type="text" 
                            name="name" 
                            onChange={handleChange} 
                            placeholder="이름을 입력하세요" 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>이메일</label>
                        <input 
                            type="email" 
                            name="email" 
                            onChange={handleChange} 
                            placeholder="이메일을 입력하세요" 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>비밀번호</label>
                        <input 
                            type="password" 
                            name="password" 
                            onChange={handleChange} 
                            placeholder="비밀번호 (최소 6자)" 
                            required 
                        />
                    </div>
                    
                    {/* 🚨 [추가] 비밀번호 재확인 필드 */}
                    <div className="input-group">
                        <label>비밀번호 재확인</label>
                        <input 
                            type="password" 
                            name="confirmPassword" // name 속성 추가
                            onChange={handleChange} 
                            placeholder="비밀번호를 다시 입력하세요" 
                            required 
                        />
                    </div>
                    
                    {error && <p className="error-message">{error}</p>}
                    
                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? '가입 중...' : '가입하기'}
                    </button>
                </form>
                
                <div className="login-link">
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;