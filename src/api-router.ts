import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const router = express.Router();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || "https://byixlfiypxnbfehesibl.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "sb_publishable_UuEA_RP4zUjK2GprnTrZpw_hn4OQK-x";

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Supabase URL or Key is missing from environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Resend Configuration
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Helper for email
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

// We need a way to send notifications, but WebSockets are not available in serverless.
// We'll just log them for now, or the client can poll.
function sendNotification(userId: string, notification: any) {
  console.log(`Notification for ${userId}: ${notification.message}`);
  // In a real serverless app, you might use a service like Pusher or Ably here.
}

router.get("/health", (req, res) => res.json({ status: "ok", environment: process.env.NETLIFY ? "netlify" : "local" }));

router.get("/seed", async (req, res) => {
  const initialUsers = [
    { id: "00000000-0000-0000-0000-000000000001", name: "Alice User", role: "end_user" },
    { id: "00000000-0000-0000-0000-000000000002", name: "Lloyd", role: "it_lead" },
    { id: "00000000-0000-0000-0000-000000000003", name: "LEO", role: "technician" },
    { id: "00000000-0000-0000-0000-000000000004", name: "Vision", role: "technician" },
    { id: "00000000-0000-0000-0000-000000000005", name: "Charlie Tech", role: "technician" },
    { id: "00000000-0000-0000-0000-000000000006", name: "Admin User", role: "admin" }
  ];
  const { error: userError } = await supabase.from("users").upsert(initialUsers);
  if (userError) return res.status(500).json({ error: userError.message });
  res.json({ message: "Users seeded successfully." });
});

router.get("/technicians", async (req, res) => {
  const { data, error } = await supabase
    .from("technicians")
    .select(`*, user:users(name)`)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const formatted = (data || []).map(t => ({
    ...t,
    name: (t as any).user?.name || 'Unknown'
  }));
  res.json(formatted);
});

router.patch("/technicians/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['available', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const { data, error } = await supabase
    .from("technicians")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post("/technicians", async (req, res) => {
  const { id, name, email, specialty, phone, status } = req.body;
  let targetId = id;

  try {
    if (!targetId && name && email) {
      // Check if user with this email already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        targetId = existingUser.id;
        // Update existing user role to technician
        await supabase.from("users").update({ role: 'technician' }).eq("id", targetId);
      } else {
        // Create new user
        targetId = crypto.randomUUID();
        const { error: userError } = await supabase.from("users").insert([{
          id: targetId,
          name,
          email,
          role: 'technician'
        }]);
        if (userError) return res.status(500).json({ error: userError.message });
      }
    } else if (targetId) {
      // Update existing user role
      await supabase.from("users").update({ role: 'technician' }).eq("id", targetId);
    } else if (!targetId) {
      return res.status(400).json({ error: "Either User ID or Name/Email is required." });
    }

    const { data, error } = await supabase
      .from("technicians")
      .upsert([{ id: targetId, specialty, phone, status: status || 'available' }])
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/technicians/:id", async (req, res) => {
  const { id } = req.params;
  const { name, specialty, phone, status } = req.body;
  
  try {
    if (name) {
      await supabase.from("users").update({ name }).eq("id", id);
    }

    const { data, error } = await supabase
      .from("technicians")
      .update({ specialty, phone, status })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/technicians/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Demote user to end_user
    await supabase.from("users").update({ role: 'end_user' }).eq("id", id);
    // Remove from technicians table
    const { error } = await supabase.from("technicians").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/users", async (req, res) => {
  const { data: users, error } = await supabase.from("users").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(users);
});

router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (!profileError && profile) return res.json(profile);
    if (!supabase.auth.admin) return res.status(404).json({ error: "User profile not found and Admin API unavailable." });
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(id);
    if (authError || !user) return res.status(404).json({ error: "User not found in Auth or Profile table." });
    const profileData: any = {
      id: user.id,
      name: user.user_metadata?.name || user.email?.split('@')[0] || "New User",
      role: user.user_metadata?.role || "end_user",
      email: user.email
    };
    const { data: newProfile, error: insertError } = await supabase.from("users").upsert([profileData]).select().single();
    if (insertError) {
      console.error("Error auto-creating user profile:", insertError);
      return res.status(500).json({ error: `Failed to auto-create user profile: ${insertError.message}` });
    }
    return res.json(newProfile);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "An unexpected error occurred" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, role, changed_by } = req.body;
  
  // Fetch old data for audit log
  const { data: oldUser } = await supabase.from("users").select("*").eq("id", id).single();

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log the change
  if (oldUser && (oldUser.name !== data.name || oldUser.role !== data.role)) {
    await supabase.from("user_audit_log").insert([{
      user_id: id,
      changed_by: changed_by || null,
      old_role: oldUser.role,
      new_role: data.role,
      old_name: oldUser.name,
      new_name: data.name
    }]);
  }

  // If role was updated to technician, ensure they are in the technicians table
  if (role === 'technician') {
    await supabase.from("technicians").upsert([{ id, status: 'available' }]);
  }

  res.json(data);
});

