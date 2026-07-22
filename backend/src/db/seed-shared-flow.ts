import pool from '../config/db.js';
import type { FlowGraph } from '../modules/flows/flow.node-schemas.js';

const TRIGGER_TYPE = 'book';

const GRAPH: FlowGraph = {
  nodes: [
    { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    {
      id: 'n_greet',
      type: 'message',
      position: { x: 0, y: 100 },
      data: { text: "Hi! I can help you book an appointment with your doctor. Let's get started." },
    },
    {
      id: 'n_reason',
      type: 'input',
      position: { x: 0, y: 200 },
      data: { text: 'What is the reason for your visit?', variable: 'reason' },
    },
    {
      id: 'n_slot',
      type: 'input',
      position: { x: 0, y: 300 },
      data: {
        text: 'What date and time would you like to come in? Please reply as YYYY-MM-DD HH:MM, e.g. 2026-07-25 10:00',
        variable: 'slot_start',
      },
    },
    {
      id: 'n_name',
      type: 'input',
      position: { x: 0, y: 400 },
      data: { text: "What's your full name?", variable: 'patient_name' },
    },
    {
      id: 'n_phone',
      type: 'input',
      position: { x: 0, y: 500 },
      data: { text: "What's your mobile number?", variable: 'patient_phone' },
    },
    { id: 'n_book', type: 'booking_action', position: { x: 0, y: 600 }, data: {} },
    {
      id: 'n_end',
      type: 'end',
      position: { x: 0, y: 700 },
      data: { message: 'Is there anything else I can help you with?' },
    },
  ],
  edges: [
    { id: 'e1', source: 'n_start', target: 'n_greet' },
    { id: 'e2', source: 'n_greet', target: 'n_reason' },
    { id: 'e3', source: 'n_reason', target: 'n_slot' },
    { id: 'e4', source: 'n_slot', target: 'n_name' },
    { id: 'e5', source: 'n_name', target: 'n_phone' },
    { id: 'e6', source: 'n_phone', target: 'n_book' },
    { id: 'e7', source: 'n_book', target: 'n_end' },
  ],
};

async function seedSharedFlow() {
  const existing = await pool.query(
    `SELECT id FROM flows WHERE doctor_id IS NULL AND trigger_type = $1`,
    [TRIGGER_TYPE]
  );
  if (existing.rows[0]) {
    console.log('Shared flow already exists:', existing.rows[0].id);
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const flow = await client.query(
      `INSERT INTO flows (doctor_id, name, trigger_type, is_active)
       VALUES (NULL, 'Shared Booking Flow', $1, true)
       RETURNING id`,
      [TRIGGER_TYPE]
    );
    const flowId = flow.rows[0].id;

    const version = await client.query(
      `INSERT INTO flow_versions (flow_id, version_number, status, graph, published_at)
       VALUES ($1, 1, 'published', $2, NOW())
       RETURNING id`,
      [flowId, JSON.stringify(GRAPH)]
    );
    const versionId = version.rows[0].id;

    await client.query(`UPDATE flows SET published_version_id = $1 WHERE id = $2`, [versionId, flowId]);

    await client.query('COMMIT');
    console.log('Shared flow created:', flowId, 'version:', versionId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

seedSharedFlow().catch((err) => {
  console.error('Seeding shared flow failed:', err);
  process.exit(1);
});
