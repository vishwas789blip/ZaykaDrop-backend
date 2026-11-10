import { getPool, isValidUUID } from "../config/db.js";

export interface IAddress {
  _id: string;
  userId: string;
  phone: number;
  formattedAddress: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  pincode: string;
  createdAt: Date;
  updatedAt: Date;
}

export const mapAddressRow = (row: any): IAddress => ({
  _id: row.id,
  userId: row.user_id,
  phone: Number(row.phone),
  formattedAddress: row.formatted_address,
  location: {
    type: "Point",
    coordinates: [Number(row.longitude), Number(row.latitude)],
  },
  pincode: row.pincode,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createAddress = async (data: {
  userId: string;
  phone: number;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  pincode: string;
}): Promise<IAddress> => {
  const { rows } = await getPool().query(
    `INSERT INTO addresses (user_id, phone, formatted_address, latitude, longitude, pincode)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.userId,
      data.phone,
      data.formattedAddress.trim(),
      data.latitude,
      data.longitude,
      data.pincode,
    ]
  );
  return mapAddressRow(rows[0]);
};

export const findAddressByIdAndUser = async (
  id: string,
  userId: string
): Promise<IAddress | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM addresses WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, userId]
  );
  return rows[0] ? mapAddressRow(rows[0]) : null;
};

export const deleteAddressByIdAndUser = async (
  id: string,
  userId: string
): Promise<boolean> => {
  if (!isValidUUID(id)) return false;
  const { rowCount } = await getPool().query(
    `DELETE FROM addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
};

export const findAddressesByUser = async (
  userId: string
): Promise<IAddress[]> => {
  const { rows } = await getPool().query(
    `SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(mapAddressRow);
};
