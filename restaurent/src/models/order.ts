import  mongoose ,{ Document} from 'mongoose';

export interface IOrder extends Document {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  riderId?: string | null;
  riderPhone: string | number | null;
  riderName: string | null;
  distance: number;
  riderAmount: number;

  items: {
    itemId: string;
    name: string;
    price: number;
    quantity: number; 
  }[];

  subtotal: number;
  deliveryFee: number;
  platformFee: number; 
  totalAmount: number;

  addressId: string;

  deliveryAddress: {
    formattedAddress: string; 
    mobile: number;
    latitude: number;
    longitude: number;
  };

  pickupAddress?: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };

  riderLocation?: {
    latitude: number;
    longitude: number;
  };

  status:
    | "placed"
    | "accepted"
    | "preparing" 
    | "ready_for_rider"
    | "rider_assigned"
    | "picked_up"
    | "delivered"
    | "cancelled";
  
    paymentMethod: "COD" | "Razorpay" | "Stripe";
    paymentStatus: "pending" | "paid" | "failed";

    expiredAt : Date;

    createdAt: Date;
    updatedAt: Date;
}


const OrderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  restaurantId: {
    type: String,
    required: true
  },
  restaurantName: {
    type: String,
    required: true
  },
  riderId: {
    type: String,
    default: null
  },
  riderPhone: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  riderName: {
    type: String,
    default: null
  },
  riderLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  distance: {
    type: Number,
    required: true
  },
  riderAmount: {
    type: Number,
    default: 0
  },
  items: [
    {
      itemId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true } 
    }
  ],
  subtotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    required: true 
  },
  totalAmount: {
    type: Number,
    required: true
  },
  addressId: {
    type: String,
    required: true
  },
  deliveryAddress: {
    formattedAddress: { type: String, required: true }, 
    mobile: { type: Number, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  pickupAddress: {
    formattedAddress: { type: String },
    latitude: { type: Number },
    longitude: { type: Number }
  },
  status: {
    type: String,
    enum: [
      'placed',
      'accepted',
      'preparing', 
      'ready_for_rider',
      'rider_assigned',
      'picked_up',
      'delivered',
      'cancelled'
    ],
    default: 'placed',
    required: true
  },
  paymentMethod:{
    type:String,
    enum:["COD","Razorpay","Stripe"],
    required:true
  },
  paymentStatus: {
    type: String,
    enum: ["pending","paid","failed"],
    default: "pending",
    required: true
  },
  expiredAt:{
    type: Date,
    index: { expireAfterSeconds: 0 } 
  }
}, {
  timestamps: true 
});

export default mongoose.model<IOrder>('Order', OrderSchema);