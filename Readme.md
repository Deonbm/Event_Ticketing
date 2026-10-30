# PassIt

Event ticketing with QR entry. Every ticket gets a unique QR code that works exactly once.

Small gigs, college fests, and workshops often sell tickets through DMs and screenshots, which leads to fake tickets, overselling, and duplicate entry. PassIt fixes this with capacity control, unique ticket codes, and one-time validation at the gate.

## Features

- **Capacity control:** a booking is rejected if it would exceed the remaining tickets of a tier
- **Unique ticket code:** each ticket gets a random code, shown as a QR image
- **One-time validation:** the first scan marks the ticket Used; a second scan shows "Already used at [time]"
- **Event status:** Upcoming, Live, Ended, derived from the event dates
- **Charts:** sold vs remaining (donut), sales by tier (bar), bookings per day (line)

## Roles

| Role | What they can do |
|---|---|
| Attendee | Browse events, book tickets, view QR tickets, cancel before the event starts |
| Organizer | Create events with tiers, see sales and attendance (after admin approval) |
| Gate staff | Verify tickets at entry |
| Admin | Approve or block organizers, view platform stats, verify tickets |

## Tech stack

- **Backend:** Node.js, Express, Mongoose (MongoDB)
- **Auth:** JWT and bcrypt, with role middleware
- **Frontend:** plain HTML and JavaScript, Bootstrap, Chart.js (via CDN)
- **QR:** `qrcode` npm package; optional camera scanning with `html5-qrcode`

## MVC architecture

| Layer | Folder | Responsibility |
|---|---|---|
| **Model** | `models/` | Data shape, validation, database access |
| **View** | `public/` | HTML pages and browser JavaScript |
| **Controller** | `controllers/` | Business rules; reads the request, uses models, sends JSON |

Routes and middleware connect the layers:

```
Page (View) -> api.js fetch -> Route -> auth/role middleware -> Controller -> Model -> MongoDB
     ^                                                              |
     +------------------------- JSON response <--------------------+
```

The server only returns JSON. The pages in `public/` fetch that JSON and draw it.

## Folder structure

```
passit/
├── server.js                 # app setup, mounts routes, serves public/
├── .env                      # PORT, MONGO_URI, JWT_SECRET
├── config/
│   └── db.js                 # database connection
├── models/                   # MODEL
│   ├── User.js
│   ├── Event.js
│   └── Ticket.js
├── controllers/              # CONTROLLER
│   ├── authController.js
│   ├── eventController.js
│   ├── ticketController.js
│   └── adminController.js
├── routes/                   # URL -> middleware -> controller
│   ├── auth.js
│   ├── events.js
│   ├── tickets.js
│   └── admin.js
├── middleware/
│   ├── auth.js               # verifies JWT, sets req.user
│   ├── role.js               # allows only listed roles
│   └── errorHandler.js       # one place for error responses
├── utils/
│   ├── generateCode.js       # random ticket code
│   └── makeQR.js             # code -> QR data URL
└── public/                   # VIEW
    ├── css/style.css
    ├── js/                   # api.js, auth.js, home.js, event.js,
    │                         # tickets.js, organizer.js, gate.js, admin.js
    ├── index.html            # events grid
    ├── login.html
    ├── register.html
    ├── event.html            # details and booking
    ├── my-tickets.html
    ├── organizer.html
    ├── gate.html
    └── admin.html
```

## Models

| Model | Fields |
|---|---|
| **User** | name, email (unique), password (hashed), role (`attendee` / `organizer` / `staff` / `admin`), isApproved, createdAt |
| **Event** | title, description, posterUrl, venue, city, date, endDate, organizer (ref User), tiers[ name, price, capacity, sold ], status (`upcoming` / `live` / `ended`, derived), createdAt |
| **Ticket** | code (unique), event (ref), attendee (ref), tierName, price, status (`valid` / `used` / `cancelled`), usedAt, usedBy (ref User), createdAt |

Models never touch `req` or `res`. Passwords are hashed before saving and never returned in responses.

## Controllers

