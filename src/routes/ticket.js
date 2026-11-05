    const express = require('express');
    const auth = require('../middlewares/authmiddleware');
    const requireRole = require('../middlewares/rolemiddleware');
    const validate = require('../middlewares/validatemiddleware');
    const { idParamSchema } = require('../validators/eventValidators');
    const { bookTicketSchema, verifyTicketSchema } = require('../validators/ticketValidators');
    const { bookTickets, myTickets, cancelTicket, verifyTicket } = require('../Controllers/ticketController');

    const router = express.Router();

    // Attendees AND organizers can buy tickets (an organizer is an attendee with extra power)
    const buyers = requireRole('attendee', 'organizer');

    router.post('/:id/book', auth, buyers,validate(idParamSchema, 'params'), validate(bookTicketSchema), bookTickets);
    router.get('/mine', auth, buyers, myTickets);
    router.patch('/:id/cancel', auth, buyers, validate(idParamSchema, 'params'), cancelTicket);

    // Gate: staff, organizer (own events only, checked in the controller) and admin
    router.post('/verify', auth, requireRole('organizer', 'admin'), validate(verifyTicketSchema), verifyTicket);

    module.exports = router;