router.get("/users/:id/audit-log", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("user_audit_log")
    .select(`
      *,
      changed_by_user:users!user_audit_log_changed_by_fkey(name)
    `)
    .eq("user_id", id)
    .order("changed_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post("/users/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  
  if (!email) return res.status(400).json({ error: "Email is required" });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Password reset email sent" });
});

router.get("/tickets", async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select(`*, creator:users!tickets_created_by_fkey(name), requester:users!tickets_requested_for_fkey(name), technician:users!tickets_assigned_to_fkey(name)`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase error fetching tickets:", error);
      // Fallback to simple select if join fails (in case of schema mismatch)
      const { data: simpleTickets, error: simpleError } = await supabase
        .from("tickets")
        .select("*")
        .order('created_at', { ascending: false });
      
      if (simpleError) return res.status(500).json({ error: simpleError.message });
      return res.json(simpleTickets);
    }
    
    const formattedTickets = await Promise.all(tickets.map(async (t) => {
      // Check if blocked
      const { data: deps } = await supabase
        .from("ticket_dependencies")
        .select("ticket:tickets!ticket_dependencies_depends_on_id_fkey(status)")
        .eq("ticket_id", t.id);
      
      const isBlocked = deps?.some(d => (d.ticket as any)?.status !== 'completed' && (d.ticket as any)?.status !== 'acknowledged') || false;

      return {
        ...t,
        creator_name: (t as any).creator?.name,
        requester_name: (t as any).requester?.name,
        technician_name: (t as any).technician?.name,
        is_blocked: isBlocked
      };
    }));
    res.json(formattedTickets);
  } catch (err: any) {
    console.error("Unexpected error in /api/tickets:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/tickets", async (req, res) => {
  const { id, title, description, category, priority, created_by, requested_for } = req.body;
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert([{ id, title, description, category, status: "open", priority, created_by, requested_for: requested_for || created_by }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from("activities").insert([{ ticket_id: id, user_id: created_by, action: "created", details: "Ticket created." }]);
  res.json(ticket);
});

router.get("/tickets/:id/activities", async (req, res) => {
  const { id } = req.params;
  const { data: activities, error } = await supabase
    .from("activities")
    .select(`*, user:users(name, role)`)
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

router.get("/activities", async (req, res) => {
  const { limit = 50 } = req.query;
  const { data: activities, error } = await supabase
    .from("activities")
    .select(`*, user:users(name, role), ticket:tickets(title, category)`)
    .order('created_at', { ascending: false })
    .limit(Number(limit));
    
  if (error) return res.status(500).json({ error: error.message });
  
  const formattedActivities = activities.map(a => ({
    ...a,
    user_name: a.user?.name,
    user_role: a.user?.role,
    ticket_title: a.ticket?.title,
    ticket_category: a.ticket?.category
  }));
  
  res.json(formattedActivities);
});

router.patch("/tickets/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { technician_id, user_id } = req.body;
  
  console.log(`Assigning ticket ${id} to technician ${technician_id} by user ${user_id}`);
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  if (userError) {
    console.error("Error fetching user role:", userError);
    return res.status(403).json({ error: "Unauthorized. Could not verify user role." });
  }
  
  if (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician') {
    console.warn(`User ${user_id} with role ${user.role} attempted to assign ticket.`);
    return res.status(403).json({ error: "Unauthorized. Only IT Leads or Technicians can assign tickets." });
  }

  const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", technician_id).single();
  if (techError) {
    console.error("Error fetching technician:", techError);
    return res.status(500).json({ error: techError.message });
  }
  
  const { data: ticket, error: ticketFetchError } = await supabase.from("tickets").select("title, assigned_to").eq("id", id).single();
  if (ticketFetchError) {
    console.error("Error fetching ticket:", ticketFetchError);
    return res.status(500).json({ error: ticketFetchError.message });
  }
  
  const isReassignment = !!ticket.assigned_to;
  
  const { error } = await supabase.from("tickets").update({ assigned_to: technician_id, status: "assigned", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    console.error("Error updating ticket assignment:", error);
    return res.status(500).json({ error: error.message });
  }
  
  console.log(`Successfully ${isReassignment ? 're-assigned' : 'assigned'} ticket ${id} to ${technician.name}`);
  await supabase.from("activities").insert([{ 
    ticket_id: id, 
    user_id, 
    action: isReassignment ? "re-assigned" : "assigned", 
    details: `Ticket ${isReassignment ? 're-assigned' : 'assigned'} to ${technician.name}.` 
  }]);
  
  const message = isReassignment 
    ? `Ticket re-assigned to you: ${ticket.title} (#${id})`
    : `New ticket assigned to you: ${ticket.title} (#${id})`;
    
  const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: technician_id, message, ticket_id: id }]).select().single();
  if (!notifError) sendNotification(technician_id, notification);
  if (technician.email) {
    await sendEmailNotification(technician.email, `New Ticket Assigned: ${ticket.title}`, `<h1>New Ticket Assignment</h1><p>Hello ${technician.name},</p><p>You have been assigned to a new ticket: <strong>${ticket.title}</strong> (ID: ${id})</p>`);
  }
  res.json({ success: true });
});

router.post("/tickets/:id/comments", async (req, res) => {
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

router.patch("/tickets/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, user_id } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticketData, error: ticketError } = await supabase.from("tickets").select("created_by").eq("id", id).single();
  
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  if (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician' && ticketData.created_by !== user_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

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

router.patch("/tickets/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, user_id } = req.body;
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title, status").eq("id", id).single();
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  
  // Acknowledge is for creator
  if (status === 'acknowledged') {
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.created_by !== user_id && ticket.requested_for !== user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
  } else if (status === 'assigned' && ticket.status === 'completed') {
    // Allow creator/requester to re-open a completed ticket
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.created_by !== user_id && ticket.requested_for !== user_id && ticket.assigned_to !== user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
  } else {
    // Other status changes are for assigned technician or lead
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.assigned_to !== user_id) {
      return res.status(403).json({ error: "Unauthorized. Only the assigned technician or IT Lead can change the status." });
    }
  }

  // Check dependencies if trying to complete
  if (status === 'completed' || status === 'acknowledged') {
    const { data: deps, error: depError } = await supabase
      .from("ticket_dependencies")
      .select("depends_on_id, ticket:tickets!ticket_dependencies_depends_on_id_fkey(status)")
      .eq("ticket_id", id);
    
    if (!depError && deps) {
      const unresolved = deps.filter(d => (d.ticket as any)?.status !== 'completed' && (d.ticket as any)?.status !== 'acknowledged');
      if (unresolved.length > 0) {
        return res.status(400).json({ error: "Cannot complete ticket. It has unresolved dependencies." });
      }
    }
  }
  
  const { error } = await supabase.from("tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "status_change",
    details: `Status updated to ${status}.`
  }]);
  if (status === 'completed' || status === 'acknowledged') {
    const message = `Your ticket "${ticket.title}" has been marked as ${status}.`;
    const recipients = Array.from(new Set([ticket.created_by, ticket.requested_for]));
    for (const recipientId of recipients) {
      if (recipientId) {
        const { data: recipient, error: recipientError } = await supabase.from("users").select("*").eq("id", recipientId).single();
        const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: recipientId, message, ticket_id: id }]).select().single();
        if (!notifError) sendNotification(recipientId, notification);
        if (recipient && recipient.email) {
          await sendEmailNotification(recipient.email, `Ticket Status Update: ${ticket.title}`, `<h1>Ticket Status Updated</h1><p>Hello ${recipient.name},</p><p>Your ticket <strong>${ticket.title}</strong> has been marked as <strong>${status}</strong>.</p>`);
        }
      }
    }
  } else if (status === 'assigned' && ticket.status === 'completed') {
    // Notify technician that ticket was re-opened
    if (ticket.assigned_to) {
      const message = `User has re-opened the ticket: ${ticket.title}`;
      const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", ticket.assigned_to).single();
      const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: ticket.assigned_to, message, ticket_id: id }]).select().single();
      if (!notifError) sendNotification(ticket.assigned_to, notification);
      if (technician && technician.email) {
        await sendEmailNotification(technician.email, `Ticket Re-opened: ${ticket.title}`, `<h1>Ticket Re-opened</h1><p>Hello ${technician.name},</p><p>The user was not satisfied with the resolution and has re-opened the ticket: <strong>${ticket.title}</strong>.</p>`);
      }
    }
  }
  res.json({ success: true });
});