**authController:** `register`, `login`, `me`
**eventController:** `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `myEvents`, `eventStats`
**ticketController:** `bookTickets`, `myTickets`, `cancelTicket`, `verifyTicket`
**adminController:** `platformStats`, `listOrganizers`, `approveOrganizer`, `blockOrganizer`

### Booking logic (`bookTickets`)

1. Validate quantity (1 to 5) and that the event has not started
2. Increase the tier's `sold` count in a single atomic update that succeeds only if enough seats remain
3. If nothing was updated, reject with "not enough tickets"
4. Create the tickets, each with a fresh random code, and return them

The atomic update means two people booking the last ticket cannot both succeed.

### Verification logic (`verifyTicket`)

| Ticket state | Result |
|---|---|
| Code not found | Invalid (red) |
| `cancelled` | Cancelled (red) |
| `used` | Already used at [time] (red) |
| `valid` | Marked `used`, saves time and staff, shows Valid (green) with attendee and tier |

## Middleware

- **auth:** reads the Bearer token, verifies it, attaches `req.user`
- **role(...roles):** returns 403 if `req.user.role` is not allowed
- **ownership check:** inside event update and delete, `event.organizer` must equal `req.user.id`
- **errorHandler:** turns errors into JSON responses

Roles are always checked on the server. Hiding buttons in the pages is only cosmetic.

## API endpoints

### Auth
| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/register` | Public (role: attendee or organizer only) |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Logged in |

### Events
| Method | Route | Access |
|---|---|---|
| GET | `/api/events` (`?city=`, `?q=`) | Public |
| GET | `/api/events/mine` | Organizer |
| GET | `/api/events/:id` | Public |
| POST | `/api/events` | Approved organizer |
| PUT / DELETE | `/api/events/:id` | That event's organizer |
| GET | `/api/events/:id/stats` | Organizer |

Declare `/events/mine` before `/events/:id` in the routes file, otherwise "mine" is read as an id.

### Tickets
| Method | Route | Access |
|---|---|---|
| POST | `/api/tickets/book` | Attendee |
| GET | `/api/tickets/mine` | Attendee |
| PATCH | `/api/tickets/:id/cancel` | Attendee (before the event starts) |
| POST | `/api/tickets/verify` | Staff, organizer, admin |

### Admin
| Method | Route | Access |
|---|---|---|
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/organizers?status=pending` | Admin |
| PATCH | `/api/admin/organizers/:id/approve` | Admin |
| PATCH | `/api/admin/organizers/:id/block` | Admin |

## Pages (views)

| Page | Script | Shows |
|---|---|---|
| `index.html` | `home.js` | Hero, search, event cards with "X left" badge |
| `login.html`, `register.html` | `auth.js` | Forms; redirect by role after login |
| `event.html` | `event.js` | Poster, tier selector, live total, Book now |
| `my-tickets.html` | `tickets.js` | Perforated ticket cards with QR and Valid/Used badge |
| `organizer.html` | `organizer.js` | Create event form, my events, charts |
| `gate.html` | `gate.js` | Code input, full-screen green or red result |
| `admin.html` | `admin.js` | Stat cards, pending organizers, bar chart |

`api.js` is shared by all pages. It wraps `fetch` and attaches the JWT automatically.

After login: attendee goes to `index`, organizer to `organizer`, staff to `gate`, admin to `admin`.

## Getting started

1. Install dependencies

   ```
   npm install
   ```

2. Create a `.env` file in the project root

   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=choose_a_long_random_string
   ```

3. Start the server

   ```
   npm start
   ```

4. Open `http://localhost:4000`

The admin account is created manually (seed data), never through the register form.

## Demo flow (3 minutes)

1. Admin approves a new organizer
2. Organizer creates an event with two tiers
3. Attendee books two tickets and shows the QR
4. Gate staff verifies the ticket: green. Verify again: red, already used
5. Show the organizer charts and the admin dashboard

## Out of scope

Real payments, seat maps, and email delivery. Possible extras: cancel and refund status, download ticket as image.