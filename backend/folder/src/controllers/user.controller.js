const userService = require("../services/user.service");

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers(req.user);

    res.json(users);

  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(
      req.user,
      req.params.id
    );

    res.json(user);

  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    await userService.createUser(
      req.user,
      req.body
    );

    res.status(201).json({
      message: "User created successfully"
    });

  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {

      let message = "Duplicate entry found";

      if (error.message.includes("uq_users_email")) {
        message = "Email already exists";
      }

      if (error.message.includes("username")) {
        message = "Username already exists";
      }

      if (error.message.includes("uq_users_mobile")) {
        message = "Mobile number already exists";
      }

      return res.status(400).json({ message });
    }

    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    await userService.updateUser(
      req.user,
      req.params.id,
      req.body
    );

    res.json({
      message: "User updated successfully"
    });

  } catch (error) {
     //  DUPLICATE ENTRY HANDLING
    if (error.code === "ER_DUP_ENTRY") {

      let message = "Duplicate entry found";

      if (error.message.includes("uq_users_email")) {
        message = "Email already exists";
      }

      if (error.message.includes("uq_users_mobile")) {
        message = "Mobile number already exists";
      }

      if (error.message.includes("username")) {
        message = "Username already exists";
      }

      return res.status(400).json({ message });
    }

    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {

    await userService.deleteUser(
      req.user,
      req.params.id
    );

    res.json({
      message: "User deleted successfully"
    });

  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {

    const result =
      await userService.changePassword(
        req.user,
        req.params.id,
        req.body.password
      );

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
};