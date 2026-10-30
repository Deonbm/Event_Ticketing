const mongoose =require("mongoose");

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Database Connected Successfully');
        
    } catch (error) {
        console.error('Database Connection Error:', error);
        process.exit(1);
    }
}

module.exports = dbConnect;