import mongoose ,{Schema, Document} from "mongoose";

export interface IMenuItem extends Document{
    restaurantId: mongoose.Types.ObjectId;
    name: string;
    description: string;
    image?: string;
    price: number;
    isAvailable: boolean;
    createdAt:Date;
    updatedAt:Date;
}

const menuItemSchema = new Schema<IMenuItem>({
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant", 
      required: [true, "Restaurant ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Menu item name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: "", 
      required: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"], 
    },
    isAvailable: {
      type: Boolean,
      default: true, 
    },
  },
  {
    timestamps: true, 
  }
);

// Model export
export default mongoose.model<IMenuItem>("MenuItem", menuItemSchema);

