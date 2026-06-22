import "./src/server/loadEnv.js";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initDb } from "./src/server/db.js";
import { setupRoutes } from "./src/server/routes.js";
import { startScheduler } from "./src/server/syncService.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database
  initDb();

  // JSON middleware
  app.use(express.json());

  // Setup API Routes
  setupRoutes(app);

  // Start Background Synchronization Scheduler
  startScheduler();

  // Vite middleware for development or Static Serve for Prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: AI Studio only uses the 'dist' directory when in a deployed app
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Start the full stack server
startServer().catch(console.error);
