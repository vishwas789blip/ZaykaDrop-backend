import { getPool, isValidUUID } from "../config/db.js";
import { IMenuItem } from "./MenuItems.js";
import { IRestaurant } from "./Restaurant.js";

export interface ICart {
  _id: string;
  userId: string;
  restaurantId: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPopulatedCart {
  _id: string;
  userId: string;
  restaurantId: IRestaurant;
  itemId: IMenuItem;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const mapCartRow = (row: any): ICart => ({
  _id: row.id,
  userId: row.user_id,
  restaurantId: row.restaurant_id,
  itemId: row.item_id,
  quantity: Number(row.quantity),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findDifferentRestaurantInCart = async (
  userId: string,
  restaurantId: string
): Promise<ICart | null> => {
  const { rows } = await getPool().query(
    `SELECT * FROM carts
     WHERE user_id = $1 AND restaurant_id <> $2
     LIMIT 1`,
    [userId, restaurantId]
  );
  return rows[0] ? mapCartRow(rows[0]) : null;
};

export const upsertIncrementCartItem = async (
  userId: string,
  restaurantId: string,
  itemId: string
): Promise<ICart> => {
  const { rows } = await getPool().query(
    `INSERT INTO carts (user_id, restaurant_id, item_id, quantity)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, restaurant_id, item_id)
     DO UPDATE SET
       quantity = carts.quantity + 1,
       updated_at = NOW()
     RETURNING *`,
    [userId, restaurantId, itemId]
  );
  return mapCartRow(rows[0]);
};

export const findPopulatedCartByUser = async (
  userId: string
): Promise<IPopulatedCart[]> => {
  const { rows } = await getPool().query(
    `SELECT
       c.id AS cart_id,
       c.user_id AS cart_user_id,
       c.quantity AS cart_quantity,
       c.created_at AS cart_created_at,
       c.updated_at AS cart_updated_at,

       m.id AS menu_id,
       m.restaurant_id AS menu_restaurant_id,
       m.name AS menu_name,
       m.description AS menu_description,
       m.image AS menu_image,
       m.price AS menu_price,
       m.is_available AS menu_is_available,
       m.created_at AS menu_created_at,
       m.updated_at AS menu_updated_at,

       r.id AS rest_id,
       r.name AS rest_name,
       r.description AS rest_description,
       r.image AS rest_image,
       r.owner_id AS rest_owner_id,
       r.phone AS rest_phone,
       r.is_verified AS rest_is_verified,
       r.latitude AS rest_latitude,
       r.longitude AS rest_longitude,
       r.formatted_address AS rest_formatted_address,
       r.is_open AS rest_is_open,
       r.created_at AS rest_created_at,
       r.updated_at AS rest_updated_at
     FROM carts c
     INNER JOIN menu_items m ON m.id = c.item_id
     INNER JOIN restaurants r ON r.id = c.restaurant_id
     WHERE c.user_id = $1
     ORDER BY c.created_at ASC`,
    [userId]
  );

  return rows.map((row) => ({
    _id: row.cart_id,
    userId: row.cart_user_id,
    quantity: Number(row.cart_quantity),
    createdAt: row.cart_created_at,
    updatedAt: row.cart_updated_at,
    itemId: {
      _id: row.menu_id,
      restaurantId: row.menu_restaurant_id,
      name: row.menu_name,
      description: row.menu_description ?? "",
      image: row.menu_image ?? "",
      price: Number(row.menu_price),
      isAvailable: Boolean(row.menu_is_available),
      createdAt: row.menu_created_at,
      updatedAt: row.menu_updated_at,
    },
    restaurantId: {
      _id: row.rest_id,
      name: row.rest_name,
      description: row.rest_description ?? null,
      image: row.rest_image,
      ownerId: row.rest_owner_id,
      phone: row.rest_phone,
      isVerified: Boolean(row.rest_is_verified),
      autoLocation: {
        type: "Point",
        coordinates: [Number(row.rest_longitude), Number(row.rest_latitude)],
        formattedAddress: row.rest_formatted_address,
      },
      isOpen: Boolean(row.rest_is_open),
      createdAt: row.rest_created_at,
      updatedAt: row.rest_updated_at,
    },
  }));
};

export const decrementOrDeleteCartItem = async (
  userId: string,
  itemId: string
): Promise<"decremented" | "deleted" | "not_found"> => {
  if (!isValidUUID(itemId)) return "not_found";

  const { rows } = await getPool().query(
    `SELECT id, quantity FROM carts WHERE user_id = $1 AND item_id = $2 LIMIT 1`,
    [userId, itemId]
  );

  const existing = rows[0];
  if (!existing) return "not_found";

  if (Number(existing.quantity) > 1) {
    await getPool().query(
      `UPDATE carts SET quantity = quantity - 1, updated_at = NOW() WHERE id = $1`,
      [existing.id]
    );
    return "decremented";
  }

  await getPool().query(`DELETE FROM carts WHERE id = $1`, [existing.id]);
  return "deleted";
};

export const clearCartByUser = async (userId: string): Promise<void> => {
  await getPool().query(`DELETE FROM carts WHERE user_id = $1`, [userId]);
};
