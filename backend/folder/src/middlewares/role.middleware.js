exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Unauthorized'
      });
    }

    // SUPER_ADMIN outranks every role check (see role-permissions.js)
    if (req.user.role !== 'SUPER_ADMIN' && !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Forbidden: Access denied'
      });
    }

    next();
  };
};