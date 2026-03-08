import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

// Health check for Netlify deployment
app.get("/api/health", (req, res) => res.json({ status: "ok", environment: process.env.NETLIFY ? "netlify" : "local" }));

const PORT = 3000;

app.get("/api/seed", async (req, res) => {
  // This is a helper endpoint to seed initial data
  // In a real app, you'd use migrations
  const initialUsers = [
    { id: "u1", name: "Alice User", role: "user" },
    { id: "l1", name: "Lloyd", role: "lead" },
    { id: "t1", name: "LEO", role: "technician" },
    { id: "t2", name: "Vision", role: "technician" },
    { id: "t3", name: "Charlie Tech", role: "technician" }
  ];

  const { error: userError } = await supabase.from("users").upsert(initialUsers);
  if (userError) return res.status(500).json({ error: userError.message });

  res.json({ message: "Users seeded successfully. Ensure tables 'tickets', 'activities', and 'notifications' exist in Supabase with an 'email' column in 'users'." });
});

app.get("/api/technicians", async (req, res) => {
  const { data, error } = await supabase
    .from("technicians")
    .select(`
      *,
      user:users(name)
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const formatted = (data || []).map(t => ({
    ...t,
    name: (t as any).user?.name || 'Unknown'
  }));

  res.json(formatted);
});

app.post("/api/technicians", async (req, res) => {
  const { id, specialty, phone, status } = req.body;
  
  const { data, error } = await supabase
    .from("technicians")
    .upsert([{ id, specialty, phone, status: status || 'active' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Update user role to technician just in case
  await supabase.from("users").update({ role: 'technician' }).eq("id", id);

  res.json(data);
});

app.patch("/api/technicians/:id", async (req, res) => {
  const { id } = req.params;
  const { specialty, phone, status } = req.body;

  const { data, error } = await supabase
    .from("technicians")
    .update({ specialty, phone, status })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/technicians/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("technicians").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// API Routes
app.get("/api/users", async (req, res) => {
  const { data: users, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to get the user from our public users table
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (!profileError && profile) {
      return res.json(profile);
    }

    // If not found, try to fetch from Supabase Auth using admin API
    // Check if admin API is available (requires service role key)
    if (!supabase.auth.admin) {
      console.warn("Supabase Admin API not available. Service role key might be missing.");
      return res.status(404).json({ error: "User profile not found and Admin API unavailable." });
    }

    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(id);
    
    if (authError || !user) {
      return res.status(404).json({ error: "User not found in Auth or Profile table." });
    }

    // Auto-create the profile if it's missing
    const profileData: any = {
      id: user.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || "New User",
      role: user.user_metadata?.role || "user"
    };

    const { data: newProfile, error: insertError } = await supabase
      .from("users")
      .insert([profileData])
      .select()
      .single();

    if (insertError) {
      console.error("Error auto-creating profile:", insertError);
      return res.status(500).json({ error: "Failed to auto-create user profile." });
    }

    return res.json(newProfile);
  } catch (err: any) {
    console.error("Unexpected error in fetch profile:", err);
    return res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
});

app.post("/api/tickets/:id/comments", async (req, res) => {
  const { id } = req.params;
  const { user_id, comment } = req.body;

  const { data, error } = await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "commented",
    details: comment
  }]).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/tickets", async (req, res) => {
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`
      *,
      creator:users!tickets_created_by_fkey(name),
      requester:users!tickets_requested_for_fkey(name),
      technician:users!tickets_assigned_to_fkey(name)
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const formattedTickets = tickets.map(t => ({
    ...t,
    creator_name: t.creator?.name,
    requester_name: t.requester?.name,
    technician_name: t.technician?.name
  }));

  res.json(formattedTickets);
});

app.post("/api/tickets", async (req, res) => {
  const { id, title, description, category, priority, created_by, requested_for } = req.body;
  
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert([{
      id,
      title,
      description,
      category,
      status: "open",
      priority,
      created_by,
      requested_for: requested_for || created_by
    }])
    .select()
    .single();

  if (error) {
    console.error("Error creating ticket:", error);
    const errorMessage = typeof error === 'object' ? (error as any).message || JSON.stringify(error) : String(error);
    return res.status(500).json({ error: errorMessage });
  }

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id: created_by,
    action: "created",
    details: "Ticket created."
  }]);

  res.json(ticket);
});

