import amqp from "amqplib";

let channel: amqp.Channel | null = null;

export const connectRabbitMQ = async () => {
  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is not defined");
  }

  if (!process.env.ORDER_READY_QUEUE) {
    throw new Error("ORDER_READY_QUEUE is not defined");
  }

  const connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  channel = await connection.createChannel();

  await channel.assertQueue(
    process.env.ORDER_READY_QUEUE,
    {
      durable: true,
    }
  );

  console.log(
    "RabbitMQ queue ready:",
    process.env.ORDER_READY_QUEUE
  );
};

export const getChannel = () => {
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  return channel;
};