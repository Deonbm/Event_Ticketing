
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { hashRefreshToken ,clearRefreshCookie} = require('../utils/token');

const refreshAuth = async (req, res, next) => {
    try {
        const  refreshToken = req.cookies && req.cookies.refreshToken;


        if (!refreshToken) {
            return res.status(401).json({
                message: 'Refresh token required',
                code: 'NO_REFRESH_TOKEN'
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                refreshToken, 
                process.env.REFRESH_TOKEN_SECRET
            );
        } catch (error) {
            clearRefreshCookie(res);
            return res.status(401).json({
                message: 'Refresh token expired ',
                code: 'REFRESH_TOKEN_EXPIRED'
            });
        }

        const user = await User.findById(decoded.id)
            .select('+RefreshToken');

        if (!user || !user.RefreshToken) {
            return res.status(401).json({
                message: 'Session not found. Please log in again.',
                code: 'SESSION_NOT_FOUND'
            });
        }

        if (user.RefreshToken !== hashRefreshToken(refreshToken)) {
            clearRefreshCookie(res); 
            return res.status(401).json({
                message: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }

        req.user = user;

        next();

    } catch (error) {
        console.error('Refresh middleware error:', error);

        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
};

module.exports = refreshAuth;