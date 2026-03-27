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

// Helper for Supabase errors
function handleSupabaseError(res: express.Response, error: any, context: string) {
  // Log the full error object more explicitly
  console.error(`Supabase Error [${context}]:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    error: error // Log the whole thing too just in case
  });
  
  const message = error?.message || "An unexpected database error occurred";
  const code = error?.code || "UNKNOWN_ERROR";
  const details = error?.details || "";
  
  return res.status(500).json({ 
    error: message, 
    code, 
    details,
    context 
  });
}

const SLA_HOURS: Record<string, number> = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 48
};

function calculateSlaStatus(targetTime: string | null, status: string): 'on_track' | 'approaching' | 'breached' | 'resolved' {
  if (status === 'completed' || status === 'acknowledged') return 'resolved';
  if (!targetTime) return 'on_track';
  
  const now = new Date();
  const target = new Date(targetTime);
  const diffMs = target.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return 'breached';
  if (diffHours < 2) return 'approaching'; // Less than 2 hours left
  return 'on_track';
}

router.get("/debug-schema", async (req, res) => {
  console.log("GET /api/debug-schema - Checking tickets table schema");
  try {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .limit(1);
    
    if (error) {
      console.error("Supabase error checking schema:", error);
      return res.status(500).json({ error: error.message, code: error.code });
    }
    
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    return res.json({ columns, hasResolvedAt: columns.includes('resolved_at') });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/health", (req, res) => res.json({ status: "ok", environment: process.env.NETLIFY ? "netlify" : "local" }));

router.get("/seed", async (req, res) => {
  console.log("GET /api/seed - Seeding initial users");
  try {
    const initialUsers = [
      { id: "00000000-0000-0000-0000-000000000001", name: "Alice User", role: "end_user" },
      { id: "00000000-0000-0000-0000-000000000002", name: "Lloyd", role: "it_lead" },
      { id: "00000000-0000-0000-0000-000000000003", name: "LEO", role: "technician" },
      { id: "00000000-0000-0000-0000-000000000004", name: "Vision", role: "technician" },
      { id: "00000000-0000-0000-0000-000000000005", name: "Charlie Tech", role: "technician" },
      { id: "00000000-0000-0000-0000-000000000006", name: "Admin User", role: "admin" }
    ];
    const { error: userError } = await supabase.from("users").upsert(initialUsers);
    if (userError) {
      console.error("Supabase error seeding users:", userError);
      return handleSupabaseError(res, userError, "seed_users");
    }
    
    console.log("Users seeded successfully");

    const initialKB = [
      { 
        id: "kb-001", 
        title: "How to Reset Your Password", 
        content: "To reset your password, go to the login page and click 'Forgot Password'. Follow the instructions sent to your email.", 
        category: "other", 
        tags: ["password", "account", "security"] 
      },
      { 
        id: "kb-002", 
        title: "Connecting to Office Wi-Fi", 
        content: "Select 'Omni-Guest' network. Use your employee ID as the username and your standard network password.", 
        category: "connectivity", 
        tags: ["wifi", "internet", "office"] 
      },
      { 
        id: "kb-003", 
        title: "Printer Setup Guide", 
        content: "Go to System Preferences > Printers & Scanners. Click '+' and select 'Office-Main-Printer'. Drivers will install automatically.", 
        category: "printer", 
        tags: ["printer", "setup", "hardware"] 
      },
      { 
        id: "kb-004", 
        title: "Software Installation Policy", 
        content: "All software must be approved by IT. Please submit a ticket with the name of the software and business justification.", 
        category: "software", 
        tags: ["software", "policy", "install"] 
      },
      { 
        id: "kb-005", 
        title: "Laptop Battery Maintenance", 
        content: "Avoid keeping your laptop plugged in 24/7. Let it discharge to 20% at least once a week to maintain battery health.", 
        category: "laptop", 
        tags: ["battery", "laptop", "maintenance"] 
      }
    ];
    await supabase.from("knowledge_base").upsert(initialKB);

    res.json({ message: "Users and Knowledge Base seeded successfully." });
  } catch (err: any) {
    console.error("Unexpected error in GET /api/seed:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while seeding users" });
  }
});

const MOCK_KB = [
  { 
    id: "kb-001", 
    title: "How to Reset Your Password", 
    content: "To reset your password, go to the login page and click 'Forgot Password'. Follow the instructions sent to your email.", 
    category: "other", 
    tags: ["password", "account", "security"] 
  },
  { 
    id: "kb-002", 
    title: "Connecting to Office Wi-Fi", 
    content: "Select 'Omni-Guest' network. Use your employee ID as the username and your standard network password.", 
    category: "connectivity", 
    tags: ["wifi", "internet", "office"] 
  },
  { 
    id: "kb-003", 
    title: "Printer Setup Guide", 
    content: "Go to System Preferences > Printers & Scanners. Click '+' and select 'Office-Main-Printer'. Drivers will install automatically.", 
    category: "printer", 
    tags: ["printer", "setup", "hardware"] 
  },
  { 
    id: "kb-004", 
    title: "Software Installation Policy", 
    content: "All software must be approved by IT. Please submit a ticket with the name of the software and business justification.", 
    category: "software", 
    tags: ["software", "policy", "install"] 
  },
  { 
    id: "kb-005", 
    title: "Laptop Battery Maintenance", 
    content: "Avoid keeping your laptop plugged in 24/7. Let it discharge to 20% at least once a week to maintain battery health.", 
    category: "laptop", 
    tags: ["battery", "laptop", "maintenance"] 
  }
];

router.get("/kb/search", async (req, res) => {
  const { q } = req.query;
  const query = typeof q === 'string' ? q.toLowerCase() : '';
  console.log(`GET /api/kb/search - Query: ${query}`);
  
  try {
    // Attempt to query Supabase first
    const { data, error } = q 
      ? await supabase.from("knowledge_base").select("*").or(`title.ilike.%${q}%,content.ilike.%${q}%`).limit(5)
      : await supabase.from("knowledge_base").select("*").limit(10);

    if (!error && data && data.length > 0) {
      return res.json(data);
    }

    // Fallback to mock data if table doesn't exist or is empty
    console.log("Using mock KB data fallback");
    if (!query) return res.json(MOCK_KB);
    
    const filtered = MOCK_KB.filter(article => 
      article.title.toLowerCase().includes(query) || 
      article.content.toLowerCase().includes(query)
    ).slice(0, 5);
    
    res.json(filtered);
  } catch (err: any) {
    console.error("Unexpected error in GET /api/kb/search, falling back to mock:", err);
    // Even on error, return mock data to keep the UI working
    if (!query) return res.json(MOCK_KB);
    const filtered = MOCK_KB.filter(article => 
      article.title.toLowerCase().includes(query) || 
      article.content.toLowerCase().includes(query)
    ).slice(0, 5);
    res.json(filtered);
  }
});

router.get("/technicians", async (req, res) => {
  console.log("GET /api/technicians - Fetching all technicians with KPIs");
  try {
    const { data: techs, error: techError } = await supabase
      .from("technicians")
      .select(`*, user:users(name)`)
      .order('created_at', { ascending: false });
    
    if (techError) {
      console.error("Supabase error fetching technicians:", techError);
      return handleSupabaseError(res, techError, "get_technicians");
    }

    let tickets: any[] = [];
    try {
      // Try to fetch all columns needed for KPIs
      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select("assigned_to, status, rating, created_at, resolved_at, sla_target_time")
        .not("assigned_to", "is", null);

      if (ticketError) {
        // Check for "column does not exist" error (Postgres code 42703)
        if (ticketError.code === '42703') {
          console.warn("Supabase schema mismatch: One or more KPI columns (rating, resolved_at, sla_target_time) are missing from the 'tickets' table.");
          console.warn("To fix this, please run the migration SQL at the bottom of 'supabase_schema.sql' in your Supabase SQL Editor.");
        } else {
          console.error("Supabase error fetching tickets for KPIs (non-fatal):", 
            ticketError.message, 
            "Code:", ticketError.code, 
            "Details:", ticketError.details, 
            "Hint:", ticketError.hint
          );
        }
        
        // Fallback: Try to fetch only essential columns if the full query fails
        // This handles cases where columns like 'rating' or 'resolved_at' might be missing
        console.log("Attempting fallback query for basic technician data...");
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("tickets")
          .select("assigned_to, status, created_at")
          .not("assigned_to", "is", null);
          
        if (fallbackError) {
          console.error("Fallback query also failed:", fallbackError.message);
        } else {
          tickets = fallbackData || [];
          console.log(`Fallback query successful, fetched ${tickets.length} tickets for basic KPIs.`);
        }
      } else {
        tickets = ticketData || [];
      }
    } catch (err: any) {
      console.error("Unexpected error fetching tickets for KPIs (non-fatal):", err.message);
    }
    
    const formatted = (techs || []).map(t => {
      const techTickets = tickets.filter(ticket => ticket.assigned_to === t.id);
      const resolvedTickets = techTickets.filter(ticket => ticket.status === 'completed' || ticket.status === 'acknowledged');
      
      // Calculate Avg Resolution Time (in hours)
      let totalResolutionTime = 0;
      let resolvedWithTime = 0;
      resolvedTickets.forEach(ticket => {
        if (ticket.resolved_at && ticket.created_at) {
          const resTime = new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime();
          totalResolutionTime += resTime;
          resolvedWithTime++;
        }
      });
      const avgResolutionTime = resolvedWithTime > 0 ? (totalResolutionTime / resolvedWithTime) / (1000 * 60 * 60) : 0;

      // Calculate SLA Compliance
      let slaCompliant = 0;
      let ticketsWithSla = 0;
      resolvedTickets.forEach(ticket => {
        if (ticket.sla_target_time && ticket.resolved_at) {
          ticketsWithSla++;
          if (new Date(ticket.resolved_at) <= new Date(ticket.sla_target_time)) {
            slaCompliant++;
          }
        }
      });
      const slaCompliance = ticketsWithSla > 0 ? (slaCompliant / ticketsWithSla) * 100 : 100;

      // Calculate Avg Rating
      const ratedTickets = techTickets.filter(ticket => ticket.rating !== null);
      const avgRating = ratedTickets.length > 0 
        ? ratedTickets.reduce((acc, ticket) => acc + (ticket.rating || 0), 0) / ratedTickets.length 
        : 0;

      return {
        ...t,
        name: (t as any).user?.name || 'Unknown',
        kpis: {
          resolved_count: resolvedTickets.length,
          avg_resolution_time: Number(avgResolutionTime.toFixed(1)),
          sla_compliance: Number(slaCompliance.toFixed(1)),
          avg_rating: Number(avgRating.toFixed(1))
        }
      };
    });
    
    console.log(`Successfully fetched ${formatted.length} technicians with KPIs`);
    res.json(formatted);
  } catch (err: any) {
    console.error("Unexpected error in GET /api/technicians:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching technicians" });
  }
});

router.patch("/technicians/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`PATCH /api/technicians/${id}/status - Updating status to ${status}`);
  
  try {
    if (!['available', 'busy', 'offline'].includes(status)) {
      console.warn(`Invalid status update attempt for technician ${id}: ${status}`);
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data, error } = await supabase
      .from("technicians")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Supabase error updating status for technician ${id}:`, error);
      return handleSupabaseError(res, error, "update_technician_status");
    }
    
    console.log(`Technician ${id} status updated to ${status}`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/technicians/${id}/status:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while updating technician status" });
  }
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
        if (userError) return handleSupabaseError(res, userError, "create_user_for_technician");
      }
    } else if (targetId) {
      // Update existing user role
      const { error: roleError } = await supabase.from("users").update({ role: 'technician' }).eq("id", targetId);
      if (roleError) return handleSupabaseError(res, roleError, "update_user_role_to_technician");
    } else if (!targetId) {
      return res.status(400).json({ error: "Either User ID or Name/Email is required." });
    }

    const { data, error } = await supabase
      .from("technicians")
      .upsert([{ id: targetId, specialty, phone, status: status || 'available' }])
      .select()
      .single();
    
    if (error) return handleSupabaseError(res, error, "upsert_technician");
    res.json(data);
  } catch (err: any) {
    console.error("Unexpected error in POST /api/technicians:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while creating/updating technician" });
  }
});