router.patch("/tickets/:id/work", async (req, res) => {
  const { id } = req.params;
  const { technician_id, work_done } = req.body;
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("assigned_to").eq("id", id).single();
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.assigned_to !== technician_id) {
    return res.status(403).json({ error: "Unauthorized. Only the assigned technician or IT Lead can log work." });
  }
  await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);
  await supabase.from("activities").insert([{ ticket_id: id, user_id: technician_id, action: "update", details: work_done }]);
  res.json({ success: true });
});

router.patch("/tickets/:id/complete", async (req, res) => {
  const { id } = req.params;
  const { technician_id } = req.body;
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.assigned_to !== technician_id) {
    return res.status(403).json({ error: "Unauthorized. Only the assigned technician or IT Lead can complete the ticket." });
  }
  await supabase.from("tickets").update({ status: 'completed', updated_at: new Date().toISOString() }).eq("id", id);
  await supabase.from("activities").insert([{ ticket_id: id, user_id: technician_id, action: "completed", details: "Technician marked the problem as fixed." }]);
  const message = `Your ticket "${ticket.title}" has been marked as completed.`;
  const recipients = Array.from(new Set([ticket.created_by, ticket.requested_for]));
  for (const recipientId of recipients) {
    if (recipientId) {
      const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: recipientId, message, ticket_id: id }]).select().single();
      if (!notifError) sendNotification(recipientId, notification);
    }
  }
  res.json({ success: true });
});

