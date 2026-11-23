const jwt = require('jsonwebtoken');

exports.verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.sendStatus(403);
  }
};