router.patch("/technicians/:id", async (req, res) => {
  const { id } = req.params;
  const { name, specialty, phone, status } = req.body;
  console.log(`PATCH /api/technicians/${id} - Updating technician details`);
  
  try {
    if (name) {
      const { error: userError } = await supabase.from("users").update({ name }).eq("id", id);
      if (userError) return handleSupabaseError(res, userError, "update_user_name");
    }

    const { data, error } = await supabase
      .from("technicians")
      .update({ specialty, phone, status })
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error(`Supabase error updating technician ${id}:`, error);
      return handleSupabaseError(res, error, "update_technician");
    }
    
    console.log(`Technician ${id} updated successfully`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/technicians/${id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while updating technician" });
  }
});

router.delete("/technicians/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/technicians/${id} - Removing technician`);
  
  try {
    // Demote user to end_user
    const { error: userError } = await supabase.from("users").update({ role: 'end_user' }).eq("id", id);
    if (userError) return handleSupabaseError(res, userError, "demote_user_from_technician");

    // Remove from technicians table
    const { error: techError } = await supabase.from("technicians").delete().eq("id", id);
    if (techError) {
      console.error(`Supabase error deleting technician ${id}:`, techError);
      return handleSupabaseError(res, techError, "delete_technician");
    }
    
    console.log(`Technician ${id} removed successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in DELETE /api/technicians/${id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while removing technician" });
  }
});

router.get("/users", async (req, res) => {
  console.log("GET /api/users - Fetching all users");
  try {
    const { data: users, error } = await supabase.from("users").select("*");
    if (error) {
      console.error("Supabase error fetching users:", error);
      return handleSupabaseError(res, error, "get_users");
    }
    console.log(`Successfully fetched ${users?.length || 0} users`);
    res.json(users);
  } catch (err: any) {
    console.error("Unexpected error in GET /api/users:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching users" });
  }
});

router.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  
  // Validate ID format (should be a UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    console.warn(`[API] Invalid user ID format received: ${id}`);
    return res.status(400).json({ 
      error: "Invalid user ID format. Expected a UUID.",
      code: "INVALID_ID_FORMAT"
    });
  }

  console.log(`[API] GET /api/users/${id} - Fetching user profile`);
  
  try {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    
    if (!profileError && profile) {
      console.log(`[API] Successfully fetched profile for user ${id}`);
      return res.json(profile);
    }
    
    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error(`[API] Supabase error fetching profile for user ${id}:`, {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint
      });
      return handleSupabaseError(res, profileError, "get_user_profile");
    }

    // If profile not found in table, try to get from Auth and auto-create
    // CRITICAL: Check if supabase.auth and admin exist to avoid crashes
    if (!supabase.auth || !supabase.auth.admin) {
      console.warn(`[API] User profile ${id} not found and Admin API unavailable (likely using public key).`);
      return res.status(404).json({ 
        error: "User profile not found. Please ensure you have signed in correctly.",
        code: "PROFILE_NOT_FOUND"
      });
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(id);
      if (authError || !user) {
        console.warn(`[API] User ${id} not found in Auth or Profile table.`);
        return res.status(404).json({ 
          error: "User not found. Please sign in again.",
          code: "USER_NOT_FOUND"
        });
      }

      const profileData: any = {
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || "New User",
        role: user.user_metadata?.role || "end_user",
        email: user.email
      };
      
      const { data: newProfile, error: insertError } = await supabase.from("users").upsert([profileData]).select().single();
      if (insertError) {
        console.error("[API] Error auto-creating user profile:", insertError);
        return res.status(500).json({ error: `Failed to auto-create user profile: ${insertError.message}` });
      }
      
      console.log(`[API] Successfully auto-created profile for user ${id}`);
      return res.json(newProfile);
    } catch (authErr: any) {
      console.error(`[API] Auth Admin API error for user ${id}:`, authErr.message);
      return res.status(404).json({ 
        error: "User profile not found and Auth API failed.",
        code: "AUTH_API_ERROR"
      });
    }
  } catch (err: any) {
    console.error(`[API] Unexpected error in GET /api/users/${id}:`, err);
    return res.status(500).json({ error: err.message || "An unexpected error occurred while fetching user profile" });
  }
});

router.post("/users/bulk-update", async (req, res) => {
  const { user_ids, role, changed_by } = req.body;
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }

  console.log(`POST /api/users/bulk-update - Updating ${user_ids.length} users to role ${role} by ${changed_by}`);
  
  try {
    // Fetch old data for audit logs
    const { data: oldUsers, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .in("id", user_ids);

    if (fetchError) {
      console.error("Error fetching users for bulk update:", fetchError);
      return handleSupabaseError(res, fetchError, "get_users_for_bulk_update");
    }

    const { data, error } = await supabase
      .from("users")
      .update({ role })
      .in("id", user_ids)
      .select();

    if (error) {
      console.error("Supabase error in bulk update:", error);
      return handleSupabaseError(res, error, "bulk_update_users");
    }

    // Log the changes
    const auditEntries = oldUsers.map(oldUser => ({
      user_id: oldUser.id,
      changed_by: changed_by || null,
      old_role: oldUser.role,
      new_role: role,
      old_name: oldUser.name,
      new_name: oldUser.name
    }));

    if (auditEntries.length > 0) {
      await supabase.from("user_audit_log").insert(auditEntries);
    }

    // If role was updated to technician, ensure they are in the technicians table
    if (role === 'technician') {
      const techEntries = user_ids.map(id => ({ id, status: 'available' }));
      const { error: techError } = await supabase.from("technicians").upsert(techEntries);
      if (techError) console.error("Error auto-creating technician records in bulk:", techError);
    }
    
    console.log(`Successfully updated ${data.length} users`);
    res.json({ count: data.length, users: data });
  } catch (err: any) {
    console.error("Unexpected error in POST /api/users/bulk-update:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during bulk update" });
  }
});

router.post("/users/bulk-delete", async (req, res) => {
  const { user_ids } = req.body;
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }

  console.log(`POST /api/users/bulk-delete - Deleting ${user_ids.length} users`);
  
  try {
    const { error } = await supabase
      .from("users")
      .delete()
      .in("id", user_ids);

    if (error) {
      console.error("Supabase error in bulk delete:", error);
      return handleSupabaseError(res, error, "bulk_delete_users");
    }
    
    // Also delete from technicians if they were there
    await supabase.from("technicians").delete().in("id", user_ids);
    
    console.log(`Successfully deleted ${user_ids.length} users`);
    res.json({ success: true, count: user_ids.length });
  } catch (err: any) {
    console.error("Unexpected error in POST /api/users/bulk-delete:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during bulk delete" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, role, changed_by } = req.body;
  console.log(`PATCH /api/users/${id} - Updating user profile by ${changed_by}`);
  
  try {
    // Fetch old data for audit log
    const { data: oldUser, error: fetchError } = await supabase.from("users").select("*").eq("id", id).single();
    if (fetchError) {
      console.error(`Error fetching user ${id} for update:`, fetchError);
      return handleSupabaseError(res, fetchError, "get_user_for_update");
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Supabase error updating user ${id}:`, error);
      return handleSupabaseError(res, error, "update_user");
    }

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
      const { error: techError } = await supabase.from("technicians").upsert([{ id, status: 'available' }]);
      if (techError) console.error("Error auto-creating technician record:", techError);
    }
    
    console.log(`User ${id} updated successfully`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/users/${id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while updating user" });
  }
});

