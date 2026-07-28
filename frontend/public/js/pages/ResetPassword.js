import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { authService } from "../services/auth.js";
import { showToast } from "../components/Toast.js";
import { PasswordRules } from "../components/PasswordRules.js";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";
import { store } from "../store/store.js";

/**
 * Pantalla a la que llega el usuario tras tocar el link de "restablecer
 * contraseña" del correo — `app.js` ya intercambió los tokens del link por
 * una sesión temporal antes de montar esta ruta (ver `handleAuthRedirect`
 * en services/auth.js). Si no hay sesión (link vencido, refrescó la página,
 * entró directo a la URL), se muestra un aviso en vez de un formulario roto.
 */
export function renderResetPassword({ onSuccess }) {
  const hasRecoverySession = Boolean(store.state.session?.access_token);

  if (!hasRecoverySession) {
    return h("div", { class: "auth-screen" }, [
      h("div", { class: "auth-card glass-strong glass-in" }, [
        h("div", { class: "auth-brand" }, [h("span", {}, "bolsillo"), h("span", { class: "sidebar__brand-dot" }, ".")]),
        h("p", { class: "auth-tagline" }, "Este link de recuperación ya no es válido"),
        h("p", { style: "color:var(--text-secondary);font-size:var(--fs-sm);margin:0 0 var(--space-4)" }, "Pedí uno nuevo desde la pantalla de inicio de sesión."),
        Button({ label: "Ir a iniciar sesión", fullWidth: true, onClick: () => onSuccess?.() }),
      ]),
    ]);
  }

  const passwordField = h("input", {
    type: "password",
    class: "text-field",
    placeholder: "Nueva contraseña",
    required: true,
    autocomplete: "new-password",
  });
  const confirmField = h("input", {
    type: "password",
    class: "text-field",
    placeholder: "Repetí la contraseña",
    required: true,
    autocomplete: "new-password",
  });
  const passwordRules = PasswordRules();
  const errorEl = h("p", { class: "auth-error" });
  const submitBtn = Button({ label: "Guardar contraseña", fullWidth: true, type: "submit" });

  passwordField.addEventListener("input", () => passwordRules.update(passwordField.value));

  const form = h(
    "form",
    {
      class: "auth-form",
      onSubmit: async (e) => {
        e.preventDefault();
        clear(errorEl);

        if (!passwordMeetsPolicy(passwordField.value)) {
          errorEl.textContent = "Completá los requisitos de la contraseña marcados abajo.";
          passwordField.focus();
          return;
        }
        if (passwordField.value !== confirmField.value) {
          errorEl.textContent = "Las contraseñas no coinciden.";
          confirmField.focus();
          return;
        }

        setButtonState(submitBtn, "loading");
        try {
          await authService.resetPassword(passwordField.value);
          setButtonState(submitBtn, "success");
          showToast("Contraseña actualizada — iniciá sesión con la nueva.");
          onSuccess?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          errorEl.textContent = err.message;
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Nueva contraseña"),
      passwordField,
      passwordRules.el,
      h("p", { class: "field-label" }, "Repetir contraseña"),
      confirmField,
      errorEl,
      submitBtn,
    ]
  );

  return h("div", { class: "auth-screen" }, [
    h("div", { class: "auth-card glass-strong glass-in" }, [
      h("div", { class: "auth-brand" }, [h("span", {}, "bolsillo"), h("span", { class: "sidebar__brand-dot" }, ".")]),
      h("p", { class: "auth-tagline" }, "Elegí tu nueva contraseña"),
      form,
    ]),
  ]);
}
