import { PoolClient } from "pg";
import { getPool, isValidUUID, withTransaction } from "../config/db.js";

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready_for_rider"
  | "rider_assigned"
  | "picked_up"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "COD" | "Razorpay" | "Stripe";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface IOrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder {
  _id: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  riderId: string | null;
  riderPhone: string | number | null;
  riderName: string | null;
  distance: number;
  riderAmount: number;
  items: IOrderItem[];
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
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  expiredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const mapOrderRow = (row: any, items: IOrderItem[]): IOrder => {
  const order: IOrder = {
    _id: row.id,
    userId: row.user_id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    riderId: row.rider_id ?? null,
    riderPhone: row.rider_phone ?? null,
    riderName: row.rider_name ?? null,
    distance: Number(row.distance),
    riderAmount: Number(row.rider_amount),
    items,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    platformFee: Number(row.platform_fee),
    totalAmount: Number(row.total_amount),
    addressId: row.address_id,
    deliveryAddress: {
      formattedAddress: row.delivery_formatted_address,
      mobile: Number(row.delivery_mobile),
      latitude: Number(row.delivery_latitude),
      longitude: Number(row.delivery_longitude),
    },
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    expiredAt: row.expired_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.pickup_formatted_address !== null && row.pickup_formatted_address !== undefined) {
    order.pickupAddress = {
      formattedAddress: row.pickup_formatted_address,
      latitude: Number(row.pickup_latitude ?? 0),
      longitude: Number(row.pickup_longitude ?? 0),
    };
  }

  if (row.rider_latitude !== null && row.rider_longitude !== null && row.rider_latitude !== undefined && row.rider_longitude !== undefined) {
    order.riderLocation = {
      latitude: Number(row.rider_latitude),
      longitude: Number(row.rider_longitude),
    };
  }

  return order;
};

const hydrateOrderItems = async (
  orderRows: any[],
  client?: PoolClient
): Promise<IOrder[]> => {
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((r) => r.id);
  const runner = client ?? getPool();
  const { rows: itemRows } = await runner.query(
    `SELECT order_id, item_id, name, price, quantity
     FROM order_items
     WHERE order_id = ANY($1::uuid[])`,
    [orderIds]
  );

  const itemsByOrderId = new Map<string, IOrderItem[]>();
  for (const item of itemRows) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({
      itemId: item.item_id,
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
    });
    itemsByOrderId.set(item.order_id, list);
  }

  return orderRows.map((row) =>
    mapOrderRow(row, itemsByOrderId.get(row.id) ?? [])
  );
};

export const createOrderAndClearCart = async (data: {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  distance: number;
  riderAmount: number;
  items: IOrderItem[];
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
  pickupAddress: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  expiredAt?: Date;
}): Promise<IOrder> => {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO orders (
        user_id, restaurant_id, restaurant_name, rider_id, distance, rider_amount,
        subtotal, delivery_fee, platform_fee, total_amount, address_id,
        delivery_formatted_address, delivery_mobile, delivery_latitude, delivery_longitude,
        pickup_formatted_address, pickup_latitude, pickup_longitude,
        status, payment_method, payment_status, expired_at
      ) VALUES (
        $1, $2, $3, NULL, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21
      )
      RETURNING *`,
      [
        data.userId,
        data.restaurantId,
        data.restaurantName,
        data.distance,
        data.riderAmount,
        data.subtotal,
        data.deliveryFee,
        data.platformFee,
        data.totalAmount,
        data.addressId,
        data.deliveryAddress.formattedAddress,
        data.deliveryAddress.mobile,
        data.deliveryAddress.latitude,
        data.deliveryAddress.longitude,
        data.pickupAddress.formattedAddress,
        data.pickupAddress.latitude,
        data.pickupAddress.longitude,
        data.status,
        data.paymentMethod,
        data.paymentStatus,
        data.expiredAt ?? null,
      ]
    );

    const createdRow = rows[0];

    for (const item of data.items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_id, name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdRow.id, item.itemId, item.name, item.price, item.quantity]
      );
    }

    await client.query(`DELETE FROM carts WHERE user_id = $1`, [data.userId]);

    return mapOrderRow(createdRow, data.items);
  });
};

export const findOrderById = async (id: string): Promise<IOrder | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE id = $1
       AND (expired_at IS NULL OR expired_at > NOW() OR payment_status = 'paid')
     LIMIT 1`,
    [id]
  );
  const hydrated = await hydrateOrderItems(rows);
  return hydrated[0] ?? null;
};

