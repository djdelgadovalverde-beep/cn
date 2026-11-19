# Base de datos (Supabase)

La **fuente de verdad** del esquema es el proyecto de Supabase `iizebvjhmpglgsunmtog` (región sa-east-1). Los archivos
`schema*.sql` de esta carpeta son la base inicial; después se aplicaron más de 20 migraciones desde el asistente
(permisos por región, tipos de usuario, rendimiento de RLS, análisis de SOS/SOE, plan diario…).

## Traer el esquema real a tu repositorio (una vez)
```bash
npm i -g supabase          # o: npx supabase ...
supabase login
supabase link --project-ref iizebvjhmpglgsunmtog
supabase db pull           # crea supabase/migrations/<fecha>_remote_schema.sql
```
Haz commit de esa migración: desde ese momento el esquema queda versionado en GitHub.

## Cambios de esquema a futuro
```bash
supabase migration new nombre_del_cambio     # crea el archivo vacío en supabase/migrations
# edita el SQL y luego:
supabase db push
```
Reglas del proyecto: toda política RLS usa `(select my_role())` / `(select tiene_permiso('...'))` (se evalúa una vez por consulta);
nunca políticas `ALL` de escritura sobre tablas de lectura masiva (también regirían las lecturas).

## Función de usuarios
`functions/admin-users/index.ts` (alta, clave y baja de usuarios; solo administrador):
```bash
supabase functions deploy admin-users
```
