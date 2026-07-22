import { test, expect } from '@playwright/test';

// Golden path for the single shared chatbot booking flow: a patient logs in,
// opens a doctor's page, and completes a full booking through the chat widget
// (reason -> preferred slot -> name -> phone -> booking_action confirmation).
// Uses the same seeded doctor/patient fixtures as the manual verification pass.
const PATIENT_MOBILE = '9812345004'; // Neha Singh (seeded patient, unused by other e2e/manual runs)
const DOCTOR_ID = '2867a85c-88d3-4801-a60f-39c789a68420'; // Dr. Michael Torres (Mon-Fri, Kiran Heart Centre)

async function loginWithOtp(page: import('@playwright/test').Page, mobile: string) {
  await page.goto('/');
  await page.getByPlaceholder('Enter 10-digit number').fill(mobile);

  const otpResponse = page.waitForResponse((res) => res.url().includes('/api/auth/request-otp'));
  await page.getByRole('button', { name: 'Send OTP' }).click();
  const body = await (await otpResponse).json();
  const otp: string = body.data.__dev_otp;
  expect(otp).toBeTruthy();

  for (let i = 0; i < otp.length; i++) {
    await page.getByRole('textbox', { name: `Digit ${i + 1}` }).fill(otp[i]);
  }
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL('**/patient/home');
}

test('patient books an appointment with any doctor through the single shared chat flow', async ({ page }) => {
  await loginWithOtp(page, PATIENT_MOBILE);

  await page.goto(`/patient/doctor/${DOCTOR_ID}`);
  await page.getByRole('button', { name: 'Find Available Slots' }).waitFor();

  // The chat bubble is the only unlabeled floating button on the page.
  await page.locator('button svg.lucide-message-circle').locator('..').click();

  await expect(page.getByText('What is the reason for your visit?')).toBeVisible();
  const input = page.getByPlaceholder('Type a message...');

  await input.fill('Annual checkup');
  await input.press('Enter');

  await expect(page.getByText(/What date and time would you like/)).toBeVisible();
  // Wednesday, N weeks out (N derived from the current time) so repeated runs
  // land on a fresh slot instead of colliding with an appointment from a prior run.
  const weeksAhead = 1 + (Date.now() % 50);
  const slotDate = new Date(Date.now() + (1 + weeksAhead * 7) * 24 * 60 * 60 * 1000);
  const slot = `${slotDate.toISOString().slice(0, 10)} 08:00`;
  await input.fill(slot);
  await input.press('Enter');

  await expect(page.getByText("What's your full name?")).toBeVisible();
  await input.fill('Neha Singh');
  await input.press('Enter');

  await expect(page.getByText("What's your mobile number?")).toBeVisible();
  await input.fill(PATIENT_MOBILE);
  await input.press('Enter');

  const confirmation = page.getByText('Appointment booked successfully!');
  await expect(confirmation).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('p', { hasText: 'Appointment booked successfully!' })).toContainText('Dr. Michael Torres');
});
