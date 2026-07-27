import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { authService } from "../services/auth.js";
import { showToast } from "../components/Toast.js";

export function renderLogin({ onSuccess }) {
  let mode = "login"; // login | signup

  const nameField = h("input", { type: "text", class: "text-field", placeholder: "Tu nombre", style: "display:none" });
  const emailField = h("input", { type: "email", class: "text-field", placeholder: "tú@correo.com", required: true });
  const passwordField = h("input", { type: "password", class: "text-field", placeholder: "Mínimo 8 caracteres", required: true });
  const submitBtn = Button({ label: "Entrar", fullWidth: true, type: "submit" });
  const switchBtn = h("button", { type: "button", class: "auth-switch" }, "¿No tienes cuenta? Crear una");
  const errorEl = h("p", { class: "auth-error" });

  function applyMode() {
    nameField.style.display = mode === "signup" ? "block" : "none";
    submitBtn.querySelector(".btn__label").textContent = mode === "signup" ? "Crear cuenta" : "Entrar";
    switchBtn.textContent = mode === "signup" ? "¿Ya tienes cuenta? Entrar" : "¿No tienes cuenta? Crear una";
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
        setButtonState(submitBtn, "loading");
        try {
          if (mode === "signup") {
            const data = await authService.signup(emailField.value, passwordField.value, nameField.value);
            if (!data.session) {
              showToast("Cuenta creada — revisa tu correo para confirmar");
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
