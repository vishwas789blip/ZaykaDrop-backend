import mongoose from "mongoose";

const connectDB = async() => {
    try{
        await mongoose.connect(process.env.MONGO_URI as string,{
            dbName: "ZaykaDrop",
        });

        console.log("connected to mongoose")
    }catch (error){
        console.log(error);
    }
};
export default connectDB