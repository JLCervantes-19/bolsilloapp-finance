import { h, clear } from "../utils/dom.js";
import { Button, setButtonState } from "./Button.js";
import { openDialog } from "./Confirm.js";
import { USERNAME_HINT, usernameError } from "../utils/usernamePolicy.js";

/**
 * Diálogos de cuenta sin correo. Se montan en <body> como Confirm.js, pero
 * NO se cierran tocando afuera: el código de recuperación se muestra una
 * sola vez y el usuario tiene que confirmar que lo guardó.
 */
function downloadCode(code, username) {
  const text = [
    "One Million — Código de recuperación",
    "",
    username ? `Usuario: ${username}` : null,
    `Código: ${code}`,
    "",
    "Guardalo en un lugar seguro. Es la única forma de recuperar tu cuenta",
    "si olvidás la contraseña. Cada vez que lo uses vas a recibir uno nuevo.",
    "",
    "https://onemillionapp.vercel.app",
  ]
    .filter((l) => l !== null)
    .join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = h("a", { href: url, download: "one-million-codigo-recuperacion.txt" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Feedback dentro del botón (un toast quedaría detrás del velo del diálogo). */
function flashLabel(btn, text) {
  const label = btn.querySelector(".btn__label");
  const original = label.dataset.original || label.textContent;
  label.dataset.original = original;
  label.textContent = text;
  clearTimeout(btn._flashT);
  btn._flashT = setTimeout(() => (label.textContent = original), 1800);
}

/** Muestra el código y espera a que el usuario confirme que lo guardó. */
export function showRecoveryCode(code, { username } = {}) {
  return new Promise((resolve) => {
    let close;
    const check = h("input", { type: "checkbox", id: "recovery-saved" });
    const continueBtn = Button({
      label: "Continuar",
      fullWidth: true,
      disabled: true,
      onClick: () => {
        close();
        resolve();
      },
    });
    check.addEventListener("change", () => (continueBtn.disabled = !check.checked));

    const saveBtn = Button({
      label: "Guardar código",
      iconName: "download",
      fullWidth: true,
      onClick: () => {
        downloadCode(code, username);
        flashLabel(saveBtn, "¡Descargado!");
      },
    });
    const copyBtn = Button({
      label: "Copiar",
      variant: "secondary",
      fullWidth: true,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(code);
          flashLabel(copyBtn, "¡Copiado!");
        } catch {
          flashLabel(copyBtn, "Anotalo a mano");
        }
      },
    });

    const card = h("div", { class: "confirm-card recovery-card glass-strong glass-in", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "recovery-title", "aria-describedby": "recovery-alert" }, [
      h("h3", { class: "confirm-card__title", id: "recovery-title" }, "Guardá tu código de recuperación"),
      h("p", { class: "recovery-card__alert", id: "recovery-alert" }, [
        h("strong", {}, "Importante: "),
        "es la única forma de recuperar tu cuenta si olvidás la contraseña. No lo vamos a volver a mostrar.",
      ]),
      username ? h("p", { class: "confirm-card__message" }, ["Usuario: ", h("strong", {}, username)]) : null,
      h("p", { class: "recovery-card__code", "aria-label": `Código ${code}` }, code),
      h("div", { class: "recovery-card__actions" }, [saveBtn, copyBtn]),
      h("label", { for: "recovery-saved", class: "recovery-card__check" }, [check, h("span", {}, "Ya guardé mi código en un lugar seguro")]),
      continueBtn,
    ]);
    close = openDialog(card);
    setTimeout(() => saveBtn.focus(), 50);
  });
}

/**
 * Formulario de un campo dentro de un diálogo. `onSubmit(value)` devuelve
 * el resultado o lanza un error que se muestra en el diálogo.
 */
function promptDialog({ title, message, hint, field, submitLabel, exit, validate, onSubmit }) {
  return new Promise((resolve) => {
    let close;
    const errorEl = h("p", { class: "auth-error" });
    const submitBtn = Button({ label: submitLabel, type: "submit", fullWidth: true });
    // Salida del diálogo (Cancelar, o Cerrar sesión en el obligatorio): resuelve null.
    const exitBtn = Button({
      label: exit.label,
      variant: "ghost",
      fullWidth: true,
      onClick: () => {
        close();
        resolve(null);
        exit.onClick?.();
      },
    });
    const input = h("input", { class: "text-field", required: true, ...field });

    const form = h(
      "form",
      {
        class: "auth-form",
        onSubmit: async (e) => {
          e.preventDefault();
          clear(errorEl);
          const invalid = validate?.(input.value);
          if (invalid) {
            errorEl.textContent = invalid;
            return input.focus();
          }
          setButtonState(submitBtn, "loading");
          try {
            const result = await onSubmit(input.value);
            close();
            resolve(result);
          } catch (err) {
            // Sesión vencida: api.js ya mandó al login, el diálogo no debe quedar encima.
            if (err.status === 401) {
              close();
              return resolve(null);
            }
            setButtonState(submitBtn, null);
            errorEl.textContent = err.message;
          }
        },
      },
      [input, hint ? h("p", { class: "auth-hint" }, hint) : null, errorEl, submitBtn, exitBtn]
    );

    const card = h("div", { class: "confirm-card glass-strong glass-in", role: "dialog", "aria-modal": "true", "aria-label": title }, [
      h("h3", { class: "confirm-card__title" }, title),
      h("p", { class: "confirm-card__message", style: "margin-bottom:var(--space-4)" }, message),
      form,
    ]);
    close = openDialog(card);
    setTimeout(() => input.focus(), 50);
  });
}

/**
 * Cuentas antiguas (con correo): elegir usuario. Devuelve lo que devuelva
 * onSubmit, o null si cerró sesión o la sesión venció.
 */
export function promptUsername(onSubmit, { onLogout } = {}) {
  return promptDialog({
    title: "Elegí tu nombre de usuario",
    message: "One Million ya no usa correos. Desde ahora vas a entrar con este usuario y tu misma contraseña.",
    hint: USERNAME_HINT,
    field: { type: "text", placeholder: "tu_usuario", autocomplete: "username", autocapitalize: "none", spellcheck: "false", maxLength: 30 },
    submitLabel: "Guardar usuario",
    exit: { label: "Cerrar sesión", onClick: onLogout },
    validate: usernameError,
    onSubmit,
  });
}

/** Pide la contraseña actual (para generar un código nuevo). null si cancela. */
export function promptPassword(onSubmit) {
  return promptDialog({
    title: "Nuevo código de recuperación",
    message: "Escribí tu contraseña. El código anterior va a dejar de funcionar.",
    field: { type: "password", placeholder: "Tu contraseña", autocomplete: "current-password" },
    submitLabel: "Generar código",
    exit: { label: "Cancelar" },
    onSubmit,
  });
}