router.get("/users/:id/audit-log", async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/users/${id}/audit-log - Fetching audit log`);
  
  try {
    const { data, error } = await supabase
      .from("user_audit_log")
      .select(`
        *,
        changed_by_user:users!user_audit_log_changed_by_fkey(name)
      `)
      .eq("user_id", id)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error(`Supabase error fetching audit log for user ${id}:`, error);
      return handleSupabaseError(res, error, "get_user_audit_log");
    }
    
    console.log(`Successfully fetched ${data?.length || 0} audit log entries for user ${id}`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/users/${id}/audit-log:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching audit log" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  console.log(`POST /api/users/${id}/reset-password - Sending reset email to ${email}`);
  
  if (!email) {
    console.warn(`Reset password failed for user ${id}: Email is required`);
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      console.error(`Supabase error sending reset password email to ${email}:`, error);
      return handleSupabaseError(res, error, "reset_password");
    }
    
    console.log(`Password reset email sent successfully to ${email}`);
    res.json({ message: "Password reset email sent" });
  } catch (err: any) {
    console.error(`Unexpected error in POST /api/users/${id}/reset-password:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while sending reset password email" });
  }
});

router.get("/tickets", async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    priority, 
    category, 
    tag,
    search,
    user_id 
  } = req.query;
  
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  console.log(`GET /api/tickets - Fetching tickets (page: ${pageNum}, limit: ${limitNum}, user: ${user_id})`);
  
  try {
    let query = supabase
      .from("tickets")
      .select(`*, creator:users!tickets_created_by_fkey(name), requester:users!tickets_requested_for_fkey(name), technician:users!tickets_assigned_to_fkey(name)`, { count: 'exact' });

    // Role-based filtering
    if (user_id) {
      const { data: user } = await supabase.from("users").select("role").eq("id", user_id).single();
      if (user && user.role === 'end_user') {
        query = query.or(`created_by.eq.${user_id},requested_for.eq.${user_id}`);
      }
    }

    // Filters
    if (status && status !== 'all') query = query.eq('status', status);
    if (priority && priority !== 'all') query = query.eq('priority', priority);
    if (category && category !== 'all') query = query.eq('category', category);
    if (tag && tag !== '') query = query.contains('tags', [tag]);
    if (search) {
      // Simplified search to avoid potential issues with array column 'tags' in .or()
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: tickets, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      console.error("Supabase error fetching tickets:", error);
      return handleSupabaseError(res, error, "get_tickets_paginated");
    }
    
    if (!tickets) return res.json({ tickets: [], totalCount: 0 });

    // Fetch dependencies for all tickets in one go to avoid N+1 queries
    const ticketIds = tickets.map(t => t.id);
    const { data: allDeps, error: depsError } = await supabase
      .from("ticket_dependencies")
      .select("ticket_id, depends_on_id, ticket:tickets!ticket_dependencies_depends_on_id_fkey(status)")
      .in("ticket_id", ticketIds);

    if (depsError) console.error("Error fetching dependencies for tickets:", depsError);

    const formattedTickets = tickets.map((t) => {
      const deps = allDeps?.filter(d => d.ticket_id === t.id) || [];
      const isBlocked = deps.some(d => (d.ticket as any)?.status !== 'completed' && (d.ticket as any)?.status !== 'acknowledged');
      const slaStatus = calculateSlaStatus(t.sla_target_time, t.status);

      return {
        ...t,
        creator_name: (t as any).creator?.name,
        requester_name: (t as any).requester?.name,
        technician_name: (t as any).technician?.name,
        is_blocked: isBlocked,
        sla_status: slaStatus
      };
    });
    
    console.log(`Successfully fetched ${formattedTickets.length} tickets, total: ${count}`);
    res.json({
      tickets: formattedTickets,
      totalCount: count || 0,
      page: pageNum,
      limit: limitNum
    });
  } catch (err: any) {
    console.error("Unexpected error in GET /api/tickets:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching tickets" });
  }
});

