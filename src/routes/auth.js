const express = require("express");
const validate = require("../middlewares/validatemiddleware");
const { registerSchema,loginSchema} = require("../validators/authValidators");
const { register ,login,logout} = require("../Controllers/authController");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);

module.exports = router;