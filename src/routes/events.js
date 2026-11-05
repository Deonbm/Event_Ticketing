const express = require('express');
const auth = require('../middlewares/authmiddleware');                  // checks the access token, sets req.user
const requireRole = require('../middlewares/rolemiddleware');
const validate = require('../middlewares/validatemiddleware');
const { uploadPoster, parseTiers } = require('../middlewares/uploadmiddleware');
const {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  idParamSchema,
} = require('../validators/eventValidators');
const { createEvent,listEvents,getEvent,myEvents,updateEvent,deleteEvent } = require('../controllers/eventController');
// const { listEvents, getEvent, myEvents, updateEvent, deleteEvent } = require('../Controllers/eventController');

const router = express.Router();

// Attendees AND organizers may host. An organizer is an attendee with extra power.
const hosts = requireRole('attendee', 'organizer');

// ---------- ACTIVE NOW ----------
// Order matters: who? -> allowed role? -> read the form -> fix tiers -> validate -> create
router.post('/create', auth, hosts, uploadPoster, parseTiers, validate(createEventSchema), createEvent);

// ---------- ADD THESE as you write each controller function ----------
// IMPORTANT: "/mine" must stay ABOVE "/:id", or Express reads "mine" as an id.
//
router.get('/alleventlist', validate(listEventsQuerySchema, 'query'), listEvents);        // public, approved events only
router.get('/mine', auth, hosts, myEvents);                                    // my events, any approval status
router.get('/:id', validate(idParamSchema, 'params'), getEvent);               // public, approved only (owner can see own)
router.put('/:id', auth, hosts, validate(idParamSchema, 'params'),uploadPoster, parseTiers, validate(updateEventSchema), updateEvent);         // owner check inside the controller
router.delete('/:id', auth, hosts, validate(idParamSchema, 'params'), deleteEvent); // owner check inside the controller

module.exports = router;