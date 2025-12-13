import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './SignupPage.css'; // 이 파일의 CSS 선택자에 맞춰 HTML 클래스 수정

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SignupPage() {
    const [formData, setFormData] = useState({ 
        email: '', 
        password: '', 
        confirmPassword: '', 
        name: '' 
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const validateForm = () => {
        const { name, email, password, confirmPassword } = formData;
        
        if (!name || !email || !password || !confirmPassword) {
            setError('모든 필드를 채워주세요.');
            return false;
        }

        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return false;
        }

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
        // 🚨 [수정] 클래스명 통일: auth-container -> signup-container
        <div className="signup-container"> 
            {/* 🚨 [수정] 클래스명 통일: auth-box -> signup-box */}
            <div className="signup-box"> 
                {/* 🚨 [수정] 클래스명 통일: auth-title -> signup-title */}
                <h2 className="signup-title">회원가입</h2>
                {/* 🚨 [수정] 클래스명 통일: auth-form -> signup-form */}
                <form className="signup-form" onSubmit={onSubmit}> 
                    <div className="input-group">
                        <label>이름</label>
                        <input 
                            type="text" 
                            name="name" 
                            value={formData.name} // value 추가 (React에서 권장)
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
                            value={formData.email} // value 추가
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
                            value={formData.password} // value 추가
                            onChange={handleChange} 
                            placeholder="비밀번호 (최소 6자)" 
                            required 
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>비밀번호 재확인</label>
                        <input 
                            type="password" 
                            name="confirmPassword"
                            value={formData.confirmPassword} // value 추가
                            onChange={handleChange} 
                            placeholder="비밀번호를 다시 입력하세요" 
                            required 
                        />
                    </div>
                    
                    {error && <p className="error-message">{error}</p>}
                    
                    {/* 🚨 [수정] 클래스명 통일: auth-button -> signup-btn */}
                    <button type="submit" className="signup-btn" disabled={loading}>
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