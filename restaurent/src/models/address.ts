import mongoose, { Schema, Document } from "mongoose";

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId | string;
  phone: number;
  formattedAddress: string;
  location: {
    type: "Point";
    coordinates: [number, number]; 
  };
  pincode: string;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: {
      type: Number,
      required: true,
      validate: {
        validator: function (v: number) {
          return /^\d{10}$/.test(v.toString());
        },
        message: "Mobile number must be a valid 10-digit sequence",
      },
    },
    formattedAddress: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number], 
        required: true,
      },
      
    },
    pincode: { 
        type: String, 
        required: true ,
    },

  },
  {
    timestamps: true,
  }
);

// GeoJSON indexing for geospatial queries ($near / $geoNear operations)
addressSchema.index({ location: "2dsphere" });

const Address = mongoose.model<IAddress>("Address", addressSchema);

export default Address;