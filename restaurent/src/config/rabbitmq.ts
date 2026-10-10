import amqp from "amqplib";

let channel: amqp.Channel | null = null;

export const connectRabbitMQ = async () => {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL as string
  );

  channel = await connection.createChannel();

  const queue = process.env.ORDER_READY_QUEUE;

  if (!queue) {
    throw new Error("ORDER_READY_QUEUE is not defined");
  }

  await channel.assertQueue(queue, {
    durable: true,
  });

  console.log("Restaurant RabbitMQ queue ready:", queue);
};

export const getChannel = () => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  return channel;
};