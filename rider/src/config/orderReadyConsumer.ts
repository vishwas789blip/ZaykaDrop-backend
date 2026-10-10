import axios from "axios";
import { getChannel } from "./rabbitmq";
import Rider from "../models/rider";

export const startOrderReadyConsumer = async () => {
  const channel = getChannel();

  const queueName = process.env.ORDER_READY_QUEUE as string;

  console.log("Starting to consume from", queueName);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    try {
      console.log(
        "Received message from order_ready_queue:",
        msg.content.toString()
      );

      const event = JSON.parse(msg.content.toString());

      console.log("Parsed event:", event);

      if (event.type !== "order_ready_for_rider") {
        console.log("Ignoring irrelevant event type:", event.type);
        channel.ack(msg);
        return;
      }

      const {
        orderId,
        restaurantId,
        restaurantName,
        location,
        pickupAddress,
        dropAddress,
        distance,
        riderAmount,
      } = event.data;

      const riders = await Rider.find({
        isAvailable: true,
        isVerified: true,
        location: {
          $near: {
            $geometry: location,
            $maxDistance: 5000,
          },
        },
      });

      console.log(`Found ${riders.length} nearby riders for order ${orderId}`);

      if (riders.length === 0) {
        console.warn(
          `⚠️ No nearby available riders found for order ${orderId}. Order remains in ready_for_rider state.`
        );
        channel.ack(msg);
        return;
      }

      for (const rider of riders) {
        await axios.post(
          `${process.env.REALTIME_SERVICE}/api/v1/internal/emit`,
          {
            event: "order:available",
            room: `user:${rider.userId}`,
            payload: {
              orderId,
              restaurantId,
              restaurantName: restaurantName || "Restaurant",
              location,
              pickupAddress,
              dropAddress,
              distance,
              riderAmount,
            },
          },
          {
            headers: {
              "x-internal-key": process.env.INTERNAL_SERVICE_KEY,
            },
          }
        );
      }

      console.log(`✅ Notifications sent for order ${orderId}`);
      channel.ack(msg);

    } catch (error) {
      console.error(
        "❌ Error while processing RabbitMQ message:",
        error
      );

      // Discard or dead-letter rather than infinite retry loop
      channel.nack(msg, false, false);
    }
  });
};