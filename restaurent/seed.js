require("dotenv").config();
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String, default: "" },
    price: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    autoLocation: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
      formattedAddress: { type: String, required: true },
    },
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);
restaurantSchema.index({ autoLocation: "2dsphere" });

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
const MenuItem = mongoose.model("MenuItem", menuItemSchema);

const OWNER_ID = new mongoose.Types.ObjectId("6a829506df27845a48b94863");

const restaurants = [
  {
    name: "Pahadi Dhaba",
    description: "Authentic homestyle food with a royal Rajasthani feel",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
    phone: "9876543210",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4429262, 28.6307001],
      formattedAddress: "Ghaziabad, Uttar Pradesh 201001, India",
    },
    menu: [
      { name: "Dal Baati Churma", description: "Rajasthan's iconic dish - baked baati with dal and churma", price: 180, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
      { name: "Ker Sangri", description: "Desert beans and berries cooked in Rajasthani spices", price: 130, image: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=400" },
      { name: "Gatte ki Sabzi", description: "Gram flour dumplings in tangy yogurt gravy", price: 120, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
      { name: "Bajre ki Roti", description: "Pearl millet flatbread served with white butter", price: 40, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400" },
      { name: "Malpua", description: "Sweet fried pancakes soaked in sugar syrup", price: 70, image: "https://images.unsplash.com/photo-1516100882582-96c3a05fe590?w=400" },
    ],
  },
  {
    name: "Zaika-e-Punjab",
    description: "Rich Punjabi flavours, tandoor specials and buttery gravies",
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=800",
    phone: "9812345670",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4520, 28.6420],
      formattedAddress: "Kavi Nagar, Ghaziabad, Uttar Pradesh 201002, India",
    },
    menu: [
      { name: "Butter Chicken", description: "Tender chicken in rich tomato-butter gravy", price: 280, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400" },
      { name: "Dal Makhani", description: "Slow-cooked black lentils with cream and butter", price: 180, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
      { name: "Amritsari Kulcha", description: "Stuffed kulcha with chole, served with white butter", price: 120, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400" },
      { name: "Lassi (Sweet)", description: "Thick chilled yogurt drink topped with malai", price: 70, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400" },
      { name: "Paneer Tikka", description: "Marinated cottage cheese grilled in tandoor", price: 220, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400" },
      { name: "Tandoori Roti", description: "Whole wheat bread baked fresh in clay tandoor", price: 30, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400" },
    ],
  },
  {
    name: "Biryani Brothers",
    description: "Dum biryani specialists - Hyderabadi and Lucknowi styles",
    image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=800",
    phone: "9756123450",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4350, 28.6650],
      formattedAddress: "Raj Nagar, Ghaziabad, Uttar Pradesh 201017, India",
    },
    menu: [
      { name: "Hyderabadi Chicken Dum Biryani", description: "Slow-cooked dum biryani with whole spices", price: 320, image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=400" },
      { name: "Veg Dum Biryani", description: "Fragrant basmati with seasonal vegetables", price: 220, image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=400" },
      { name: "Mutton Biryani", description: "Tender mutton pieces with saffron-infused rice", price: 380, image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=400" },
      { name: "Raita", description: "Chilled cucumber yogurt dip", price: 50, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400" },
      { name: "Seekh Kebab (4 pcs)", description: "Minced meat kebabs with mint chutney", price: 160, image: "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=400" },
    ],
  },
  {
    name: "South Tiffin House",
    description: "Authentic South Indian breakfast and meals all day",
    image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=800",
    phone: "9634512780",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4180, 28.6200],
      formattedAddress: "Vaishali, Ghaziabad, Uttar Pradesh 201010, India",
    },
    menu: [
      { name: "Masala Dosa", description: "Crispy rice crepe with spiced potato filling", price: 110, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400" },
      { name: "Idli Sambar (3 pcs)", description: "Steamed rice cakes with lentil soup and chutneys", price: 80, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400" },
      { name: "Medu Vada (2 pcs)", description: "Crispy lentil doughnuts with coconut chutney", price: 70, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400" },
      { name: "Uttapam", description: "Thick rice pancake topped with onion and tomato", price: 100, image: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400" },
      { name: "Filter Coffee", description: "Strong South Indian decoction with frothy milk", price: 50, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400" },
      { name: "Chettinad Chicken Curry", description: "Spicy Tamil Nadu specialty with coconut and pepper", price: 260, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
    ],
  },
  {
    name: "Burger Junction",
    description: "Loaded burgers, crispy fries and thick shakes - fast food done right",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
    phone: "9512367890",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4610, 28.6150],
      formattedAddress: "Indirapuram, Ghaziabad, Uttar Pradesh 201014, India",
    },
    menu: [
      { name: "Classic Smash Burger", description: "Double smash patty with cheese, lettuce and special sauce", price: 199, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400" },
      { name: "Crispy Chicken Burger", description: "Fried chicken fillet with coleslaw and chipotle mayo", price: 179, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400" },
      { name: "Paneer Tikka Burger", description: "Grilled paneer patty with mint chutney and onion rings", price: 159, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400" },
      { name: "Loaded Fries", description: "Crispy fries topped with cheese sauce and jalapenos", price: 120, image: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=400" },
      { name: "Oreo Thick Shake", description: "Chilled blended Oreo milkshake with whipped cream", price: 140, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400" },
    ],
  },
  {
    name: "Maa Ki Rasoi",
    description: "Pure veg homestyle Indian thali - ghar jaisa khana",
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    phone: "9412378960",
    isVerified: true,
    isOpen: true,
    autoLocation: {
      type: "Point",
      coordinates: [77.4050, 28.6480],
      formattedAddress: "Sahibabad, Ghaziabad, Uttar Pradesh 201005, India",
    },
    menu: [
      { name: "Full Thali", description: "Dal, sabzi, rice, 3 rotis, raita, salad and papad", price: 160, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400" },
      { name: "Rajma Chawal", description: "Slow-cooked kidney beans with steamed basmati rice", price: 130, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400" },
      { name: "Kadhi Pakora", description: "Yogurt-based curry with fried gram flour fritters", price: 110, image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400" },
      { name: "Palak Paneer", description: "Cottage cheese cubes in creamy spinach gravy", price: 170, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400" },
      { name: "Gulab Jamun (2 pcs)", description: "Soft milk-solid dumplings soaked in rose sugar syrup", price: 60, image: "https://images.unsplash.com/photo-1516100882582-96c3a05fe590?w=400" },
      { name: "Masala Chaas", description: "Chilled spiced buttermilk with cumin and coriander", price: 40, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400" },
    ],
  },
];

async function seed() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/ZaykaDrop";

  await mongoose.connect(MONGO_URI, { dbName: "ZaykaDrop" });
  console.log("Connected to MongoDB (ZaykaDrop database)");
  
  await Restaurant.deleteMany({});
  await MenuItem.deleteMany({});
  console.log("Cleared existing restaurants and menu items");

  for (const r of restaurants) {
    const { menu, ...restaurantData } = r;

    const restaurant = await Restaurant.create({
      ...restaurantData,
      ownerId: OWNER_ID,
    });

    const menuItems = menu.map((item) => ({
      ...item,
      restaurantId: restaurant._id,
      isAvailable: true,
    }));

    await MenuItem.insertMany(menuItems);
    console.log(`Seeded: ${restaurant.name} (${menu.length} items)`);
  }

  console.log("\nSeed complete! 6 Ghaziabad restaurants inserted.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});