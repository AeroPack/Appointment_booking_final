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
import { errorHandler } from './middleware/errorHandler.js';
import { initializeChannels } from './utils/channels/index.js';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize message channels (WhatsApp, Email, SMS)
initializeChannels();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001', 'https://appointment.aeropackpos.in'], credentials: true }));
app.use(express.json());

// Serve chatbot widget
app.use('/chatbot.js', express.static(path.join(__dirname, '../../static/chatbot.js'), {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

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

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
