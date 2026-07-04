import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env['EMAIL_HOST'];
  const port = Number(process.env['EMAIL_PORT']) || 587;
  const secure = process.env['EMAIL_SECURE'] === 'true';
  const user = process.env['EMAIL_USERNAME'];
  const pass = process.env['EMAIL_PASSWORD'];

  if (!host || !user || !pass) {
    throw new Error('Email configuration missing: EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD required');
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transporter = createTransporter();
  const from = process.env['EMAIL_USERNAME'];

  await transporter.sendMail({
    from,
    to,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
        <h2 style="color: #333;">Verification Code</h2>
        <p style="color: #555; font-size: 16px;">Your 6-digit verification code is:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #005c55; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #999; font-size: 14px;">This code expires in 5 minutes.</p>
        <p style="color: #999; font-size: 14px;">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  });
}
