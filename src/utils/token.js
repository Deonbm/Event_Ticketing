const jwt = require("jsonwebtoken");
const crypto = require("crypto");

exports.generateAccessToken=(user)=>{
    const token=  jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:'15m'});
    return token;
}

exports.generateRefreshToken=(user)=>{
    const token=  jwt.sign({id:user._id},process.env.REFRESH_TOKEN_SECRET,{expiresIn:'7d'});
    return token;   
}

exports.hashRefreshToken=(token)=>{
    const hashedToken=crypto.createHash('sha256').update(token).digest('hex');
    return hashedToken;
}

const cookieOptions = () => ({
  httpOnly: true,                                  // JavaScript in the page cannot read it
  secure: process.env.NODE_ENV === 'production',   // HTTPS only in production
  sameSite: 'lax',                                 // not sent with requests from other sites
  path: '/auth',                               // browser sends it only to /api/auth/...
});
 
// maxAge (milliseconds) must match the token's 7 days
exports.setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};
 
exports.clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', cookieOptions());
};