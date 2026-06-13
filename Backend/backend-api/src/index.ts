import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./middleware/logger";
import userRoutes from "./routes/users";
import vendorRoutes from "./routes/vendors";
import ussdRoutes from "./routes/ussd.routes";
import momoWebhookRoutes from './routes/momoWebhook.routes';
import { createEscrowRouter } from './routes/escrows.routes';
import getDb from './db';


// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Routes
app.use("/api/users", userRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/ussd", ussdRoutes);

// Escrow routes require a live DB connection — skip in unit-test mode
if (process.env.NODE_ENV !== 'test') {
  app.use("/api/escrows", createEscrowRouter(getDb()));
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} does not exist`,
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server only when not running in test mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}


app.use('/webhooks/momo', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

app.use('/webhooks/momo', momoWebhookRoutes);

export default app;
