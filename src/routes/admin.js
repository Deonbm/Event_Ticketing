const express = require('express');
const auth = require('../middlewares/authmiddleware');
const requireRole = require('../middlewares/rolemiddleware');
const validate = require('../middlewares/validatemiddleware');
const { idParamSchema, rejectEventSchema } = require('../validators/eventValidators');
const {listPendingEvents,approveEvent,rejectEvent } = require('../controllers/adminController');

const router = express.Router();

// Every route in this file: logged in AND admin
router.use(auth, requireRole('admin'));

router.get('/events/pending', listPendingEvents);
router.patch('/events/:id/approve', validate(idParamSchema, 'params'), approveEvent);
router.patch('/events/:id/reject', validate(idParamSchema, 'params'), validate(rejectEventSchema), rejectEvent);

module.exports = router;