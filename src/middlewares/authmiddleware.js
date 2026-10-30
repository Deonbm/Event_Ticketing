const jwt= require('jsonwebtoken')



const authmiddleware = async (req,res,next)=>{
  const authHeader= req.headers.authorisation;

  if(!authHeader || !authHeader.startsWith('Bearer ') || !authHeader.split(' ')[1]){
    return res.status(401).json({message:'Unauthorized'})
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded =await jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({message:'Invalid token'});
  }
}

module.exports = authmiddleware;