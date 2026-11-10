import amqp from "amqplib";

let channel: amqp.Channel | null = null;

export const connectRabbitMQ = async () => {
  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is not defined");
  }

  const queue = process.env.ORDER_READY_QUEUE || "order_ready_queue";

  const connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  channel = await connection.createChannel();

  await channel.assertQueue(
    queue,
    {
      durable: true,
    }
  );

  console.log(
    "RabbitMQ queue ready:",
    queue
  );
};

export const getChannel = () => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  return channel;
};