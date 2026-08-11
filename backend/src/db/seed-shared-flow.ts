import pool from '../config/db.js';
import type { FlowGraph } from '../modules/flows/flow.node-schemas.js';

const TRIGGER_TYPE = 'book';

/**
 * The shared WhatsApp/web booking conversation.
 *
 * There is no phone step: on WhatsApp the sender's number is seeded into
 * session context by FlowSessionService.startSession, and on the web widget
 * the patient is already identified.
 */
const GRAPH: FlowGraph = {
  nodes: [
    { id: 'n_start', type: 'start', position: { x: 0, y: 0 }, data: {} },
    {
      id: 'n_greet',
      type: 'choice',
      position: { x: 0, y: 100 },
      data: {
        text: 'Hi! I can help you book an appointment with the doctor.',
        options: [{ id: 'opt_book', label: 'Book Appointment', value: 'book' }],
      },
    },
    {
      id: 'n_name',
      type: 'input',
      position: { x: 0, y: 200 },
      data: { text: 'What is your full name?', variable: 'patient_name' },
    },
    {
      id: 'n_slots',
      type: 'slot_picker',
      position: { x: 0, y: 300 },
      data: { text: 'Please choose a time that suits you:', days_ahead: 7 },
    },
    { id: 'n_book', type: 'booking_action', position: { x: 0, y: 400 }, data: {} },
    {
      id: 'n_end',
      type: 'end',
      position: { x: 0, y: 500 },
      data: { message: 'Is there anything else I can help you with?' },
    },
  ],
  edges: [
    { id: 'e1', source: 'n_start', target: 'n_greet' },
    // Choice nodes route on an option handle, not a bare edge.
    { id: 'e2', source: 'n_greet', target: 'n_name', sourceHandle: 'option:opt_book' },
    { id: 'e3', source: 'n_name', target: 'n_slots' },
    { id: 'e4', source: 'n_slots', target: 'n_book' },
    { id: 'e5', source: 'n_book', target: 'n_end' },
  ],
};

/**
 * Publish GRAPH as the shared booking flow.
 *
 * Re-runnable: when the flow already exists but its published graph differs,
 * a new version is added and published rather than skipped. The previous
 * behaviour - bailing out whenever any shared flow existed - meant edits to
 * this file silently never reached the database.
 */
async function seedSharedFlow() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT f.id, fv.graph
       FROM flows f
       LEFT JOIN flow_versions fv ON fv.id = f.published_version_id
       WHERE f.doctor_id IS NULL AND f.trigger_type = $1`,
      [TRIGGER_TYPE]
    );

    let flowId: string;

    if (existing.rows[0]) {
      flowId = existing.rows[0].id;

      if (JSON.stringify(existing.rows[0].graph) === JSON.stringify(GRAPH)) {
        await client.query('COMMIT');
        console.log('Shared flow already up to date:', flowId);
        return;
      }
    } else {
      const flow = await client.query(
        `INSERT INTO flows (doctor_id, name, trigger_type, is_active)
         VALUES (NULL, 'Shared Booking Flow', $1, true)
         RETURNING id`,
        [TRIGGER_TYPE]
      );
      flowId = flow.rows[0].id;
    }

    const version = await client.query(
      `INSERT INTO flow_versions (flow_id, version_number, status, graph, published_at)
       VALUES ($1, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM flow_versions WHERE flow_id = $1), 'published', $2, NOW())
       RETURNING id, version_number`,
      [flowId, JSON.stringify(GRAPH)]
    );

    await client.query(`UPDATE flows SET published_version_id = $1, is_active = true WHERE id = $2`, [
      version.rows[0].id,
      flowId,
    ]);

    await client.query('COMMIT');
    console.log(
      'Shared flow published:',
      flowId,
      'version:',
      version.rows[0].version_number,
      `(${version.rows[0].id})`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seedSharedFlow()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('Seeding shared flow failed:', err);
    await pool.end();
    process.exit(1);
  });
