import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
// import { subscriptionRoutes } from './routes/subscription.routes';
dotenv.config();

// Define standard service configuration
const SERVICE_NAME = 'subscription-service';
const DEFAULT_PORT = 3003;

// Get port from environment variable with fallback to default
const port = process.env.SUBSCRIPTION_SERVICE_PORT || DEFAULT_PORT;

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// app.use('/api/subscription', subscriptionRoutes);

// Health check
app.get('/api/subscription/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(port, () => {
  console.log(`Subscription Management Service running on port ${port}`);
});