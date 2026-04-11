import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import cors from "cors";
import apiRouter from "./src/api-router.ts";
import { wsManager } from "./src/ws-manager.ts";

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

if (!apiRouter) {
  console.error("CRITICAL: apiRouter failed to load from ./src/api-router");
} else {
  console.log("apiRouter loaded successfully");
}

let __filename = "";
let __dirname = "";
try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Fallback for CJS if bundled that way
  __dirname = process.cwd();
}

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || "https://byixlfiypxnbfehesibl.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "sb_publishable_UuEA_RP4zUjK2GprnTrZpw_hn4OQK-x";
const supabase = createClient(supabaseUrl, supabaseKey);

// Resend Configuration
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Store active WebSocket connections by user_id
// const userConnections = new Map<string, WebSocket>();

async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!resend) {
    console.log("Resend API key not configured. Skipping email notification.");
    return;
  }
  try {
    await resend.emails.send({
      from: "OmniDesk <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

function sendNotification(userId: string, notification: any) {
  wsManager.sendToUser(userId, "notification", notification);
}

const app = express();
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Mount the API router
app.use("/api", apiRouter);

// Catch-all for undefined API routes to return JSON instead of HTML
app.use("/api", (req, res) => {
  console.warn(`[API] 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "API route not found", 
    method: req.method,
    url: req.originalUrl 
  });
});

// Basic health check
app.get("/api/ping", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

const PORT = Number(process.env.PORT) || 3000;

export async function startServer() {
  // NOTE: WebSockets are not supported on standard Netlify Functions.
  // Real-time features will only work in local development or on a persistent server.
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let currentUserId: string | null = null;

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "auth" && data.userId) {
          currentUserId = data.userId;
          wsManager.addUser(currentUserId, ws);
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    });

    ws.on("close", () => {
      if (currentUserId) {
        wsManager.removeUser(currentUserId);
      }
    });
  });

  if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        let template = await vite.transformIndexHtml(url, `
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>OmniDesk IT Helpdesk</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="/src/main.tsx"></script>
            </body>
          </html>
        `);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else if (!process.env.NETLIFY) {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Start the server
startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});

export default app;
