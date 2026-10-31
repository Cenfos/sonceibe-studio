# Activar las cuentas de Studio

El registro usa Supabase Auth con nombre, correo y contraseña. El nombre se guarda en user_metadata. Cada cuenta separa sus proyectos locales mediante su UUID; no se migran las cuentas antiguas.

## Configuración

1. Crea un proyecto en Supabase.
2. Añade SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (clave publishable o anon; nunca service_role) en las variables de Vercel. Para desarrollo usa .env.local.
3. En Authentication activa Email, el registro de usuarios y Confirm email. Configura un mínimo de 8 caracteres para las contraseñas.
4. En URL Configuration configura Site URL como https://www.sonceibe.es/studio (sin barra final). Las plantillas añaden /access y no necesitan cambios.
5. Configura SMTP propio para enviar a usuarios reales. El remitente integrado de Supabase es para pruebas y restringe destinatarios y frecuencia.
6. Puedes usar las plantillas predeterminadas de Supabase o personalizarlas con los enlaces token_hash indicados abajo. Studio admite tanto la sesión devuelta en el fragmento de las plantillas predeterminadas como los enlaces token_hash.
7. Revisa los límites de frecuencia del proveedor. La aplicación conserva las respuestas 429; no usa contadores locales en una instancia de Vercel.

Confirm signup:

```html
<h2>Confirma tu cuenta de SonCeibe Studio</h2>
<p><a href="{{ .SiteURL }}/access?token_hash={{ .TokenHash }}&amp;type=email">Confirmar mi cuenta</a></p>
```

Reset password:

```html
<h2>Recupera tu cuenta de SonCeibe Studio</h2>
<p><a href="{{ .SiteURL }}/access?token_hash={{ .TokenHash }}&amp;type=recovery">Elegir una nueva contraseña</a></p>
```

Los tokens se consumen después de pulsar el botón de confirmación, no al abrir el enlace, para evitar que un simple GET de un escáner de correo los consuma. Las cookies de acceso y renovación son HTTP-only y Secure en producción. Después de cambiar la contraseña se solicita entrar de nuevo y se revocan los tokens de renovación; los tokens de acceso previamente emitidos pueden seguir siendo válidos hasta su caducidad.

## Publicación

Publica cuando las variables, las plantillas y SMTP estén listos. No elimines STUDIO_ACCESS_CODES de la versión anterior antes de publicar. El código nuevo ignora esa variable y limpia la cookie anterior al iniciar o cerrar sesión; después se puede retirar la variable.

Verifica con un correo real: registro, confirmación del correo, entrada al editor, cierre de sesión, entrada con contraseña, recuperación por correo, nueva contraseña y entrada de nuevo. Comprueba que la contraseña antigua falla, que no se reutilizan los enlaces y que dos cuentas no comparten proyectos locales. Comprueba la descarga del instalador.

Sin configuración de Supabase se deniega el acceso, también en desarrollo. No se añade sincronización de proyectos entre dispositivos.

## Publicación bajo /studio

Studio usa basePath /studio. La web principal reescribe /studio/:path* hacia https://sonceibe-studio.vercel.app/studio/:path*, incluidos recursos y API. El enlace del menú cruza entre aplicaciones con una navegación completa. El botón SonCeibe.es del editor apunta a https://sonceibe.es.

Las rutas antiguas del dominio de Vercel redirigen a sus equivalentes con /studio, conservando las consultas de los correos ya enviados. Las cookies nuevas quedan limitadas a /studio. Al pasar al dominio público hay que iniciar sesión otra vez; los proyectos del navegador anterior no se transfieren entre dominios.

Para desarrollo abre http://localhost:3000/studio. El script tests/auth-ui.mjs admite STUDIO_TEST_URL con el origen del servidor local (sin /studio).

## Menú de cuenta

El inicio y los editores de escritorio y móvil muestran el nombre de la cuenta (o el correo si no hay nombre). El menú permite consultar el correo, cambiar el nombre, cambiar la contraseña y cerrar sesión. El perfil inicial procede del usuario verificado en el servidor. Cambiar nombre solo modifica user_metadata.name: no cambia el UUID de los proyectos.

Para cambiar la contraseña desde la cuenta, el servidor comprueba la sesión y vuelve a autenticar al mismo usuario con su contraseña actual antes de guardar la nueva. El correo y el UUID de destino se obtienen de la sesión verificada y nunca del formulario. La sesión del navegador se conserva al terminar; la recuperación por correo sigue disponible en la pantalla de acceso.

Documentación oficial:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp

