import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import apiRouter from "./src/api-router.ts";

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
const userConnections = new Map<string, WebSocket>();

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
  const ws = userConnections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "notification", data: notification }));
  }
}

const app = express();
app.use(express.json());

// Mount the API router
app.use("/api", apiRouter);

const PORT = 3000;

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
          userConnections.set(currentUserId, ws);
          console.log(`User connected: ${currentUserId}`);
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    });

    ws.on("close", () => {
      if (currentUserId) {
        userConnections.delete(currentUserId);
        console.log(`User disconnected: ${currentUserId}`);
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

if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
  startServer();
}

export default app;
