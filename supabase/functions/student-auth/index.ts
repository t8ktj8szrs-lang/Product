import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const url = Deno.env.get("SUPABASE_URL")!;

const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findProfile(identifier: string) {
  const value = identifier.trim().toLowerCase();

  if (!value) return null;

  const byUsername = await admin.from("profiles").select("id, username, student_id").eq("username", value).maybeSingle();

  if (byUsername.error) throw byUsername.error;

  if (byUsername.data) return byUsername.data;

  const byStudent = await admin.from("profiles").select("id, username, student_id").eq("student_id", value).maybeSingle();

  if (byStudent.error) throw byStudent.error;

  return byStudent.data;

}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();

    const action = String(body?.action || "");

    if (action === "check") {
      const username = String(body.username || "").trim().toLowerCase();

      const studentNumber = String(body.studentNumber || "").trim().toLowerCase();

      if (!username || !studentNumber) return json({ error: "Username and student number are required." }, 400);

      const [u, s] = await Promise.all([
        admin.from("profiles").select("id").eq("username", username).maybeSingle(),
        admin.from("profiles").select("id").eq("student_id", studentNumber).maybeSingle(),
      ]);

      if (u.error) throw u.error;

      if (s.error) throw s.error;

      const usernameAvailable = !u.data;

      const studentNumberAvailable = !s.data;

      return json({ usernameAvailable, studentNumberAvailable, available: usernameAvailable && studentNumberAvailable });

    }

    if (action === "login") {
      const identifier = String(body.identifier || body.username || body.studentNumber || "").trim();

      const password = String(body.password || "");

      if (!identifier || !password) return json({ error: "Username/student number and password are required." }, 400);

      const profile = await findProfile(identifier);

      if (!profile) return json({ error: "Invalid login credentials." }, 401);

      const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.id);

      if (userError || !userResult.user?.email) return json({ error: "This account needs administrator review." }, 400);

      const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

      const { data, error } = await publicClient.auth.signInWithPassword({ email: userResult.user.email, password });

      if (error || !data.session) return json({ error: "Invalid login credentials." }, 401);

      return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, token_type: "bearer", expires_in: data.session.expires_in, user: data.user });

    }

    if (action === "change-password") {
      const identifier = String(body.identifier || body.username || body.studentNumber || "").trim();

      const currentPassword = String(body.currentPassword || "");

      const newPassword = String(body.newPassword || "");

      if (!identifier || !currentPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return json({ error: "Provide your account identifier, current password, and a valid new password." }, 400);

      }
      const verifier = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

      let profileId: string | null = null;

      if (identifier.includes("@")) {
        const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({ email: identifier.toLowerCase(), password: currentPassword });

        if (verifyError || !verified.user) return json({ error: "Current password is incorrect." }, 401);

        profileId = verified.user.id;

      } else {
        const profile = await findProfile(identifier);

        profileId = profile?.id || null;

        if (!profileId) return json({ error: "Account not found." }, 404);

        const { data: account, error: accountError } = await admin.auth.admin.getUserById(profileId);

        if (accountError || !account.user?.email) return json({ error: "Account not found." }, 404);

        const { error: identifierVerifyError } = await verifier.auth.signInWithPassword({ email: account.user.email, password: currentPassword });

        if (identifierVerifyError) return json({ error: "Current password is incorrect." }, 401);

      }
      if (!profileId) return json({ error: "Account not found." }, 404);

      const { error: updateError } = await admin.auth.admin.updateUserById(profileId, { password: newPassword });

      if (updateError) throw updateError;

      return json({ success: true });

    }

    if (action === "delete-account") {
      const authorization = req.headers.get("Authorization") || "";

      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!token) return json({ error: "A signed-in session is required." }, 401);

      const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

      const { data: authData, error: authError } = await publicClient.auth.getUser(token);

      if (authError || !authData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);

      const id = authData.user.id;

      const { error: dataError } = await admin.from("user_data").delete().eq("user_id", id);

      if (dataError) throw dataError;

      const { error: profileError } = await admin.from("profiles").delete().eq("id", id);

      if (profileError) throw profileError;

      const { error: deleteError } = await admin.auth.admin.deleteUser(id);

      if (deleteError) throw deleteError;

      return json({ success: true });

    }

    if (action === "reset") {
      return json({ error: "Email password recovery is disabled for this Budgtree deployment. Contact the Budgtree administrator for identity verification and account recovery." }, 400);

    }

    return json({ error: "Unsupported action." }, 400);

  } catch (error) {
    console.error("student-auth error:", error);

    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);

  }
});