router.post("/tickets", async (req, res) => {
  console.log("POST /api/tickets - Creating new ticket");
  try {
    const { id, title, description, category, priority, created_by, requested_for, tags } = req.body;
    
    const targetHours = SLA_HOURS[priority] || 24;
    const slaTargetTime = new Date(Date.now() + targetHours * 60 * 60 * 1000).toISOString();

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
        requested_for: requested_for || created_by,
        sla_target_time: slaTargetTime,
        tags: tags || []
      }])
      .select()
      .single();
    if (error) {
      console.error("Supabase error creating ticket:", error);
      return handleSupabaseError(res, error, "create_ticket");
    }
    
    const { error: activityError } = await supabase.from("activities").insert([{ ticket_id: id, user_id: created_by, action: "created", details: "Ticket created." }]);
    if (activityError) {
      console.warn("Failed to create initial activity for ticket:", activityError);
    }
    
    console.log(`Ticket ${id} created successfully`);
    res.json(ticket);
  } catch (err: any) {
    console.error("Unexpected error in POST /api/tickets:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while creating ticket" });
  }
});

router.get("/tickets/:id/activities", async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/tickets/${id}/activities - Fetching activities`);
  try {
    const { data: activities, error } = await supabase
      .from("activities")
      .select(`*, user:users(name, role)`)
      .eq("ticket_id", id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(`Supabase error fetching activities for ticket ${id}:`, error);
      return handleSupabaseError(res, error, "get_ticket_activities");
    }
    const formattedActivities = activities.map(a => ({
      ...a,
      user_name: a.user?.name,
      user_role: a.user?.role
    }));
    res.json(formattedActivities);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/tickets/${id}/activities:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching activities" });
  }
});

router.get("/activities", async (req, res) => {
  const { limit = 50 } = req.query;
  console.log(`GET /api/activities - Fetching recent activities (limit: ${limit})`);
  
  try {
    const { data: activities, error } = await supabase
      .from("activities")
      .select(`*, user:users(name, role), ticket:tickets(title, category)`)
      .order('created_at', { ascending: false })
      .limit(Number(limit));
      
    if (error) {
      console.error("Supabase error fetching all activities:", error);
      return handleSupabaseError(res, error, "get_all_activities");
    }
    
    const formattedActivities = activities.map(a => ({
      ...a,
      user_name: a.user?.name,
      user_role: a.user?.role,
      ticket_title: a.ticket?.title,
      ticket_category: a.ticket?.category
    }));
    
    console.log(`Successfully fetched ${formattedActivities.length} activities`);
    res.json(formattedActivities);
  } catch (err: any) {
    console.error("Unexpected error in GET /api/activities:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching activities" });
  }
});

router.patch("/tickets/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { technician_id, user_id } = req.body;
  
  console.log(`PATCH /api/tickets/${id}/assign - Assigning ticket to ${technician_id} by user ${user_id}`);
  
  try {
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
    if (techError) return handleSupabaseError(res, techError, "get_technician");
    
    const { data: ticket, error: ticketFetchError } = await supabase.from("tickets").select("title, assigned_to").eq("id", id).single();
    if (ticketFetchError) return handleSupabaseError(res, ticketFetchError, "get_ticket");
    
    const isReassignment = !!ticket.assigned_to;
    
    const { error: updateError } = await supabase.from("tickets").update({ assigned_to: technician_id, status: "assigned", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) return handleSupabaseError(res, updateError, "assign_ticket");
    
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
    
    console.log(`Successfully ${isReassignment ? 're-assigned' : 'assigned'} ticket ${id} to ${technician.name}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/assign:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while assigning ticket" });
  }
});

