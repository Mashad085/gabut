import amqplib from 'amqplib';

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    
    // Queue definitions
    this.queues = {
      NOTIFICATIONS: 'notifications',
      TRANSACTIONS: 'transactions.process',
      EMAILS: 'emails.send',
      SCHEDULED: 'scheduled.jobs',
      AUDIT: 'audit.logs',
    };

    // Exchange definitions
    this.exchanges = {
      FINANCE: 'finance.events',
      NOTIFICATIONS: 'notifications.fanout',
    };
  }

  async connect() {
    try {
      this.connection = await amqplib.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Set prefetch for fair dispatch
      await this.channel.prefetch(10);
      
      // Declare exchanges
      await this.channel.assertExchange(this.exchanges.FINANCE, 'topic', { durable: true });
      await this.channel.assertExchange(this.exchanges.NOTIFICATIONS, 'fanout', { durable: true });
      
      // Declare queues with dead letter exchange
      for (const queue of Object.values(this.queues)) {
        await this.channel.assertQueue(queue, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'dead.letters',
            'x-message-ttl': 86400000, // 24 hours
          },
        });
      }

      // Bind queues to exchanges
      await this.channel.bindQueue(this.queues.TRANSACTIONS, this.exchanges.FINANCE, 'transaction.*');
      await this.channel.bindQueue(this.queues.NOTIFICATIONS, this.exchanges.NOTIFICATIONS, '');
      
      this.connected = true;
      console.log('✅ RabbitMQ channels and queues initialized');
      
      this.connection.on('error', this.handleError.bind(this));
      this.connection.on('close', this.handleClose.bind(this));
    } catch (error) {
      console.error('RabbitMQ connection error:', error);
      // Retry after 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(queue, message, options = {}) {
    if (!this.connected) throw new Error('RabbitMQ not connected');
    
    const content = Buffer.from(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
      messageId: crypto.randomUUID(),
    }));
    
    return this.channel.sendToQueue(queue, content, {
      persistent: true,
      contentType: 'application/json',
      ...options,
    });
  }

  async publishToExchange(exchange, routingKey, message) {
    if (!this.connected) throw new Error('RabbitMQ not connected');
    
    const content = Buffer.from(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
    }));
    
    return this.channel.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async consume(queue, handler) {
    if (!this.connected) throw new Error('RabbitMQ not connected');
    
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        this.channel.ack(msg);
      } catch (error) {
        console.error(`Error processing message from ${queue}:`, error);
        // Nack and requeue once, then dead letter
        const requeued = msg.fields.redelivered;
        this.channel.nack(msg, false, !requeued);
      }
    });
  }

  isConnected() {
    return this.connected;
  }

  handleError(error) {
    console.error('RabbitMQ connection error:', error);
    this.connected = false;
  }

  handleClose() {
    console.log('RabbitMQ connection closed, reconnecting...');
    this.connected = false;
    setTimeout(() => this.connect(), 5000);
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.connected = false;
  }
}

export const rabbitMQ = new RabbitMQService();
export default rabbitMQ;
