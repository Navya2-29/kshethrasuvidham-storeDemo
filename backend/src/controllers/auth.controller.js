const authService = require('../services/auth.service');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const { accessToken, user } =
      await authService.login(username, password);

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role_name,
        email:user.email,
        mobile:user.mobile_number
      }
    });

  } catch (err) {
    next(err);
  }
};