router.post("/tickets/:id/comments", async (req, res) => {
  const { id } = req.params;
  console.log(`POST /api/tickets/${id}/comments - Adding comment`);
  try {
    const { user_id, comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }
    const { data, error } = await supabase.from("activities").insert([{
      ticket_id: id,
      user_id,
      action: "commented",
      details: comment
    }]).select().single();
    if (error) {
      console.error(`Supabase error adding comment to ticket ${id}:`, error);
      return handleSupabaseError(res, error, "create_comment");
    }
    console.log(`Comment added to ticket ${id} by user ${user_id}`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in POST /api/tickets/${id}/comments:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while adding comment" });
  }
});

router.patch("/tickets/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority, user_id, tags } = req.body;
  console.log(`PATCH /api/tickets/${id} - Updating ticket details by user ${user_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
    const { data: ticketData, error: ticketError } = await supabase.from("tickets").select("created_by").eq("id", id).single();
    
    if (userError) return handleSupabaseError(res, userError, "get_user_role");
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_creator");
    
    if (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician' && ticketData.created_by !== user_id) {
      console.warn(`User ${user_id} unauthorized to update ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;

    if (priority) {
      const targetHours = SLA_HOURS[priority] || 24;
      updateData.sla_target_time = new Date(Date.now() + targetHours * 60 * 60 * 1000).toISOString();
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error(`Supabase error updating ticket ${id}:`, error);
      return handleSupabaseError(res, error, "update_ticket");
    }
    
    await supabase.from("activities").insert([{
      ticket_id: id,
      user_id,
      action: "update",
      details: "Ticket details updated."
    }]);
    
    console.log(`Ticket ${id} updated successfully`);
    res.json(ticket);
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while updating ticket" });
  }
});

