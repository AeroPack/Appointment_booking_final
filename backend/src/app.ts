import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import doctorRoutes from './modules/doctors/doctors.routes.js';
import doctorDashboardRoutes from './modules/doctors/dashboard.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import appointmentRoutes from './modules/appointments/appointments.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import tagsRoutes from './modules/tags/tags.routes.js';
import botRoutes from './modules/bot/bot.routes.js';
import flowRoutes from './modules/flows/flow.routes.js';
import flowSessionRoutes from './modules/flows/flow.session-routes.js';
import flowWebhookRoutes from './modules/flows/flow.webhook-routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initializeChannels } from './utils/channels/index.js';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize message channels (WhatsApp, Email, SMS)
initializeChannels();

// Permissive CORS for public bot endpoints (embedded widget on third-party doctor websites).
// Must be registered before the restrictive global cors() so preflight OPTIONS requests
// to /api/bot/* are handled with the permissive policy.
const botCors = cors({ origin: true, credentials: false });
app.use('/api/bot', botCors);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001', 'https://appointment.aeropackpos.in'], credentials: true }));
app.use(express.json());

// Serve chatbot widget
app.get('/chatbot.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.sendFile(path.join(__dirname, '../static/chatbot.js'));
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${res.statusCode}] ${req.method} ${req.originalUrl} — ${ms}ms`);
  });
  next();
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', doctorRoutes);
app.use('/api', doctorDashboardRoutes);
app.use('/api', settingsRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', messagesRoutes);
app.use('/api', tagsRoutes);
app.use('/api', botRoutes);
app.use('/api', flowRoutes);
app.use('/api', flowSessionRoutes);
app.use('/api', flowWebhookRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
