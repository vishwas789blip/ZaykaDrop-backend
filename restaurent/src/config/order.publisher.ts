import { getChannel } from "./rabbitmq";

export const publishEvent = async (
    queueName: string, 
    type: string, 
    data: any
) => {
    const channel = getChannel();
    channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify({ type, data })),
        { persistent: true } // durable queue ke saath persistent message bhi zaroori
    );

    console.log(`Event published to ${queueName}:`, { type, data });
};