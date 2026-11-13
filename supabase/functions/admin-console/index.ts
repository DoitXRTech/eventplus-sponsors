import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Backend del panel de admin de plataforma: crear organizaciones nuevas (con su primer
// evento y su primer usuario de equipo), sumar otros admins de plataforma, y entrar como
// el equipo de una organizacion para editarla. Corre server-side porque todo esto necesita
// la Admin API (crear usuarios de auth, generar un link de acceso), que nunca puede llegar
// al navegador. Valida is_platform_admin() con el JWT de quien llama antes de tocar nada --
// nunca confia en un flag que mande el cliente.

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

async function uploadOrgAsset(
  admin: ReturnType<typeof createClient>,
  opts: { id: string; folder: "logo" | "favicon"; column: "logo_path" | "favicon_path"; filename: string; contentType?: string; dataBase64: string },
) {
  const bytes = Uint8Array.from(atob(opts.dataBase64), (c) => c.charCodeAt(0));
  if (bytes.byteLength > 5 * 1024 * 1024) return { error: "El archivo pesa más de 5 MB" };
  const safeName = opts.filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${opts.id}/${opts.folder}/${Date.now()}-${safeName}`;
  const { error: upErr } = await admin.storage.from("org-logos").upload(path, bytes, { contentType: opts.contentType || "application/octet-stream", upsert: false });
  if (upErr) return { error: upErr.message };
  const { data, error } = await admin.from("organizations").update({ [opts.column]: path }).eq("id", opts.id).select().single();
  if (error) return { error: error.message };
  return { organization: data };
}

// Busca que es HOY un email, antes de tocarlo: si ya es admin de plataforma o ya pertenece
// a una organizacion, crear/resetear esa cuenta a ciegas pisaria quien es sin avisar (y
// la rompe: hoy "soy admin de plataforma" y "tengo perfil" son mutuamente excluyentes en
// App.jsx -- alguien con las dos cosas queda atrapado en una sola pantalla para siempre).
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

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "no_autorizado" }, 401);

  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) return json({ error: "no_autorizado" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  try {
    if (body.action === "create_org") {
      const { name, slug, event, team } = body as {
        name: string; slug: string;
        event: { name: string; city?: string; venue?: string; start: string; end: string };
        team: { email: string; name?: string };
      };
      if (!name || !slug || !event?.name || !event?.start || !event?.end || !team?.email) {
        return json({ error: "faltan_datos" }, 400);
      }

      const { data: org, error: orgErr } = await admin.from("organizations")
        .upsert({ name, slug }, { onConflict: "slug" }).select().single();
      if (orgErr) return json({ error: orgErr.message }, 400);

      const { data: existingEvents } = await admin.from("events").select("id").eq("organization_id", org.id).limit(1);
      let ev = existingEvents?.[0];
      if (!ev) {
        const { data: newEv, error: evErr } = await admin.from("events")
          .insert({ organization_id: org.id, name: event.name, city: event.city || "", venue: event.venue || "", start_date: event.start, end_date: event.end })
          .select().single();
        if (evErr) return json({ error: evErr.message }, 400);
        ev = newEv;
      }

      const identity = await findExistingIdentity(admin, team.email);
      if (identity?.isPlatformAdmin) return json({ error: "ese_email_ya_es_admin_de_plataforma" }, 400);
      if (identity?.profile && identity.profile.organization_id !== org.id) return json({ error: "ese_email_ya_pertenece_a_otra_organizacion" }, 400);

      const password = randomPassword();
      const user = await ensureAuthUser(admin, team.email, team.name, password);
      const { error: profErr } = await admin.from("profiles")
        .upsert({ id: user.id, full_name: team.name || team.email, title: "Equipo", kind: "team", sponsor_id: null, organization_id: org.id }, { onConflict: "id" });
      if (profErr) return json({ error: profErr.message }, 400);

      return json({ organization: org, event: ev, team: { email: team.email, password } });
    }

    if (body.action === "add_platform_admin") {
      const { email, full_name } = body as { email: string; full_name?: string };
      if (!email) return json({ error: "faltan_datos" }, 400);

      const identity = await findExistingIdentity(admin, email);
      if (identity?.profile) return json({ error: "ese_email_ya_pertenece_a_una_organizacion" }, 400);

      const password = randomPassword();
      const user = await ensureAuthUser(admin, email, full_name, password);
      const { error } = await admin.from("platform_admins").upsert({ user_id: user.id }, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ email, password });
    }

    if (body.action === "list_orgs") {
      const { data: orgs, error: orgsErr } = await admin.from("organizations").select("*").order("created_at", { ascending: false });
      if (orgsErr) return json({ error: orgsErr.message }, 400);

      const { data: profiles, error: profErr } = await admin.from("profiles").select("id, full_name, title, organization_id").eq("kind", "team");
      if (profErr) return json({ error: profErr.message }, 400);

      // Si el admin esta "viendo como equipo" alguna organizacion ahora mismo, tiene un
      // perfil temporal ahi -- no lo mostramos como si fuera un miembro de equipo real.
      const { data: admins } = await admin.from("platform_admins").select("user_id");
      const adminIds = new Set((admins || []).map((a) => a.user_id));

      const { data: userList, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (listErr) return json({ error: listErr.message }, 400);
      const emailById = new Map(userList.users.map((u) => [u.id, u.email]));

      const teamByOrg = new Map<string, { email: string; full_name: string; title: string }[]>();
      for (const p of (profiles || []).filter((p) => !adminIds.has(p.id))) {
        const list = teamByOrg.get(p.organization_id) || [];
        list.push({ email: emailById.get(p.id) || "(sin email)", full_name: p.full_name, title: p.title });
        teamByOrg.set(p.organization_id, list);
      }

      return json({ organizations: (orgs || []).map((o) => ({ ...o, team: teamByOrg.get(o.id) || [] })) });
    }

    if (body.action === "update_org") {
      const { id, name, slug, color_primary, color_accent } = body as {
        id: string; name: string; slug: string; color_primary?: string | null; color_accent?: string | null;
      };
      if (!id || !name || !slug) return json({ error: "faltan_datos" }, 400);
      const { data, error } = await admin.from("organizations")
        .update({ name, slug, color_primary: color_primary || null, color_accent: color_accent || null })
        .eq("id", id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ organization: data });
    }

    if (body.action === "upload_org_logo" || body.action === "upload_org_favicon") {
      const { id, filename, contentType, dataBase64 } = body as {
        id: string; filename: string; contentType?: string; dataBase64: string;
      };
      if (!id || !filename || !dataBase64) return json({ error: "faltan_datos" }, 400);
      const isFavicon = body.action === "upload_org_favicon";
      const result = await uploadOrgAsset(admin, {
        id, filename, contentType, dataBase64,
        folder: isFavicon ? "favicon" : "logo",
        column: isFavicon ? "favicon_path" : "logo_path",
      });
      if (result.error) return json({ error: result.error }, 400);
      return json({ organization: result.organization });
    }

    if (body.action === "start_impersonation") {
      // No crea una identidad nueva ni cambia el login: le da a la MISMA cuenta del admin
      // un perfil de equipo temporal en esa organizacion (upsert por id, asi que si ya
      // estaba viendo otra organizacion, pasa a esta -- un admin ve una a la vez). Hace
      // falta service_role porque is_team() todavia es falso para el admin en este momento
      // (no tiene perfil aun), asi que profiles_team_insert lo rechazaria por RLS.
      const { organization_id } = body as { organization_id: string };
      if (!organization_id) return json({ error: "faltan_datos" }, 400);
      const { error } = await admin.from("profiles").upsert(
        { id: userData.user.id, full_name: "Admin de plataforma", title: "Viendo como equipo", kind: "team", sponsor_id: null, organization_id },
        { onConflict: "id" },
      );
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "accion_invalida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
