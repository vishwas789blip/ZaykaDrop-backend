require("dotenv").config();

const OWNER_ID = "6aca92126c892053b0600db8";

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
  const db = require("./dist/config/db.js");
  await db.default();
  const pool = db.getPool();
  console.log("Connected to PostgreSQL");

  await pool.query("DELETE FROM menu_items");
  await pool.query("DELETE FROM restaurants");
  console.log("Cleared existing restaurants and menu items");

  for (const r of restaurants) {
    const { menu, autoLocation, ...restaurantData } = r;
    const [longitude, latitude] = autoLocation.coordinates;

    const { rows } = await pool.query(
      `INSERT INTO restaurants (
        name, description, image, owner_id, phone, is_verified,
        latitude, longitude, formatted_address, is_open
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name`,
      [
        restaurantData.name,
        restaurantData.description,
        restaurantData.image,
        OWNER_ID,
        restaurantData.phone,
        restaurantData.isVerified,
        latitude,
        longitude,
        autoLocation.formattedAddress,
        restaurantData.isOpen,
      ]
    );

    const restaurant = rows[0];

    for (const item of menu) {
      await pool.query(
        `INSERT INTO menu_items (restaurant_id, name, description, image, price, is_available)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [restaurant.id, item.name, item.description, item.image, item.price]
      );
    }

    console.log(`Seeded: ${restaurant.name} (${menu.length} items)`);
  }

  console.log("\nSeed complete! 6 Ghaziabad restaurants inserted.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
