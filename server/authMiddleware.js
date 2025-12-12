// server/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // 1. 헤더에서 토큰 꺼내기
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: '인증 실패: 토큰이 없습니다.' });
        }

        // 2. "Bearer " 글자 떼어내기
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: '인증 실패: 토큰 형식이 잘못되었습니다.' });
        }

        // 3. 토큰 검증 (비밀키는 userRoutes.js에서 쓴 것과 같아야 함)
        // 'your_secret_key' 부분을 실제 사용하는 비밀키로 맞춰주세요.
        const decoded = jwt.verify(token, 'your_secret_key'); 
        
        // 4. 요청 객체에 유저 정보 담기
        req.user = decoded; 
        
        next(); // 통과!
    } catch (error) {
        console.error('Auth Error:', error.message);
        return res.status(401).json({ message: '인증 실패: 유효하지 않은 토큰입니다.' });
    }
};