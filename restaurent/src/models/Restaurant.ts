import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  name: string;
  description?: string;
  image: string;
  ownerId: mongoose.Types.ObjectId;
  phone: string;
  isVerified: boolean;
  autoLocation: {
    type: "Point";
    coordinates: [number, number];  // [longitude, latitude]
    formattedAddress: string;
  };
  isOpen?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema: Schema = new Schema<IRestaurant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",               
      required: true,
    },
    phone: {
      type: String,              
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    autoLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      formattedAddress: {
        type: String,
        required: true,
      },
    },
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

RestaurantSchema.index({ autoLocation: "2dsphere" });

export default mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);