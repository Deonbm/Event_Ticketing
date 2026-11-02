const User =require('../models/userModel');
const jwt = require('jsonwebtoken');
const {generateAccessToken,generateRefreshToken,hashRefreshToken,setRefreshCookie,clearRefreshCookie } =require('../utils/token')

const publicUser=(user)=>{
  return {
    id:user._id,
    name:user.name,
    email:user.email,
    role:user.role,
    isApproved:user.isApproved
  }
}

exports.register = async (req, res) => {
  try {    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const newUser = new User({ name, email, password });
    await newUser.save();

    return res.status(201).json({
      message: 'Registered successfully. Please log in.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Internal Server error' });
  }
};

exports.login = async (req, res) => {
    try {
        const {email,password} =req.body

        const existingUser = await User.findOne({ email }).select('+password');
        if (!existingUser) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const isPasswordValid = await existingUser.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
         
        
        const accessToken = generateAccessToken(existingUser);
        const refreshToken = generateRefreshToken(existingUser);
        const hashedRefreshToken = hashRefreshToken(refreshToken);
        existingUser.RefreshToken = hashedRefreshToken;

        await existingUser.save();

        setRefreshCookie(res, refreshToken);

        return res.status(200).json({ message: 'Login successful', accessToken, user: publicUser(existingUser) });

    } catch (error) {
        
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal Server error' });
    }
};


exports.refresh = async (req, res) => {
    try {
        const user = req.user;

        // Generate only a new Access Token
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const hashedRefreshToken = hashRefreshToken(refreshToken);
        user.RefreshToken = hashedRefreshToken;

        await user.save();

        
    setRefreshCookie(res, refreshToken);

        return res.status(200).json({
            message: 'Token refreshed',
            accessToken,
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
};

exports.logout = async (req,res)=>{

 try {

    const refreshToken = req.cookies && req.cookies.refreshToken;

  if(refreshToken){
    const decoded= jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log(decoded)

    await User.findOneAndUpdate({_id:decoded.id,RefreshToken:hashRefreshToken(refreshToken)},
    {RefreshToken:null});

    clearRefreshCookie(res);
  res.status(200).json({message:'Logout successful'})
   
  } 
} catch (error) {
   console.error('Logout error:', error);
   return res.status(500).json({message:'Internal Server Error'})
 }
}