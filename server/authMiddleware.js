const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // 1. 요청 헤더에서 토큰 추출하기
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: '인증 실패: 토큰이 없거나 형식이 잘못되었습니다.' });
    }
    const token = authHeader.split(' ')[1];

    try {
        // 2. 토큰 검증하기
        const secretKey = 'YOUR_SECRET_KEY'; // 로그인 API에서 사용한 것과 동일한 키
        const decoded = jwt.verify(token, secretKey);

        // 3. 검증 성공 시, 요청 객체에 사용자 정보 추가
        req.user = decoded; // 예: req.user.userId, req.user.name
        next(); // 다음 미들웨어 또는 라우트 핸들러로 제어를 넘김

    } catch (error) {
        // 4. 토큰 검증 실패 시 (만료 등)
        return res.status(401).json({ message: '인증 실패: 유효하지 않은 토큰입니다.' });
    }
};

module.exports = authMiddleware;