app.patch("/api/tickets/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, user_id } = req.body;

  const { data: ticket, error } = await supabase
    .from("tickets")
    .update({ title, description, category, priority, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "update",
    details: "Ticket details updated."
  }]);

  res.json(ticket);
});

app.get("/api/tickets/:id/activities", async (req, res) => {
  const { id } = req.params;
  const { data: activities, error } = await supabase
    .from("activities")
    .select(`
      *,
      user:users(name, role)
    `)
    .eq("ticket_id", id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const formattedActivities = activities.map(a => ({
    ...a,
    user_name: a.user?.name,
    user_role: a.user?.role
  }));

  res.json(formattedActivities);
});

app.patch("/api/tickets/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { technician_id, user_id } = req.body;

  const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", technician_id).single();
  if (techError) return res.status(500).json({ error: techError.message });

  const { data: ticket, error: ticketFetchError } = await supabase.from("tickets").select("title").eq("id", id).single();
  if (ticketFetchError) return res.status(500).json({ error: ticketFetchError.message });

  const { error } = await supabase
    .from("tickets")
    .update({ 
      assigned_to: technician_id, 
      status: "assigned", 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "assigned",
    details: `Ticket assigned to ${technician.name}.`
  }]);

  // Notify technician via WebSocket
  const message = `You have been assigned to a new ticket: ${id}`;
  const { data: notification, error: notifError } = await supabase
    .from("notifications")
    .insert([{ user_id: technician_id, message, ticket_id: id }])
    .select()
    .single();

  if (!notifError) {
    sendNotification(technician_id, notification);
  }

  // Notify technician via Email
  if (technician.email) {
    await sendEmailNotification(
      technician.email,
      `New Ticket Assigned: ${ticket.title}`,
      `
      <h1>New Ticket Assignment</h1>
      <p>Hello ${technician.name},</p>
      <p>You have been assigned to a new ticket: <strong>${ticket.title}</strong> (ID: ${id})</p>
      <p>Please log in to OmniDesk to review the details.</p>
      `
    );
  }

  res.json({ success: true });
});

app.patch("/api/tickets/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, user_id } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();

  if (userError || ticketError) return res.status(500).json({ error: "Database error" });

  if (user.role !== 'lead' && ticket.assigned_to !== user_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { error } = await supabase
    .from("tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "status_change",
    details: `Status updated to ${status}.`
  }]);

  // Notify creator if status is completed or acknowledged
  if (status === 'completed' || status === 'acknowledged') {
    const message = `Your ticket "${ticket.title}" has been marked as ${status}.`;
    const recipients = Array.from(new Set([ticket.created_by, ticket.requested_for]));
    
    for (const recipientId of recipients) {
      if (recipientId) {
        const { data: recipient, error: recipientError } = await supabase.from("users").select("*").eq("id", recipientId).single();
        
        const { data: notification, error: notifError } = await supabase
          .from("notifications")
          .insert([{ user_id: recipientId, message, ticket_id: id }])
          .select()
          .single();

        if (!notifError) {
          sendNotification(recipientId, notification);
        }

        // Notify via Email
        if (recipient && recipient.email) {
          await sendEmailNotification(
            recipient.email,
            `Ticket Status Update: ${ticket.title}`,
            `
            <h1>Ticket Status Updated</h1>
            <p>Hello ${recipient.name},</p>
            <p>Your ticket <strong>${ticket.title}</strong> has been marked as <strong>${status}</strong>.</p>
            <p>Please log in to OmniDesk to review the details.</p>
            `
          );
        }
      }
    }
  }

  res.json({ success: true });
});

