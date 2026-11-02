const express = require("express");
const validate = require("../middlewares/validatemiddleware");
const { registerSchema,loginSchema,refreshSchema} = require("../validators/authValidators");
const { register ,login,refresh,logout} = require("../controllers/authController");
const refreshAuth =require('../middlewares/refreshauthmiddleware')

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refreshAuth, refresh);
router.post('/logout', logout);

module.exports = router;