router.patch("/tickets/:id/acknowledge", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.created_by !== user_id && ticket.requested_for !== user_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  await supabase.from("tickets").update({ status: 'acknowledged', updated_at: new Date().toISOString() }).eq("id", id);
  await supabase.from("activities").insert([{ ticket_id: id, user_id, action: "acknowledged", details: "User acknowledged the resolution." }]);
  if (ticket.assigned_to) {
    const message = `User has acknowledged the resolution for ticket: ${ticket.title}`;
    const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", ticket.assigned_to).single();
    const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: ticket.assigned_to, message, ticket_id: id }]).select().single();
    if (!notifError) sendNotification(ticket.assigned_to, notification);
    if (technician && technician.email) {
      await sendEmailNotification(technician.email, `Ticket Acknowledged: ${ticket.title}`, `<h1>Ticket Acknowledged</h1><p>Hello ${technician.name},</p><p>The user has acknowledged the resolution for ticket: <strong>${ticket.title}</strong>.</p>`);
    }
  }
  res.json({ success: true });
});

router.patch("/tickets/:id/escalate", async (req, res) => {
  const { id } = req.params;
  const { user_id, reason } = req.body;
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("title, assigned_to").eq("id", id).single();
  
  if (userError || ticketError) return res.status(500).json({ error: "Database error" });
  
  // Only technicians or leads can escalate
  if (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician') {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { error } = await supabase
    .from("tickets")
    .update({ 
      is_escalated: true, 
      priority: 'critical', 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id);
    
  if (error) return res.status(500).json({ error: error.message });
  
  await supabase.from("activities").insert([{ 
    ticket_id: id, 
    user_id, 
    action: "escalated", 
    details: `Ticket escalated. Reason: ${reason || 'Unresolved for too long'}` 
  }]);
  
  // Notify all IT Leads
  const { data: leads } = await supabase.from("users").select("id, email, name").in("role", ["it_lead", "admin"]);
  if (leads) {
    for (const lead of leads) {
      const message = `Ticket escalated: ${ticket.title} (#${id})`;
      const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ 
        user_id: lead.id, 
        message, 
        ticket_id: id 
      }]).select().single();
      
      if (!notifError) sendNotification(lead.id, notification);
      if (lead.email) {
        await sendEmailNotification(lead.email, `Ticket Escalated: ${ticket.title}`, `<h1>Ticket Escalated</h1><p>Hello ${lead.name},</p><p>A ticket has been escalated: <strong>${ticket.title}</strong> (ID: ${id})</p><p>Reason: ${reason || 'Unresolved for too long'}</p>`);
      }
    }
  }
  
  res.json({ success: true });
});

