import pool from '../config/db.js';
import { seedDefaultFlowsForDoctor, buildDefaultBookingFlow } from '../modules/flows/flow.templates.js';
import { FlowRepository } from '../modules/flows/flow.repository.js';

async function seedAllDoctors() {
  const flowRepo = new FlowRepository();

  const result = await pool.query(
    `SELECT id, name FROM users WHERE role = 'doctor' AND deleted_at IS NULL ORDER BY created_at`
  );

  console.log(`Found ${result.rows.length} doctors`);

  for (const doctor of result.rows) {
    console.log(`\nSeeding flows for ${doctor.name} (${doctor.id})...`);

    try {
      await flowRepo.seedDefaultBookingFlow(doctor.id, doctor.name);
      console.log(`  Default Booking Flow: done`);
    } catch (err: any) {
      console.log(`  Default Booking Flow: ${err.message}`);
    }

    try {
      await seedDefaultFlowsForDoctor(doctor.id);
      console.log(`  Reminder/Confirmation/Cancellation Flows: done`);
    } catch (err: any) {
      console.log(`  Reminder/Confirmation/Cancellation Flows: ${err.message}`);
    }
  }

  await pool.end();
  console.log('\nDone seeding all doctors.');
}

seedAllDoctors().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
