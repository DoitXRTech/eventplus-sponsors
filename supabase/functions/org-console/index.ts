import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Backend para que un usuario de equipo sume gente a SU PROPIA organizacion (otro miembro
// de equipo, o el contacto de un patrocinador) sin correr scripts.mjs a mano. Corre server-
// side porque crear el login de esa persona necesita la Admin API (service_role), que nunca
// puede llegar al navegador. A diferencia de admin-console, aca el chequeo de autorizacion
// es "es team de esta organizacion", no "es admin de plataforma".

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

function randomPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// Busca que es HOY un email antes de tocarlo: si ya es admin de plataforma o ya pertenece
// a OTRA organizacion, sumarlo a ciegas lo pisaria sin avisar (y a un admin de plataforma
// lo deja atrapado: hoy "soy admin" y "tengo perfil" son mutuamente excluyentes en App.jsx).
async function findExistingIdentity(admin: ReturnType<typeof createClient>, email: string) {
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = list.users.find((u) => u.email === email);
  if (!user) return null;
  const { data: adminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { userId: user.id, isPlatformAdmin: Boolean(adminRow), profile };
}

async function ensureAuthUser(admin: ReturnType<typeof createClient>, email: string, fullName: string | undefined, password: string) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email === email);
  if (user) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName || email } });
    if (error) throw error;
    user = data.user;
  }
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "no_autorizado" }, 401);

  // Cliente "como el usuario": respeta profiles_read (RLS), nunca confia en un
  // organization_id o kind que mande el cliente en el body.
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "no_autorizado" }, 401);

  const { data: me, error: meErr } = await userClient.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
  if (meErr || !me || me.kind !== "team") return json({ error: "no_autorizado" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  try {
    if (body.action === "add_team_member") {
      const { email, full_name, title } = body as { email: string; full_name?: string; title?: string };
      if (!email) return json({ error: "faltan_datos" }, 400);

      const identity = await findExistingIdentity(admin, email);
      if (identity?.isPlatformAdmin) return json({ error: "ese_email_ya_es_admin_de_plataforma" }, 400);
      if (identity?.profile && identity.profile.organization_id !== me.organization_id) return json({ error: "ese_email_ya_pertenece_a_otra_organizacion" }, 400);

      const password = randomPassword();
      const user = await ensureAuthUser(admin, email, full_name, password);
      const { error } = await admin.from("profiles")
        .upsert({ id: user.id, full_name: full_name || email, title: title || "Equipo", kind: "team", sponsor_id: null, organization_id: me.organization_id }, { onConflict: "id" });
      if (error) return json({ error: error.message }, 400);
      return json({ email, password });
    }

    if (body.action === "add_sponsor_contact") {
      const { sponsor_id, email, full_name, title } = body as { sponsor_id: string; email: string; full_name?: string; title?: string };
      if (!sponsor_id || !email) return json({ error: "faltan_datos" }, 400);
      const { data: sponsor, error: spErr } = await admin.from("sponsors").select("id, organization_id").eq("id", sponsor_id).maybeSingle();
      if (spErr || !sponsor) return json({ error: "sponsor_no_existe" }, 400);
      if (sponsor.organization_id !== me.organization_id) return json({ error: "no_autorizado" }, 403);

      const identity = await findExistingIdentity(admin, email);
      if (identity?.isPlatformAdmin) return json({ error: "ese_email_ya_es_admin_de_plataforma" }, 400);
      if (identity?.profile && identity.profile.organization_id !== me.organization_id) return json({ error: "ese_email_ya_pertenece_a_otra_organizacion" }, 400);

      const password = randomPassword();
      const user = await ensureAuthUser(admin, email, full_name, password);
      const { error } = await admin.from("profiles")
        .upsert({ id: user.id, full_name: full_name || email, title: title || "", kind: "sponsor", sponsor_id }, { onConflict: "id" });
      if (error) return json({ error: error.message }, 400);
      return json({ email, password });
    }

    return json({ error: "accion_invalida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
