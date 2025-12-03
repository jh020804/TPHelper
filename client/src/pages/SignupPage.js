import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './SignupPage.css'; // 로그인 페이지와 유사한 CSS를 사용할 것입니다.

function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setError('');

    try {
      await axios.post('https://api.render.com/deploy/srv-d4j6ctvgi27c739fo82g?key=g1U5dTGX6YA/api/users/signup', {
        name,
        email,
        password
      });
      alert('회원가입 성공! 로그인 페이지로 이동합니다.');
      navigate('/login');
    } catch (err) {
      if (err.response && err.response.status === 500) {
        setError('이미 사용 중인 이메일입니다.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
      console.error('Signup error:', err);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <h2>TPHelper 회원가입</h2>
        <form className="signup-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="name">이름 (닉네임)</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="email">이메일</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">비밀번호</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="input-group">
            <label htmlFor="passwordConfirm">비밀번호 확인</label>
            <input type="password" id="passwordConfirm" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="signup-button">가입하기</button>
        </form>
        <p className="link-to-login">
          이미 계정이 있으신가요? <Link to="/login">로그인하기</Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;