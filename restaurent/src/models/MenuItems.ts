import { getPool, isValidUUID } from "../config/db.js";

export interface IMenuItem {
  _id: string;
  restaurantId: string;
  name: string;
  description: string;
  image?: string;
  price: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const mapMenuItemRow = (row: any): IMenuItem => ({
  _id: row.id,
  restaurantId: row.restaurant_id,
  name: row.name,
  description: row.description ?? "",
  image: row.image ?? "",
  price: Number(row.price),
  isAvailable: Boolean(row.is_available),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createMenuItem = async (data: {
  restaurantId: string;
  name: string;
  description?: string;
  image: string;
  price: number;
  isAvailable?: boolean;
}): Promise<IMenuItem> => {
  const { rows } = await getPool().query(
    `INSERT INTO menu_items (restaurant_id, name, description, image, price, is_available)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.restaurantId,
      data.name.trim(),
      data.description?.trim() ?? "",
      data.image,
      data.price,
      data.isAvailable ?? true,
    ]
  );
  return mapMenuItemRow(rows[0]);
};

export const findMenuItemsByRestaurantId = async (
  restaurantId: string
): Promise<IMenuItem[]> => {
  if (!isValidUUID(restaurantId)) return [];
  const { rows } = await getPool().query(
    `SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY created_at DESC`,
    [restaurantId]
  );
  return rows.map(mapMenuItemRow);
};

export const findMenuItemById = async (
  id: string
): Promise<IMenuItem | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM menu_items WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapMenuItemRow(rows[0]) : null;
};

export const findAvailableMenuItem = async (
  itemId: string,
  restaurantId: string
): Promise<IMenuItem | null> => {
  if (!isValidUUID(itemId) || !isValidUUID(restaurantId)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM menu_items
     WHERE id = $1 AND restaurant_id = $2 AND is_available = TRUE
     LIMIT 1`,
    [itemId, restaurantId]
  );
  return rows[0] ? mapMenuItemRow(rows[0]) : null;
};

export const deleteMenuItemById = async (id: string): Promise<boolean> => {
  if (!isValidUUID(id)) return false;
  const { rowCount } = await getPool().query(
    `DELETE FROM menu_items WHERE id = $1`,
    [id]
  );
  return (rowCount ?? 0) > 0;
};

export const toggleMenuItemAvailabilityById = async (
  id: string
): Promise<IMenuItem | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `UPDATE menu_items
     SET is_available = NOT is_available, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] ? mapMenuItemRow(rows[0]) : null;
};
