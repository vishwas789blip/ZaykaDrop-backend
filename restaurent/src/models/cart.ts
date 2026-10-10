import mongoose, { Document, Schema } from "mongoose";

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  quantity: number;        
  createdAt: Date;         
  updatedAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,             
      default: 1,
    },
  },
  {
    timestamps: true,     
  }
);

CartSchema.index({ userId: 1, restaurantId: 1, itemId: 1 }, { unique: true });

const Cart = mongoose.model<ICart>("Cart", CartSchema);
export default Cart;