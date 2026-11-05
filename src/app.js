require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth");
const eventRouter =require('./routes/events')
const adminRouter =require('./routes/admin')
const ticketRouter =require('./routes/ticket')
const dbConnect =require('./config/db')


const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true,
  }));
app.use('/auth', authRouter);
app.use('/events', eventRouter);
app.use('/admin',adminRouter); 
app.use('/tickets', ticketRouter);

const Start_Server = async () => {
    await dbConnect();

    app.listen(3000, () => {
    console.log("EventServer is running on port 3000");
    })
}

Start_Server();

app.get("/", (req, res) => {
    res.send("Welcome to the Event Ticketing System");
})


