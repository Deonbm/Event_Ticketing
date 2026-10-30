const User =require('../Models/userModel');
const jwt = require('jsonwebtoken');


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

        const token =jwt.sign({
           id:existingUser._id,
           role:existingUser.role,
        }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ message: 'Login successful', token, 
             user: {
    id: existingUser._id,
    name: existingUser.name,
    email: existingUser.email,
    role: existingUser.role,
    isApproved: existingUser.isApproved,
  }
         });

    } catch (error) {
        
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal Server error' });
    }
};


exports.logout = (req,res)=>{
  
res.status(200).json({message:'Logout successful'})
}