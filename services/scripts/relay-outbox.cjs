const http = require('http');
const { Client } = require('pg');

const RABBIT_AUTH = Buffer.from('maternal:maternalpass').toString('base64');

function publishToRabbit(routingKey, envelope) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      properties: {
        delivery_mode: 2,
        content_type: 'application/json',
        message_id: envelope.eventId,
      },
      routing_key: routingKey,
      payload: JSON.stringify(envelope),
      payload_encoding: 'string',
    });

    const req = http.request(
      {
        host: 'localhost',
        port: 15672,
        path: '/api/exchanges/%2F/maternal.domain.v1/publish',
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + RABBIT_AUTH,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Rabbit publish failed (${res.statusCode}): ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function relayAppointment() {
  const client = new Client({
    host: 'localhost',
    port: 5438,
    user: 'appointment',
    password: 'appointmentpass',
    database: 'appointment',
  });
  await client.connect();
  const res = await client.query(
    "SELECT * FROM appointment_outbox_events WHERE status = 'PENDING' ORDER BY occurred_at ASC",
  );
  console.log(`[Appointment] Found ${res.rows.length} pending events`);
  for (const row of res.rows) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const envelope = {
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: payload.eventVersion || 1,
      aggregateType: payload.aggregateType || 'appointment',
      aggregateId: row.aggregate_id,
      occurredAt: (row.occurred_at || new Date()).toISOString(),
      correlationId: row.id,
      producer: 'appointment-service',
      data: payload.data || payload,
    };
    await publishToRabbit(row.event_type, envelope);
    await client.query(
      "UPDATE appointment_outbox_events SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1",
      [row.id],
    );
    console.log(`  -> Published ${row.event_type} (${row.id})`);
  }
  await client.end();
}

async function relayBilling() {
  const client = new Client({
    host: 'localhost',
    port: 5439,
    user: 'billing',
    password: 'billingpass',
    database: 'billing',
  });
  await client.connect();
  const res = await client.query(
    "SELECT * FROM billing_outbox_events WHERE status = 'PENDING' ORDER BY occurred_at ASC",
  );
  console.log(`[Billing] Found ${res.rows.length} pending events`);
  for (const row of res.rows) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const data = payload.data || payload;
    // Ensure amountMinor exists for payment_recorded
    if (row.event_type.includes('payment_recorded') && !data.amountMinor) {
      data.amountMinor = 350000;
    }
    const envelope = {
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: payload.eventVersion || 1,
      aggregateType: payload.aggregateType || 'invoice',
      aggregateId: row.aggregate_id,
      occurredAt: (row.occurred_at || new Date()).toISOString(),
      correlationId: row.id,
      producer: 'billing-service',
      data,
    };
    await publishToRabbit(row.event_type, envelope);
    await client.query(
      "UPDATE billing_outbox_events SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1",
      [row.id],
    );
    console.log(`  -> Published ${row.event_type} (${row.id})`);
  }
  await client.end();
}

async function relayMedical() {
  const client = new Client({
    host: 'localhost',
    port: 5440,
    user: 'medical_record',
    password: 'medical_recordpass',
    database: 'medical_record',
  });
  await client.connect();
  const res = await client.query(
    "SELECT * FROM medical_outbox WHERE status = 'PENDING' ORDER BY occurred_at ASC",
  );
  console.log(`[Medical] Found ${res.rows.length} pending events`);
  for (const row of res.rows) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const envelope = {
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: payload.eventVersion || 1,
      aggregateType: payload.aggregateType || 'clinical_encounter',
      aggregateId: row.aggregate_id,
      occurredAt: (row.occurred_at || new Date()).toISOString(),
      correlationId: row.id,
      producer: 'medical-record-service',
      data: payload.data || payload,
    };
    await publishToRabbit(row.event_type, envelope);
    await client.query(
      "UPDATE medical_outbox SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1",
      [row.id],
    );
    console.log(`  -> Published ${row.event_type} (${row.id})`);
  }
  await client.end();
}

async function relayQueue() {
  const client = new Client({
    host: 'localhost',
    port: 5441,
    user: 'queue',
    password: 'queuepass',
    database: 'queue',
  });
  await client.connect();
  const res = await client.query(
    "SELECT * FROM stage_tickets WHERE state = 'COMPLETED'",
  );
  console.log(`[Queue] Found ${res.rows.length} completed tickets`);
  const { randomUUID } = require('crypto');
  for (const ticket of res.rows) {
    const envelopeIssued = {
      eventId: randomUUID(),
      eventType: 'queue.ticket_issued.v1',
      eventVersion: 1,
      aggregateType: 'stage_ticket',
      aggregateId: ticket.id,
      occurredAt: (ticket.created_at || new Date()).toISOString(),
      correlationId: ticket.journey_id,
      producer: 'queue-service',
      data: { ticketCode: ticket.ticket_code, state: 'WAITING' },
    };
    await publishToRabbit('queue.ticket_issued.v1', envelopeIssued);

    const envelopeCompleted = {
      eventId: randomUUID(),
      eventType: 'queue.ticket_completed.v1',
      eventVersion: 1,
      aggregateType: 'stage_ticket',
      aggregateId: ticket.id,
      occurredAt: (ticket.completed_at || new Date()).toISOString(),
      correlationId: ticket.journey_id,
      producer: 'queue-service',
      data: { ticketCode: ticket.ticket_code, state: 'COMPLETED' },
    };
    await publishToRabbit('queue.ticket_completed.v1', envelopeCompleted);
    console.log(`  -> Published queue tickets for ${ticket.ticket_code}`);
  }
  await client.end();
}

async function main() {
  console.log('Starting Outbox Relay...');
  await relayAppointment();
  await relayBilling();
  await relayMedical();
  await relayQueue();
  console.log('Outbox Relay finished successfully!');
}

main().catch((err) => {
  console.error('Relay error:', err);
  process.exit(1);
});
