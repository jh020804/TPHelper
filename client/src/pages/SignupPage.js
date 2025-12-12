import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SignupPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SignupPage() {
    const [formData, setFormData] = useState({ email: '', password: '', name: '' });
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/api/users/signup`, formData);
            alert('회원가입 성공! 로그인 해주세요.');
            navigate('/login');
        } catch (error) {
            alert('회원가입 실패: 이미 존재하는 이메일입니다.');
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-box">
                <h2 className="signup-title">회원가입</h2>
                <form className="signup-form" onSubmit={onSubmit}>
                    <div className="input-group">
                        <label>이름</label>
                        <input type="text" name="name" onChange={handleChange} placeholder="이름을 입력하세요" required />
                    </div>
                    <div className="input-group">
                        <label>이메일</label>
                        <input type="email" name="email" onChange={handleChange} placeholder="이메일을 입력하세요" required />
                    </div>
                    <div className="input-group">
                        <label>비밀번호</label>
                        <input type="password" name="password" onChange={handleChange} placeholder="비밀번호를 입력하세요" required />
                    </div>
                    <button type="submit" className="signup-btn">가입하기</button>
                </form>
                <div className="login-link">
                    이미 계정이 있으신가요? <span onClick={() => navigate('/login')}>로그인</span>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;