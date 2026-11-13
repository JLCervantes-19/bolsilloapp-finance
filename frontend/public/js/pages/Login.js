import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { authService } from "../services/auth.js";
import { PasswordRules } from "../components/PasswordRules.js";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";
import { showRecoveryCode } from "../components/RecoveryCode.js";
import { USERNAME_HINT, usernameError } from "../utils/usernamePolicy.js";

const show = (el, visible, display = "block") => (el.style.display = visible ? display : "none");

export function renderLogin({ onSuccess }) {
  let mode = "login"; // login | signup | forgot

  const nameLabel = h("p", { class: "field-label" }, "Nombre");
  const nameField = h("input", { type: "text", class: "text-field", placeholder: "Tu nombre", autocomplete: "name" });
  const usernameField = h("input", {
    type: "text",
    class: "text-field",
    placeholder: "tu_usuario",
    required: true,
    autocomplete: "username",
    autocapitalize: "none",
    spellcheck: "false",
    maxLength: 120, // las cuentas antiguas todavía pueden entrar con su correo
  });
  const usernameHint = h("p", { class: "auth-hint" }, USERNAME_HINT);
  const codeLabel = h("p", { class: "field-label" }, "Código de recuperación");
  const codeField = h("input", {
    type: "text",
    class: "text-field",
    placeholder: "XXXX-XXXX-XXXX",
    autocomplete: "off",
    autocapitalize: "characters",
    spellcheck: "false",
  });
  const passwordLabel = h("p", { class: "field-label" }, "Contraseña");
  const passwordField = h("input", { type: "password", class: "text-field", placeholder: "Tu contraseña", required: true });
  const passwordRules = PasswordRules();
  const submitBtn = Button({ label: "Entrar", fullWidth: true, type: "submit" });
  const switchBtn = h("button", { type: "button", class: "auth-switch" });
  const forgotBtn = h("button", { type: "button", class: "auth-switch" });
  const errorEl = h("p", { class: "auth-error" });
  const privacyCheck = h("input", { type: "checkbox", id: "accept-privacy" });
  const privacyRow = h("label", { for: "accept-privacy", class: "field-label", style: "gap:8px;align-items:flex-start;text-transform:none" }, [
    privacyCheck,
    h("span", {}, [
      "Acepto la ",
      h("a", { href: "./privacidad.html", target: "_blank", rel: "noopener" }, "política de tratamiento de datos"),
      " y los ",
      h("a", { href: "./terminos.html", target: "_blank", rel: "noopener" }, "términos de uso"),
      ".",
    ]),
  ]);

  passwordField.addEventListener("input", () => passwordRules.update(passwordField.value));

  function applyMode() {
    const signup = mode === "signup";
    const forgot = mode === "forgot";
    const newPassword = signup || forgot;

    show(nameLabel, signup);
    show(nameField, signup);
    if (!signup) nameField.value = "";
    show(usernameHint, signup);
    show(codeLabel, forgot);
    show(codeField, forgot);
    codeField.required = forgot;
    if (!forgot) codeField.value = "";
    show(passwordRules.el, newPassword, "flex");
    show(privacyRow, signup, "flex");
    privacyCheck.checked = false;

    passwordLabel.textContent = forgot ? "Contraseña nueva" : "Contraseña";
    passwordField.placeholder = forgot ? "Tu contraseña nueva" : "Tu contraseña";
    passwordField.autocomplete = newPassword ? "new-password" : "current-password";
    passwordField.value = "";
    passwordRules.update("");

    submitBtn.querySelector(".btn__label").textContent = signup ? "Crear cuenta" : forgot ? "Cambiar contraseña" : "Entrar";
    show(switchBtn, !forgot);
    switchBtn.textContent = signup ? "¿Ya tienes cuenta? Entrar" : "¿No tienes cuenta? Crear una";
    forgotBtn.textContent = forgot ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?";
    clear(errorEl);
  }

  switchBtn.addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    applyMode();
  });

  forgotBtn.addEventListener("click", () => {
    mode = mode === "forgot" ? "login" : "forgot";
    applyMode();
  });

  const form = h(
    "form",
    {
      class: "auth-form",
      onSubmit: async (e) => {
        e.preventDefault();
        clear(errorEl);

        if (mode === "signup" && !privacyCheck.checked) {
          errorEl.textContent = "Para crear la cuenta tenés que aceptar la política de tratamiento de datos.";
          return;
        }

        if (mode === "signup" && usernameError(usernameField.value)) {
          errorEl.textContent = usernameError(usernameField.value);
          usernameField.focus();
          return;
        }

        if (mode !== "login" && !passwordMeetsPolicy(passwordField.value)) {
          errorEl.textContent = "Completá los requisitos de la contraseña marcados abajo.";
          passwordField.focus();
          return;
        }

        const username = usernameField.value.trim().toLowerCase();
        setButtonState(submitBtn, "loading");
        try {
          if (mode === "signup") {
            const data = await authService.signup(username, passwordField.value, nameField.value.trim(), privacyCheck.checked);
            setButtonState(submitBtn, "success");
            await showRecoveryCode(data.recovery_code, { username });
          } else if (mode === "forgot") {
            const data = await authService.recover(username, codeField.value, passwordField.value);
            setButtonState(submitBtn, "success");
            // El código usado ya no sirve: se entrega uno nuevo.
            await showRecoveryCode(data.recovery_code, { username });
          } else {
            await authService.login(username, passwordField.value);
            setButtonState(submitBtn, "success");
          }
          onSuccess?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          errorEl.textContent = err.message;
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      nameLabel,
      nameField,
      h("p", { class: "field-label" }, "Usuario"),
      usernameField,
      usernameHint,
      codeLabel,
      codeField,
      passwordLabel,
      passwordField,
      passwordRules.el,
      privacyRow,
      errorEl,
      submitBtn,
      forgotBtn,
      switchBtn,
    ]
  );

  applyMode();

  return h("div", { class: "auth-screen" }, [
    h("div", { class: "auth-card glass-strong glass-in" }, [
      h("div", { class: "auth-brand" }, [h("span", {}, "One Million"), h("span", { class: "sidebar__brand-dot" }, ".")]),
      h("p", { class: "auth-tagline" }, "Simplicidad para tu bolsillo"),
      form,
    ]),
  ]);
}