app.patch("/api/tickets/:id/work", async (req, res) => {
  const { id } = req.params;
  const { technician_id, work_done } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("assigned_to").eq("id", id).single();

  if (userError || ticketError) return res.status(500).json({ error: "Database error" });

  if (user.role !== 'lead' && ticket.assigned_to !== technician_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id: technician_id,
    action: "update",
    details: work_done
  }]);

  res.json({ success: true });
});

app.patch("/api/tickets/:id/complete", async (req, res) => {
  const { id } = req.params;
  const { technician_id } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();

  if (userError || ticketError) return res.status(500).json({ error: "Database error" });

  if (user.role !== 'lead' && ticket.assigned_to !== technician_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await supabase.from("tickets").update({ status: 'completed', updated_at: new Date().toISOString() }).eq("id", id);

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id: technician_id,
    action: "completed",
    details: "Technician marked the problem as fixed."
  }]);

  const message = `Your ticket "${ticket.title}" has been marked as completed.`;
  const recipients = Array.from(new Set([ticket.created_by, ticket.requested_for]));
  for (const recipientId of recipients) {
    if (recipientId) {
      const { data: notification, error: notifError } = await supabase
        .from("notifications")
        .insert([{ user_id: recipientId, message, ticket_id: id }])
        .select()
        .single();

      if (!notifError) {
        sendNotification(recipientId, notification);
      }
    }
  }

  res.json({ success: true });
});

app.patch("/api/tickets/:id/acknowledge", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();

  if (userError || ticketError) return res.status(500).json({ error: "Database error" });

  if (user.role !== 'lead' && ticket.created_by !== user_id && ticket.requested_for !== user_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await supabase.from("tickets").update({ status: 'acknowledged', updated_at: new Date().toISOString() }).eq("id", id);

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "acknowledged",
    details: "User acknowledged the resolution."
  }]);

  if (ticket.assigned_to) {
    const message = `User has acknowledged the resolution for ticket: ${ticket.title}`;
    const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", ticket.assigned_to).single();
    
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .insert([{ user_id: ticket.assigned_to, message, ticket_id: id }])
      .select()
      .single();

    if (!notifError) {
      sendNotification(ticket.assigned_to, notification);
    }

    // Notify technician via Email
    if (technician && technician.email) {
      await sendEmailNotification(
        technician.email,
        `Ticket Acknowledged: ${ticket.title}`,
        `
        <h1>Ticket Acknowledged</h1>
        <p>Hello ${technician.name},</p>
        <p>The user has acknowledged the resolution for ticket: <strong>${ticket.title}</strong>.</p>
        <p>Great job!</p>
        `
      );
    }
  }

  res.json({ success: true });
});

app.get("/api/notifications/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user_id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(notifications);
});

app.patch("/api/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Move these routes OUTSIDE of startServer so they are available in serverless environment
app.post("/api/tickets/bulk-status", async (req, res) => {
  const { ticketIds, status, user_id } = req.body;
  if (!Array.isArray(ticketIds) || !status) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ticketIds)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Log activities for each ticket
  const activities = ticketIds.map(id => ({
    ticket_id: id,
    user_id,
    action: "update",
    details: `Bulk status update to ${status}.`
  }));

  await supabase.from("activities").insert(activities);

  res.json({ success: true, count: data.length });
});

app.post("/api/tickets/bulk-delete", async (req, res) => {
  const { ticketIds, user_id } = req.body;
  if (!Array.isArray(ticketIds)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Delete activities first due to foreign key constraints if any
  await supabase.from("activities").delete().in("ticket_id", ticketIds);
  
  const { error } = await supabase
    .from("tickets")
    .delete()
    .in("id", ticketIds);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

// Error handling middleware for API routes
app.use("/api", (err: any, req: any, res: any, next: any) => {
  console.error("API Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// API 404 handler to ensure we return JSON instead of HTML for missing API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
});

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
