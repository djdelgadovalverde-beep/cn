// Edge Function: alta, cambio de clave y baja de usuarios. Solo la puede usar un ADMIN.
// Despliegue: supabase functions deploy admin-users
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: who } = await admin.auth.getUser(token);
    if (!who?.user) return json({ error: 'Sesión inválida' }, 401);
    const { data: me } = await admin.from('profiles').select('rol,activo').eq('id', who.user.id).single();
    if (!me || me.rol !== 'admin' || !me.activo) return json({ error: 'Solo administradores' }, 403);

    const b = await req.json();
    const usuario = String(b.usuario || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const email = `${usuario}@cn.app`;

    if (b.action === 'create') {
      if (!usuario || String(b.password || '').length < 8) return json({ error: 'Usuario y clave (mín. 8) obligatorios' }, 400);
      if (!['admin', 'gerencia', 'supervisor', 'asesor'].includes(b.rol)) return json({ error: 'Rol inválido' }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: e2 } = await admin.from('profiles').insert({
        id: data.user.id, usuario, nombre: b.nombre || usuario, rol: b.rol,
        ecm_code: b.ecm_code || null, supervisor: b.supervisor || null, region: b.region || null,
      });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
      return json({ ok: true });
    }
    if (b.action === 'password') {
      if (String(b.password || '').length < 8) return json({ error: 'Clave mínima de 8 caracteres' }, 400);
      const { error } = await admin.auth.admin.updateUserById(b.id, { password: b.password });
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (b.action === 'delete') {
      if (b.id === who.user.id) return json({ error: 'No puedes eliminarte a ti mismo' }, 400);
      const { error } = await admin.auth.admin.deleteUser(b.id);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
