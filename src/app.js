require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth");
const dbConnect =require('./config/db')

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRouter);

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


