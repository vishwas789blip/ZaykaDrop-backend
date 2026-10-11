import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRider extends Document {
    userId: Types.ObjectId;
    picture: string;
    phoneNumber: string;
    aadharNumber: string;
    drivingLicenseNumber: string;
    isVerified: boolean;
    rating: {
        average: number;
        count: number;
    };
    vehicleNumber: string;
    location: {
        type: "Point";
        coordinates: [number, number];
    };
    isAvailable: boolean;
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const riderSchema = new Schema<IRider>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        picture: { type: String, required: true },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            match: [/^\d{10}$/, "Phone number must be 10 digits"],
        },
        aadharNumber: {
            type: String,
            required: true,
            unique: true,
            match: [/^\d{12}$/, "Aadhar number must be 12 digits"],
            select: false,
        },
        drivingLicenseNumber: {
            type: String,
            required: true,
            unique: true,
            select: false,
        },
        vehicleNumber: { type: String, required: true, uppercase: true },
        isVerified: { type: Boolean, default: true },
        rating: {
            average: { type: Number, default: 5, min: 0, max: 5 },
            count: { type: Number, default: 0 },
        },
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number],
                required: true,
                default: [0, 0],
            },
        },
        isAvailable: { type: Boolean, default: false },
        lastActiveAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

riderSchema.index({ location: "2dsphere" });

export default mongoose.model<IRider>("Rider", riderSchema);