router.post("/tickets/bulk-status", async (req, res) => {
  const { ticketIds, status, user_id } = req.body;
  if (!Array.isArray(ticketIds) || !status) return res.status(400).json({ error: "Invalid request body" });
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  if (userError || (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician')) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { data, error } = await supabase.from("tickets").update({ status, updated_at: new Date().toISOString() }).in("id", ticketIds).select();
  if (error) return res.status(500).json({ error: error.message });
  const activities = ticketIds.map(id => ({ ticket_id: id, user_id, action: "update", details: `Bulk status update to ${status}.` }));
  await supabase.from("activities").insert(activities);
  res.json({ success: true, count: data.length });
});

router.post("/tickets/bulk-delete", async (req, res) => {
  const { ticketIds, user_id } = req.body;
  if (!Array.isArray(ticketIds)) return res.status(400).json({ error: "Invalid request body" });
  
  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  if (userError || (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician')) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await supabase.from("activities").delete().in("ticket_id", ticketIds);
  const { error } = await supabase.from("tickets").delete().in("id", ticketIds);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Ticket Dependencies
router.get("/tickets/:id/dependencies", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from("ticket_dependencies")
    .select(`
      id,
      depends_on_id,
      ticket:tickets!ticket_dependencies_depends_on_id_fkey(id, title, status, priority)
    `)
    .eq("ticket_id", id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post("/tickets/:id/dependencies", async (req, res) => {
  const { id } = req.params;
  const { depends_on_id, user_id } = req.body;

  if (id === depends_on_id) {
    return res.status(400).json({ error: "A ticket cannot depend on itself." });
  }

  // Check for circular dependency (simple 1-level check for now, can be improved)
  const { data: existing } = await supabase
    .from("ticket_dependencies")
    .select("id")
    .eq("ticket_id", depends_on_id)
    .eq("depends_on_id", id)
    .single();
  
  if (existing) {
    return res.status(400).json({ error: "Circular dependency detected." });
  }

  const { data, error } = await supabase
    .from("ticket_dependencies")
    .insert([{ ticket_id: id, depends_on_id }])
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "update",
    details: `Added dependency on ticket #${depends_on_id}`
  }]);

  res.json(data);
});

router.delete("/tickets/:id/dependencies/:dep_id", async (req, res) => {
  const { id, dep_id } = req.params;
  const { user_id } = req.body;

  const { error } = await supabase
    .from("ticket_dependencies")
    .delete()
    .eq("id", dep_id);
  
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from("activities").insert([{
    ticket_id: id,
    user_id,
    action: "update",
    details: `Removed a dependency.`
  }]);

  res.json({ success: true });
});

router.patch("/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get("/notifications/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase error fetching notifications:", error);
      return res.status(500).json({ error: error.message });
    }
    res.json(notifications);
  } catch (err: any) {
    console.error("Unexpected error in /api/notifications:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
