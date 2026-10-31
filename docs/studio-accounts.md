# Activar las cuentas de Studio

El registro usa Supabase Auth con nombre, correo y contraseña. El nombre se guarda en user_metadata. Cada cuenta separa sus proyectos locales mediante su UUID; no se migran las cuentas antiguas.

## Configuración

1. Crea un proyecto en Supabase.
2. Añade SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY (clave publishable o anon; nunca service_role) en las variables de Vercel. Para desarrollo usa .env.local.
3. En Authentication activa Email, el registro de usuarios y Confirm email. Configura un mínimo de 8 caracteres para las contraseñas.
4. En URL Configuration configura Site URL como https://sonceibe-studio.vercel.app.
5. Configura SMTP propio para enviar a usuarios reales. El remitente integrado de Supabase es para pruebas y restringe destinatarios y frecuencia.
6. En Email Templates cambia los enlaces de Confirm signup y Reset password como se indica abajo. Las plantillas por defecto no corresponden con el flujo token_hash de esta aplicación.
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

Documentación oficial:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp

