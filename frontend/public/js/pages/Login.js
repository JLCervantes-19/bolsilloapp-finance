import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { authService } from "../services/auth.js";
import { showToast } from "../components/Toast.js";
import { PasswordRules } from "../components/PasswordRules.js";
import { passwordMeetsPolicy } from "../utils/passwordPolicy.js";

export function renderLogin({ onSuccess }) {
  let mode = "login"; // login | signup | forgot

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
  const forgotBtn = h("button", { type: "button", class: "auth-switch" }, "¿Olvidaste tu contraseña?");
  const errorEl = h("p", { class: "auth-error" });
  const nameLabel = h("p", { class: "field-label", style: "display:none" }, "Nombre");
  const passwordLabel = h("p", { class: "field-label" }, "Contraseña");

  passwordField.addEventListener("input", () => passwordRules.update(passwordField.value));

  function applyMode() {
    nameLabel.style.display = mode === "signup" ? "block" : "none";
    nameField.style.display = mode === "signup" ? "block" : "none";
    if (mode !== "signup") nameField.value = ""; // que no quede pegado el nombre si se vuelve a "Crear cuenta"
    passwordRules.el.style.display = mode === "signup" ? "flex" : "none";
    passwordLabel.style.display = mode === "forgot" ? "none" : "block";
    passwordField.style.display = mode === "forgot" ? "none" : "block";
    passwordField.value = "";
    passwordRules.update("");
    passwordField.autocomplete = mode === "signup" ? "new-password" : "current-password";
    submitBtn.querySelector(".btn__label").textContent = mode === "signup" ? "Crear cuenta" : mode === "forgot" ? "Enviar link de recuperación" : "Entrar";
    switchBtn.style.display = mode === "forgot" ? "none" : "block";
    switchBtn.textContent = mode === "signup" ? "¿Ya tienes cuenta? Entrar" : "¿No tienes cuenta? Crear una";
    forgotBtn.textContent = mode === "forgot" ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?";
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

        if (mode === "signup" && !passwordMeetsPolicy(passwordField.value)) {
          errorEl.textContent = "Completá los requisitos de la contraseña marcados abajo.";
          passwordField.focus();
          return;
        }

        setButtonState(submitBtn, "loading");
        try {
          if (mode === "forgot") {
            await authService.requestPasswordReset(emailField.value);
            setButtonState(submitBtn, "success");
            showToast("Si el correo existe, te enviamos un link para restablecer tu contraseña.");
            mode = "login";
            applyMode();
            setButtonState(submitBtn, null);
            return;
          }
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
      nameLabel,
      nameField,
      h("p", { class: "field-label" }, "Correo"),
      emailField,
      passwordLabel,
      passwordField,
      passwordRules.el,
      errorEl,
      submitBtn,
      forgotBtn,
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
