import amqp from "amqplib";

let channel: amqp.Channel | undefined;

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await connection.createChannel();

    connection.on("error", (err) => console.error("RabbitMQ connection error:", err));
    connection.on("close", () => console.warn("RabbitMQ connection closed"));

    console.log("🐇 Connected to RabbitMQ");
  } catch (err) {
    console.warn("Could not connect to RabbitMQ (utils service will run without it):", err);
    // Non-fatal — utils service primarily serves HTTP uploads
  }
};

export const getChannel = () => {
  if (!channel) throw new Error("RabbitMQ not connected yet");
  return channel;
};