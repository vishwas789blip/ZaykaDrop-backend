import { getPool, isValidUUID } from "../config/db";

export interface IRider {
  _id: string;
  userId: string;
  picture: string;
  phoneNumber: string;
  aadharNumber?: string;
  drivingLicenseNumber?: string;
  isVerified: boolean;
  rating: {
    average: number;
    count: number;
  };
  vehicleNumber: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  isAvailable: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mapRiderRow = (row: any): IRider => ({
  _id: row.id,
  userId: row.user_id,
  picture: row.picture,
  phoneNumber: row.phone_number,
  vehicleNumber: row.vehicle_number,
  isVerified: Boolean(row.is_verified),
  rating: {
    average: Number(row.rating_average),
    count: Number(row.rating_count),
  },
  location: {
    type: "Point",
    coordinates: [Number(row.longitude), Number(row.latitude)],
  },
  isAvailable: Boolean(row.is_available),
  lastActiveAt: row.last_active_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findRiderByUserId = async (
  userId: string
): Promise<IRider | null> => {
  const { rows } = await getPool().query(
    `SELECT * FROM riders WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const createRider = async (data: {
  userId: string;
  picture: string;
  phoneNumber: string;
  aadharNumber: string;
  drivingLicenseNumber: string;
  vehicleNumber: string;
  latitude: number;
  longitude: number;
  isAvailable?: boolean;
  isVerified?: boolean;
}): Promise<IRider> => {
  const { rows } = await getPool().query(
    `INSERT INTO riders (
      user_id, picture, phone_number, aadhar_number, driving_license_number,
      vehicle_number, latitude, longitude, is_available, is_verified
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.userId,
      data.picture,
      data.phoneNumber,
      data.aadharNumber,
      data.drivingLicenseNumber,
      data.vehicleNumber.toUpperCase(),
      data.latitude,
      data.longitude,
      data.isAvailable ?? false,
      data.isVerified ?? true,
    ]
  );
  return mapRiderRow(rows[0]);
};

export const markRiderVerifiedByUserId = async (
  userId: string
): Promise<IRider | null> => {
  const { rows } = await getPool().query(
    `UPDATE riders
     SET is_verified = TRUE, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const updateRiderAvailabilityAndLocation = async (
  userId: string,
  isAvailable: boolean,
  latitude: number,
  longitude: number
): Promise<IRider | null> => {
  const { rows } = await getPool().query(
    `UPDATE riders
     SET
       is_available = $1,
       latitude = $2,
       longitude = $3,
       last_active_at = NOW(),
       updated_at = NOW()
     WHERE user_id = $4
     RETURNING *`,
    [isAvailable, latitude, longitude, userId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const claimRiderUnavailable = async (
  userId: string
): Promise<IRider | null> => {
  const { rows } = await getPool().query(
    `UPDATE riders
     SET is_available = FALSE, updated_at = NOW()
     WHERE user_id = $1 AND is_available = TRUE
     RETURNING *`,
    [userId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const setRiderAvailableById = async (
  riderId: string
): Promise<IRider | null> => {
  if (!isValidUUID(riderId)) return null;
  const { rows } = await getPool().query(
    `UPDATE riders
     SET is_available = TRUE, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [riderId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const updateRiderLocationByUserId = async (
  userId: string,
  latitude: number,
  longitude: number
): Promise<IRider | null> => {
  const { rows } = await getPool().query(
    `UPDATE riders
     SET
       latitude = $1,
       longitude = $2,
       last_active_at = NOW(),
       updated_at = NOW()
     WHERE user_id = $3
     RETURNING *`,
    [latitude, longitude, userId]
  );
  return rows[0] ? mapRiderRow(rows[0]) : null;
};

export const findNearbyAvailableRiders = async (
  latitude: number,
  longitude: number,
  maxDistanceMeters: number = 5000
): Promise<IRider[]> => {
  const { rows } = await getPool().query(
    `SELECT * FROM (
      SELECT *,
        (6371000 * 2 * ASIN(SQRT(LEAST(1.0,
          POWER(SIN(RADIANS(latitude - $1) / 2), 2) +
          COS(RADIANS($1)) * COS(RADIANS(latitude)) *
          POWER(SIN(RADIANS(longitude - $2) / 2), 2)
        )))) AS distance
      FROM riders
      WHERE is_available = TRUE AND is_verified = TRUE
    ) AS r
    WHERE r.distance <= $3
    ORDER BY r.distance ASC`,
    [latitude, longitude, maxDistanceMeters]
  );
  return rows.map(mapRiderRow);
};
