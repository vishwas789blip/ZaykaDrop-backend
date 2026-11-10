import { getPool, isValidUUID } from "../config/db.js";

export interface IRestaurant {
  _id: string;
  name: string;
  description?: string | null;
  image: string;
  ownerId: string;
  phone: string;
  isVerified: boolean;
  autoLocation: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
    formattedAddress: string;
  };
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
  distance?: number;
  distanceKm?: number;
}

export const mapRestaurantRow = (row: any): IRestaurant => {
  const mapped: IRestaurant = {
    _id: row.id,
    name: row.name,
    description: row.description ?? null,
    image: row.image,
    ownerId: row.owner_id,
    phone: row.phone,
    isVerified: Boolean(row.is_verified),
    autoLocation: {
      type: "Point",
      coordinates: [Number(row.longitude), Number(row.latitude)],
      formattedAddress: row.formatted_address,
    },
    isOpen: Boolean(row.is_open),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.distance !== undefined && row.distance !== null) {
    const dist = Number(row.distance);
    mapped.distance = dist;
    mapped.distanceKm = Math.round((dist / 1000) * 100) / 100;
  }

  return mapped;
};

export const findRestaurantByOwnerId = async (
  ownerId: string
): Promise<IRestaurant | null> => {
  const { rows } = await getPool().query(
    `SELECT * FROM restaurants WHERE owner_id = $1 LIMIT 1`,
    [ownerId]
  );
  return rows[0] ? mapRestaurantRow(rows[0]) : null;
};

export const findRestaurantById = async (
  id: string
): Promise<IRestaurant | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM restaurants WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ? mapRestaurantRow(rows[0]) : null;
};

export const findRestaurantByIdAndOwner = async (
  id: string,
  ownerId: string
): Promise<IRestaurant | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM restaurants WHERE id = $1 AND owner_id = $2 LIMIT 1`,
    [id, ownerId]
  );
  return rows[0] ? mapRestaurantRow(rows[0]) : null;
};

export const createRestaurant = async (data: {
  name: string;
  description?: string;
  image: string;
  ownerId: string;
  phone: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  isVerified?: boolean;
  isOpen?: boolean;
}): Promise<IRestaurant> => {
  const { rows } = await getPool().query(
    `INSERT INTO restaurants (
      name, description, image, owner_id, phone, is_verified,
      latitude, longitude, formatted_address, is_open
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.name.trim(),
      data.description?.trim() ?? null,
      data.image,
      data.ownerId,
      data.phone,
      data.isVerified ?? false,
      data.latitude,
      data.longitude,
      data.formattedAddress,
      data.isOpen ?? false,
    ]
  );
  return mapRestaurantRow(rows[0]);
};

export const updateRestaurantStatusByOwner = async (
  ownerId: string,
  isOpen: boolean
): Promise<IRestaurant | null> => {
  const { rows } = await getPool().query(
    `UPDATE restaurants
     SET is_open = $1, updated_at = NOW()
     WHERE owner_id = $2
     RETURNING *`,
    [isOpen, ownerId]
  );
  return rows[0] ? mapRestaurantRow(rows[0]) : null;
};

export const updateRestaurantByOwner = async (
  ownerId: string,
  updates: { name?: string; description?: string; phone?: string }
): Promise<IRestaurant | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updates.name.trim());
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(updates.description.trim());
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(updates.phone);
  }

  if (fields.length === 0) {
    return findRestaurantByOwnerId(ownerId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(ownerId);

  const { rows } = await getPool().query(
    `UPDATE restaurants
     SET ${fields.join(", ")}
     WHERE owner_id = $${idx}
     RETURNING *`,
    values
  );

  return rows[0] ? mapRestaurantRow(rows[0]) : null;
};

export const findNearbyRestaurants = async (
  latitude: number,
  longitude: number,
  radiusMeters: number,
  search: string
): Promise<IRestaurant[]> => {
  const params: any[] = [latitude, longitude, radiusMeters];
  let searchFilter = "";

  if (search) {
    params.push(`%${search}%`);
    searchFilter = `AND name ILIKE $4`;
  }

  const { rows } = await getPool().query(
    `SELECT * FROM (
      SELECT *,
        (6371000 * 2 * ASIN(SQRT(LEAST(1.0,
          POWER(SIN(RADIANS(latitude - $1) / 2), 2) +
          COS(RADIANS($1)) * COS(RADIANS(latitude)) *
          POWER(SIN(RADIANS(longitude - $2) / 2), 2)
        )))) AS distance
      FROM restaurants
      WHERE is_verified = TRUE
      ${searchFilter}
    ) AS r
    WHERE r.distance <= $3
    ORDER BY r.is_open DESC, r.distance ASC`,
    params
  );

  return rows.map(mapRestaurantRow);
};