router.patch("/tickets/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, user_id } = req.body;
  console.log(`PATCH /api/tickets/${id}/status - Changing status to ${status} by user ${user_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
  const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title, status").eq("id", id).single();
  if (userError) return handleSupabaseError(res, userError, "get_user_role");
  if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_details");
  
  // Acknowledge is for creator
  if (status === 'acknowledged') {
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.created_by !== user_id && ticket.requested_for !== user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }
  } else if (status === 'assigned' && (ticket.status === 'completed' || ticket.status === 'acknowledged')) {
    // Allow creator/requester to re-open a completed or acknowledged ticket
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
  if (error) return handleSupabaseError(res, error, "update_ticket_status");
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
    console.log(`Ticket ${id} status updated to ${status} successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/status:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while updating ticket status" });
  }
});

router.patch("/tickets/:id/work", async (req, res) => {
  const { id } = req.params;
  const { technician_id, work_done } = req.body;
  console.log(`PATCH /api/tickets/${id}/work - Logging work by technician ${technician_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
    const { data: ticket, error: ticketError } = await supabase.from("tickets").select("assigned_to").eq("id", id).single();
    
    if (userError) return handleSupabaseError(res, userError, "get_user_role");
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_assigned_to");
    
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.assigned_to !== technician_id) {
      console.warn(`User ${technician_id} unauthorized to log work for ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized. Only the assigned technician or IT Lead can log work." });
    }

    const { error: updateError } = await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) return handleSupabaseError(res, updateError, "update_ticket_timestamp");

    const { error: activityError } = await supabase.from("activities").insert([{ ticket_id: id, user_id: technician_id, action: "update", details: work_done }]);
    if (activityError) return handleSupabaseError(res, activityError, "insert_work_activity");

    console.log(`Work logged for ticket ${id} successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/work:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while logging work" });
  }
});

router.patch("/tickets/:id/complete", async (req, res) => {
  const { id } = req.params;
  const { technician_id } = req.body;
  console.log(`PATCH /api/tickets/${id}/complete - Completing ticket by technician ${technician_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", technician_id).single();
    const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();
    
    if (userError) return handleSupabaseError(res, userError, "get_user_role");
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_info");
    
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.assigned_to !== technician_id) {
      console.warn(`User ${technician_id} unauthorized to complete ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized. Only the assigned technician or IT Lead can complete the ticket." });
    }

    // Safe update for ticket completion
    // We try to update with resolved_at first, but if it fails with PGRST204 (column not found),
    // we try again without it to ensure the ticket status still updates.
    let updateError;
    try {
      const { error } = await supabase.from("tickets").update({ 
        status: 'completed', 
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      }).eq("id", id);
      updateError = error;
    } catch (err: any) {
      updateError = err;
    }

    if (updateError && (updateError.code === 'PGRST204' || updateError.message?.includes('resolved_at'))) {
      console.warn(`Supabase schema mismatch: 'resolved_at' column not found in schema cache. Retrying update without it.`);
      const { error: retryError } = await supabase.from("tickets").update({ 
        status: 'completed', 
        updated_at: new Date().toISOString() 
      }).eq("id", id);
      updateError = retryError;
    }

    if (updateError) return handleSupabaseError(res, updateError, "update_ticket_status_complete");

    const { error: activityError } = await supabase.from("activities").insert([{ ticket_id: id, user_id: technician_id, action: "completed", details: "Technician marked the problem as fixed." }]);
    if (activityError) return handleSupabaseError(res, activityError, "insert_complete_activity");

    const message = `Your ticket "${ticket.title}" has been marked as completed.`;
    const recipients = Array.from(new Set([ticket.created_by, ticket.requested_for]));
    for (const recipientId of recipients) {
      if (recipientId) {
        const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: recipientId, message, ticket_id: id }]).select().single();
        if (!notifError) sendNotification(recipientId, notification);
      }
    }
    
    console.log(`Ticket ${id} completed successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/complete:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while completing ticket" });
  }
});

router.patch("/tickets/:id/acknowledge", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  console.log(`PATCH /api/tickets/${id}/acknowledge - Acknowledging ticket by user ${user_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
    const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for, assigned_to, title").eq("id", id).single();
    
    if (userError) return handleSupabaseError(res, userError, "get_user_role");
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_info");
    
    if (user.role !== 'it_lead' && user.role !== 'admin' && ticket.created_by !== user_id && ticket.requested_for !== user_id) {
      console.warn(`User ${user_id} unauthorized to acknowledge ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized. Only the ticket creator or IT Lead can acknowledge the ticket." });
    }

    const { error: updateError } = await supabase.from("tickets").update({ status: 'acknowledged', updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) return handleSupabaseError(res, updateError, "update_ticket_status_acknowledge");

    const { error: activityError } = await supabase.from("activities").insert([{ ticket_id: id, user_id, action: "acknowledged", details: "User acknowledged the resolution." }]);
    if (activityError) return handleSupabaseError(res, activityError, "insert_acknowledge_activity");

    if (ticket.assigned_to) {
      const message = `User has acknowledged the resolution for ticket: ${ticket.title}`;
      const { data: technician, error: techError } = await supabase.from("users").select("*").eq("id", ticket.assigned_to).single();
      const { data: notification, error: notifError } = await supabase.from("notifications").insert([{ user_id: ticket.assigned_to, message, ticket_id: id }]).select().single();
      if (!notifError) sendNotification(ticket.assigned_to, notification);
      if (technician && technician.email) {
        await sendEmailNotification(technician.email, `Ticket Acknowledged: ${ticket.title}`, `<h1>Ticket Acknowledged</h1><p>Hello ${technician.name},</p><p>The user has acknowledged the resolution for ticket: <strong>${ticket.title}</strong>.</p>`);
      }
    }
    
    console.log(`Ticket ${id} acknowledged successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/acknowledge:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while acknowledging ticket" });
  }
});

router.patch("/tickets/:id/rate", async (req, res) => {
  const { id } = req.params;
  const { rating, user_id } = req.body;
  console.log(`PATCH /api/tickets/${id}/rate - Rating ticket by user ${user_id}`);
  
  try {
    const { data: ticket, error: ticketError } = await supabase.from("tickets").select("created_by, requested_for").eq("id", id).single();
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_info");
    
    if (ticket.created_by !== user_id && ticket.requested_for !== user_id) {
      console.warn(`User ${user_id} unauthorized to rate ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized. Only the ticket creator or requester can rate the ticket." });
    }

    const { error: updateError } = await supabase.from("tickets").update({ rating }).eq("id", id);
    if (updateError) return handleSupabaseError(res, updateError, "update_ticket_rating");

    await supabase.from("activities").insert([{ ticket_id: id, user_id, action: "rated", details: `User rated the service: ${rating}/5` }]);
    
    console.log(`Ticket ${id} rated successfully`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/tickets/${id}/rate:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while rating ticket" });
  }
});

router.patch("/tickets/:id/escalate", async (req, res) => {
  const { id } = req.params;
  const { user_id, reason } = req.body;
  console.log(`PATCH /api/tickets/${id}/escalate - Escalating ticket by user ${user_id}`);
  
  try {
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
    const { data: ticket, error: ticketError } = await supabase.from("tickets").select("title, assigned_to").eq("id", id).single();
    
    if (userError) return handleSupabaseError(res, userError, "get_user_role");
    if (ticketError) return handleSupabaseError(res, ticketError, "get_ticket_info");
    
    // Only technicians or leads can escalate
    if (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician') {
      console.warn(`User ${user_id} unauthorized to escalate ticket ${id}`);
      return res.status(403).json({ error: "Unauthorized" });
    }

  const { error } = await supabase
    .from("tickets")
    .update({ 
      is_escalated: true, 
      escalation_reason: reason || 'Unresolved for too long',
      priority: 'critical', 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id);
    
  if (error) return handleSupabaseError(res, error, "escalate_ticket");
  
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
  
  console.log(`Ticket ${id} escalated successfully`);
  res.json({ success: true });
} catch (err: any) {
  console.error(`Unexpected error in PATCH /api/tickets/${id}/escalate:`, err);
  res.status(500).json({ error: err.message || "An unexpected error occurred while escalating ticket" });
}
});

router.post("/tickets/bulk-status", async (req, res) => {
  const { ticketIds, status, user_id } = req.body;
  console.log(`POST /api/tickets/bulk-status - Updating ${ticketIds?.length || 0} tickets to ${status} by user ${user_id}`);
  
  try {
    if (!Array.isArray(ticketIds) || !status) {
      console.warn("Bulk status update failed: Invalid request body");
      return res.status(400).json({ error: "Invalid request body" });
    }
    
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
    if (userError || (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician')) {
      console.warn(`Unauthorized bulk status update attempt by user ${user_id}`);
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.from("tickets").update({ status, updated_at: new Date().toISOString() }).in("id", ticketIds).select();
    if (error) {
      console.error("Supabase error in bulk status update:", error);
      return handleSupabaseError(res, error, "bulk_status_update");
    }
    
    const activities = ticketIds.map(id => ({ ticket_id: id, user_id, action: "update", details: `Bulk status update to ${status}.` }));
    await supabase.from("activities").insert(activities);
    
    console.log(`Successfully updated ${data.length} tickets to ${status}`);
    res.json({ success: true, count: data.length });
  } catch (err: any) {
    console.error("Unexpected error in POST /api/tickets/bulk-status:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during bulk status update" });
  }
});

router.post("/tickets/bulk-delete", async (req, res) => {
  const { ticketIds, user_id } = req.body;
  console.log(`POST /api/tickets/bulk-delete - Deleting ${ticketIds?.length || 0} tickets by user ${user_id}`);
  
  try {
    if (!Array.isArray(ticketIds)) {
      console.warn("Bulk delete failed: Invalid request body");
      return res.status(400).json({ error: "Invalid request body" });
    }
    
    const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", user_id).single();
    if (userError || (user.role !== 'it_lead' && user.role !== 'admin' && user.role !== 'technician')) {
      console.warn(`Unauthorized bulk delete attempt by user ${user_id}`);
      return res.status(403).json({ error: "Unauthorized" });
    }

    await supabase.from("activities").delete().in("ticket_id", ticketIds);
    const { error } = await supabase.from("tickets").delete().in("id", ticketIds);
    if (error) {
      console.error("Supabase error in bulk delete:", error);
      return handleSupabaseError(res, error, "bulk_delete_tickets");
    }
    
    console.log(`Successfully deleted ${ticketIds.length} tickets`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error in POST /api/tickets/bulk-delete:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred during bulk delete" });
  }
});

// Ticket Dependencies
router.get("/tickets/:id/dependencies", async (req, res) => {
  const { id } = req.params;
  console.log(`GET /api/tickets/${id}/dependencies - Fetching dependencies`);
  
  try {
    const { data, error } = await supabase
      .from("ticket_dependencies")
      .select(`
        id,
        depends_on_id,
        ticket:tickets!ticket_dependencies_depends_on_id_fkey(id, title, status, priority)
      `)
      .eq("ticket_id", id);
    
    if (error) {
      console.error(`Supabase error fetching dependencies for ticket ${id}:`, error);
      return handleSupabaseError(res, error, "get_ticket_dependencies");
    }
    
    console.log(`Successfully fetched ${data?.length || 0} dependencies for ticket ${id}`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/tickets/${id}/dependencies:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching dependencies" });
  }
});

router.post("/tickets/:id/dependencies", async (req, res) => {
  const { id } = req.params;
  const { depends_on_id, user_id } = req.body;
  console.log(`POST /api/tickets/${id}/dependencies - Adding dependency on ${depends_on_id} by user ${user_id}`);
  
  try {
    if (id === depends_on_id) {
      console.warn(`Dependency creation failed: Ticket ${id} cannot depend on itself`);
      return res.status(400).json({ error: "A ticket cannot depend on itself." });
    }

    // Check for circular dependency (simple 1-level check for now, can be improved)
    const { data: existing, error: checkError } = await supabase
      .from("ticket_dependencies")
      .select("id")
      .eq("ticket_id", depends_on_id)
      .eq("depends_on_id", id)
      .single();
    
    if (existing) {
      console.warn(`Dependency creation failed: Circular dependency between ${id} and ${depends_on_id}`);
      return res.status(400).json({ error: "Circular dependency detected." });
    }

    const { data, error } = await supabase
      .from("ticket_dependencies")
      .insert([{ ticket_id: id, depends_on_id }])
      .select()
      .single();
    
    if (error) {
      console.error(`Supabase error adding dependency for ticket ${id}:`, error);
      return handleSupabaseError(res, error, "add_ticket_dependency");
    }

    await supabase.from("activities").insert([{
      ticket_id: id,
      user_id,
      action: "update",
      details: `Added dependency on ticket #${depends_on_id}`
    }]);

    console.log(`Dependency added successfully: ${id} depends on ${depends_on_id}`);
    res.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in POST /api/tickets/${id}/dependencies:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while adding dependency" });
  }
});

router.delete("/tickets/:id/dependencies/:dep_id", async (req, res) => {
  const { id, dep_id } = req.params;
  const { user_id } = req.body;
  console.log(`DELETE /api/tickets/${id}/dependencies/${dep_id} - Removing dependency by user ${user_id}`);
  
  try {
    const { error } = await supabase
      .from("ticket_dependencies")
      .delete()
      .eq("id", dep_id);
    
    if (error) {
      console.error(`Supabase error removing dependency ${dep_id} from ticket ${id}:`, error);
      return handleSupabaseError(res, error, "remove_ticket_dependency");
    }

    await supabase.from("activities").insert([{
      ticket_id: id,
      user_id,
      action: "update",
      details: `Removed a dependency.`
    }]);

    console.log(`Dependency ${dep_id} removed successfully from ticket ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in DELETE /api/tickets/${id}/dependencies/${dep_id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while removing dependency" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  console.log(`PATCH /api/notifications/${id}/read - Marking notification as read`);
  
  try {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      console.error(`Supabase error marking notification ${id} as read:`, error);
      return handleSupabaseError(res, error, "mark_notification_read");
    }
    
    console.log(`Notification ${id} marked as read`);
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Unexpected error in PATCH /api/notifications/${id}/read:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while marking notification as read" });
  }
});

router.get("/notifications/:user_id", async (req, res) => {
  const { user_id } = req.params;
  console.log(`GET /api/notifications/${user_id} - Fetching notifications`);
  
  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error(`Supabase error fetching notifications for user ${user_id}:`, error);
      return handleSupabaseError(res, error, "get_notifications");
    }
    
    console.log(`Successfully fetched ${notifications?.length || 0} notifications for user ${user_id}`);
    res.json(notifications);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/notifications/${user_id}:`, err);
    res.status(500).json({ error: err.message || "An unexpected error occurred while fetching notifications" });
  }
});

export default router;