export const findOrdersByRestaurant = async (
  restaurantId: string,
  statuses?: string[],
  limit?: number
): Promise<IOrder[]> => {
  if (!isValidUUID(restaurantId)) return [];

  const params: any[] = [restaurantId];
  let statusCondition = "";
  let limitClause = "";

  if (statuses && statuses.length > 0) {
    params.push(statuses);
    statusCondition = `AND status = ANY($${params.length}::text[])`;
  }

  if (limit && limit > 0) {
    params.push(limit);
    limitClause = `LIMIT $${params.length}`;
  }

  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE restaurant_id = $1
       AND payment_status = 'paid'
       ${statusCondition}
     ORDER BY created_at DESC
     ${limitClause}`,
    params
  );

  return hydrateOrderItems(rows);
};

export const findPaidOrdersByUser = async (userId: string): Promise<IOrder[]> => {
  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE user_id = $1 AND payment_status = 'paid'
     ORDER BY created_at DESC`,
    [userId]
  );
  return hydrateOrderItems(rows);
};

export const updateOrderStatusById = async (
  id: string,
  status: OrderStatus
): Promise<IOrder | null> => {
  if (!isValidUUID(id)) return null;
  const { rows } = await getPool().query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  const hydrated = await hydrateOrderItems(rows);
  return hydrated[0] ?? null;
};

export const assignRiderAtomic = async (data: {
  orderId: string;
  riderId: string;
  riderPhone?: string | number | null;
  riderName?: string | null;
  riderLocation?: { latitude: number; longitude: number } | undefined;
}): Promise<IOrder | null> => {
  if (!isValidUUID(data.orderId)) return null;

  const { rows } = await getPool().query(
    `UPDATE orders
     SET
       rider_id = $1,
       rider_phone = $2,
       rider_name = $3,
       rider_latitude = COALESCE($4, rider_latitude),
       rider_longitude = COALESCE($5, rider_longitude),
       status = 'rider_assigned',
       updated_at = NOW()
     WHERE id = $6
       AND rider_id IS NULL
       AND status = 'ready_for_rider'
     RETURNING *`,
    [
      data.riderId,
      data.riderPhone !== undefined && data.riderPhone !== null
        ? String(data.riderPhone)
        : null,
      data.riderName ?? null,
      data.riderLocation?.latitude ?? null,
      data.riderLocation?.longitude ?? null,
      data.orderId,
    ]
  );

  const hydrated = await hydrateOrderItems(rows);
  return hydrated[0] ?? null;
};

export const findCurrentOrdersForRider = async (
  riderId: string
): Promise<IOrder[]> => {
  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE rider_id = $1
       AND status IN ('rider_assigned', 'picked_up')
     ORDER BY updated_at DESC`,
    [riderId]
  );
  return hydrateOrderItems(rows);
};

export const findRiderOrderHistory = async (
  riderId: string
): Promise<IOrder[]> => {
  const { rows } = await getPool().query(
    `SELECT * FROM orders
     WHERE rider_id = $1
       AND status = 'delivered'
     ORDER BY updated_at DESC`,
    [riderId]
  );
  return hydrateOrderItems(rows);
};

export const markOrderPaidAtomic = async (
  orderId: string
): Promise<IOrder | null> => {
  if (!isValidUUID(orderId)) return null;
  const { rows } = await getPool().query(
    `UPDATE orders
     SET payment_status = 'paid', expired_at = NULL, updated_at = NOW()
     WHERE id = $1 AND payment_status <> 'paid'
     RETURNING *`,
    [orderId]
  );
  const hydrated = await hydrateOrderItems(rows);
  return hydrated[0] ?? null;
};
