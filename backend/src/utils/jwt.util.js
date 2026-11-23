const jwt = require('jsonwebtoken');


const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '1d' 
  });
};
module.exports = {
  generateAccessToken,
  
};
