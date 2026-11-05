const Event = require('../models/eventModel');
const Ticket = require('../models/ticketModel');
const { generateCode } = require('../utils/generateCode');
const { makeQR } = require('../utils/makeQR');

// "6:42 pm" in Indian time
const timeText = (date) =>
  date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// ---------------------------------------------------------------------------
// POST /tickets/book    body: { eventId, tierName, quantity }
// ---------------------------------------------------------------------------
exports.bookTickets = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { tierName, quantity } = req.body;

    // 1. The event must exist, be approved, and be open for booking
    const event = await Event.findOne({ _id: id, approvalStatus: 'approved' });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (String(event.organizer) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot book your own event' });
    }
    if (event.status !== 'upcoming') {
      return res.status(400).json({ message: 'Booking is closed for this event' });
    }

    const tier = event.tiers.find((t) => t.name === tierName);
    if (!tier) {
      return res.status(404).json({ message: 'Ticket tier not found' });
    }

    // 2. Reserve the seats in ONE atomic step (this is the capacity check).
    //    It only succeeds if enough seats are left, so two people can't both get the last ticket.
    const reserved = await Event.reserveSeats(id, tierName, quantity);
    if (!reserved) {
      return res.status(409).json({ message: 'Not enough tickets left in this tier' });
    }

    // 3. Create the tickets, each with its own random code
    const codes = new Set();
    while (codes.size < quantity) codes.add(generateCode());

    const docs = [...codes].map((code) => ({
      code,
      event: event._id,
      attendee: req.user.id,
      tierName,
      price: tier.price,
    }));

    let tickets;
    try {
      tickets = await Ticket.insertMany(docs);
    } catch (insertErr) {
      // Creating the tickets failed: give the seats back, then report the error
      await Event.releaseSeats(id, tierName, quantity);
      throw insertErr;
    }

    // 4. Send the tickets back with a QR image for each
    const items = await Promise.all(
      tickets.map(async (t) => ({
        id: t._id,
        code: t.code,
        tierName: t.tierName,
        price: t.price,
        status: t.status,
        qr: await makeQR(t.code),
      }))
    );

    return res.status(201).json({
      message: `${quantity} ticket${quantity > 1 ? 's' : ''} booked`,
      event: { id: event._id, title: event.title, date: event.date, venue: event.venue, city: event.city },
      total: tier.price * quantity,
      tickets: items,
    });
  } catch (err) {
    console.error('Book tickets error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ---------------------------------------------------------------------------
// GET /tickets/mine
// The logged-in user's tickets, newest first
// ---------------------------------------------------------------------------
exports.myTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ attendee: req.user.id })
      .populate('event', 'title posterUrl city venue date endDate')
      .sort({ createdAt: -1 });

    const items = await Promise.all(
      tickets.map(async (t) => ({
        id: t._id,
        code: t.code,
        tierName: t.tierName,
        price: t.price,
        status: t.status,                 // valid / used / cancelled
        usedAt: t.usedAt,
        qr: t.status === 'valid' ? await makeQR(t.code) : null, // only valid tickets get a QR
        event: t.event
          ? {
              id: t.event._id,
              title: t.event.title,
              posterUrl: t.event.posterUrl,
              city: t.event.city,
              venue: t.event.venue,
              date: t.event.date,
              endDate: t.event.endDate,
              status: t.event.status,     // upcoming / live / ended
            }
          : null,
      }))
    );

    return res.status(200).json({ count: items.length, tickets: items });
  } catch (err) {
    console.error('My tickets error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /tickets/:id/cancel
// Only the ticket's owner, only a valid ticket, only before the event starts
// ---------------------------------------------------------------------------
exports.cancelTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (String(ticket.attendee) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This is not your ticket' });
    }
    if (ticket.status !== 'valid') {
      return res.status(409).json({ message: `This ticket is already ${ticket.status}` });
    }

    const event = await Event.findById(ticket.event);
    if (!event || event.status !== 'upcoming') {
      return res.status(400).json({ message: 'Tickets cannot be cancelled after the event has started' });
    }

    // Cancel it only if it is STILL valid (protects against a double click)
    const cancelled = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'valid' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!cancelled) {
      return res.status(409).json({ message: 'This ticket can no longer be cancelled' });
    }

    // Give the seat back so someone else can book it
    await Event.releaseSeats(ticket.event, ticket.tierName, 1);

    return res.status(200).json({ message: 'Ticket cancelled', ticket: cancelled });
  } catch (err) {
    console.error('Cancel ticket error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ---------------------------------------------------------------------------
// POST /tickets/verify    body: { code }      (gate staff, organizer, admin)
// Every scan answers 200 with a "valid" true/false and a "result" word,
// so the gate page can show a big green or red screen.
// ---------------------------------------------------------------------------
exports.verifyTicket = async (req, res) => {
  try {
    const { code } = req.body;

    const ticket = await Ticket.findOne({ code })
      .populate('event', 'title organizer date endDate')
      .populate('attendee', 'name');

    // 1. No such code
    if (!ticket) {
      return res.status(200).json({ valid: false, result: 'invalid', message: 'Invalid ticket' });
    }

    // 2. An organizer can only check tickets for THEIR OWN events (staff and admin can check any)
    if (req.user.role === 'organizer' && String(ticket.event.organizer) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This ticket is for another organizer\'s event' });
    }

    // 3. Cancelled / already used
    if (ticket.status === 'cancelled') {
      return res.status(200).json({ valid: false, result: 'cancelled', message: 'Ticket was cancelled' });
    }
    if (ticket.status === 'used') {
      return res.status(200).json({
        valid: false,
        result: 'already_used',
        message: `Already used at ${timeText(ticket.usedAt)}`,
        usedAt: ticket.usedAt,
      });
    }

    // 4. The event is over
    if (ticket.event.status === 'ended') {
      return res.status(200).json({ valid: false, result: 'event_ended', message: 'This event has ended' });
    }

    // 5. Valid: mark it used in ONE atomic step
    const used = await Ticket.markUsed(code, req.user.id);
    if (!used) {
      // Someone scanned the same ticket at the same moment and got there first
      return res.status(200).json({ valid: false, result: 'already_used', message: 'Already used just now' });
    }

    return res.status(200).json({
      valid: true,
      result: 'valid',
      message: 'Valid ticket',
      attendee: ticket.attendee ? ticket.attendee.name : null,
      tierName: ticket.tierName,
      event: ticket.event.title,
      usedAt: used.usedAt,
    });
  } catch (err) {
    console.error('Verify ticket error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};