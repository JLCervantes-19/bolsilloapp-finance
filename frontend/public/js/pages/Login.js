import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { authService } from "../services/auth.js";
import { showToast } from "../components/Toast.js";
import { PasswordRules } from "../components/PasswordRules.js";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";

export function renderLogin({ onSuccess }) {
  let mode = "login"; // login | signup

  const nameField = h("input", { type: "text", class: "text-field", placeholder: "Tu nombre", style: "display:none" });
  const emailField = h("input", { type: "email", class: "text-field", placeholder: "tú@correo.com", required: true });
  const passwordField = h("input", {
    type: "password",
    class: "text-field",
    placeholder: "Tu contraseña",
    required: true,
    autocomplete: "new-password",
  });
  const passwordRules = PasswordRules();
  const submitBtn = Button({ label: "Entrar", fullWidth: true, type: "submit" });
  const switchBtn = h("button", { type: "button", class: "auth-switch" }, "¿No tienes cuenta? Crear una");
  const errorEl = h("p", { class: "auth-error" });

  passwordField.addEventListener("input", () => passwordRules.update(passwordField.value));

  function applyMode() {
    nameField.style.display = mode === "signup" ? "block" : "none";
    passwordRules.el.style.display = mode === "signup" ? "flex" : "none";
    passwordField.autocomplete = mode === "signup" ? "new-password" : "current-password";
    submitBtn.querySelector(".btn__label").textContent = mode === "signup" ? "Crear cuenta" : "Entrar";
    switchBtn.textContent = mode === "signup" ? "¿Ya tienes cuenta? Entrar" : "¿No tienes cuenta? Crear una";
    clear(errorEl);
  }

  switchBtn.addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    applyMode();
  });

  const form = h(
    "form",
    {
      class: "auth-form",
      onSubmit: async (e) => {
        e.preventDefault();
        clear(errorEl);

        if (mode === "signup" && !passwordMeetsPolicy(passwordField.value)) {
          errorEl.textContent = "Completá los requisitos de la contraseña marcados abajo.";
          passwordField.focus();
          return;
        }

        setButtonState(submitBtn, "loading");
        try {
          if (mode === "signup") {
            const data = await authService.signup(emailField.value, passwordField.value, nameField.value);
            if (!data.session) {
              showToast("Cuenta creada — revisá tu correo para confirmar");
              mode = "login";
              applyMode();
              setButtonState(submitBtn, null);
              return;
            }
          } else {
            await authService.login(emailField.value, passwordField.value);
          }
          setButtonState(submitBtn, "success");
          onSuccess?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          errorEl.textContent = err.message;
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Nombre"),
      nameField,
      h("p", { class: "field-label" }, "Correo"),
      emailField,
      h("p", { class: "field-label" }, "Contraseña"),
      passwordField,
      passwordRules.el,
      errorEl,
      submitBtn,
      switchBtn,
    ]
  );

  applyMode();

  return h("div", { class: "auth-screen" }, [
    h("div", { class: "auth-card glass-strong glass-in" }, [
      h("div", { class: "auth-brand" }, [h("span", {}, "bolsillo"), h("span", { class: "sidebar__brand-dot" }, ".")]),
      h("p", { class: "auth-tagline" }, "Simplicidad para tu bolsillo"),
      form,
    ]),
  ]);
}
