# Cuentas sin correo — diseño (2026-11-13)

**Pedido:** «No pidas correos». La app no pide correo al crear la cuenta, ni al entrar, ni al recuperarla. El usuario eligió el enfoque A.

## Enfoques considerados
- **A (elegido): usuario + contraseña + código de recuperación.** No depende de servicios externos. Si se pierden la contraseña y el código a la vez, la cuenta no se puede recuperar.
- B: usuario + PIN de 6 dígitos. Es más débil frente a quien intente adivinarlo.
- C: sin recuperación. Al olvidar la contraseña se pierden los datos.

## Diseño
- **Usuario:** de 3 a 30 caracteres `[a-z0-9._-]`, en minúsculas. Supabase exige un correo, así que se usa uno interno `<usuario>@usuarios.onemillionapp.vercel.app` que nunca recibe mensajes.
- **Código:** `XXXX-XXXX-XXXX` (alfabeto sin caracteres ambiguos, ~59 bits). Solo se guarda su hash scrypt en `recuperacion_cuentas`, una tabla con RLS y sin políticas.
- **Alerta del código:** aparece al crear la cuenta, al recuperarla y al generar uno nuevo. No se cierra tocando afuera. Tiene los botones **Guardar código** (descarga un .txt) y **Copiar**. Para continuar hay que marcar «Ya guardé mi código».
- **¿Olvidaste tu contraseña?:** se escribe el usuario, el código y la contraseña nueva. Al terminar se entra a la app y se entrega un código nuevo, porque el usado deja de servir.
- **Menú «Tu cuenta»** (ícono de usuario): Nuevo código de recuperación (pide la contraseña) y Eliminar cuenta.
- **Cuentas antiguas con correo:** entran una vez con su correo. La app les pide elegir un usuario (`/auth/claim-username`) y les muestra su código.
- **Eliminado:** `/auth/forgot-password`, `/auth/reset-password`, la pantalla `ResetPassword` y la lectura de enlaces de correo.
- **Rate limit:** clave IP + usuario. Se mantienen los techos que ya había.

## Auditoría (2026-11-13)
Se hicieron dos revisiones (`/code-review high` y el revisor de superpowers) y todo lo encontrado quedó corregido:
- `/recovery-code` respondía 401 ante una contraseña incorrecta y el cliente cerraba la sesión. Ahora responde 400. Además cierra la sesión que abre para verificar la contraseña.
- `/claim-username` ahora es idempotente y reversible: primero reserva la fila con el código y después cambia el correo. Si el usuario ya lo había elegido, responde sin código.
- `/recover`: la rotación del código está condicionada al hash que se leyó, así que el código es de un solo uso aunque lleguen dos pedidos a la vez. Si falla el cambio de contraseña, restaura el código. Cierra las demás sesiones. Si la lectura falla, responde 500. Cuando el usuario no existe se compara contra un hash de relleno para que la respuesta tarde lo mismo.
- scrypt asíncrono. Un hash corrupto nunca valida (se exige que mida 32 bytes).
- Usuario: no puede terminar en «.» ni «-», ni tenerlos seguidos. La misma regla está en el cliente (`utils/usernamePolicy.js`) y los errores de validación muestran el motivo concreto.
- Diálogos: `openDialog` compartido en `Confirm.js`. Usan `aria-modal` y pasan el foco al botón principal. Al copiar o guardar, el botón muestra la confirmación, porque un toast quedaría detrás del velo. Los textos usan voseo, como los errores. El aviso usa los tokens de warning. El diálogo obligatorio de elegir usuario tiene «Cerrar sesión» como salida y se cierra si la sesión vence.

## Limitación conocida
Las 2 cuentas creadas con correo que todavía no eligieron usuario no tienen recuperación dentro de la app. Si olvidan la contraseña, hay que restablecerla a mano desde el panel de Supabase.
