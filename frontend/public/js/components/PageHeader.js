import { h } from "../utils/dom.js";
import { Pill } from "./Pill.js";
import { IconButton } from "./IconButton.js";
import { confirmAction } from "./Confirm.js";
import { authService } from "../services/auth.js";
import { api } from "../services/api.js";
import { navigate } from "../router.js";
import { showToast } from "./Toast.js";
import { Button } from "./Button.js";
import { promptPassword, showRecoveryCode } from "./RecoveryCode.js";
import { openDialog } from "./Confirm.js";

async function handleLogoutClick() {
  const ok = await confirmAction({
    title: "¿Cerrar sesión?",
    message: "Vas a salir de tu cuenta de One Million.",
    confirmLabel: "Cerrar sesión",
    danger: true,
  });
  if (!ok) return;
  await authService.logout();
  navigate("/login");
}

async function handleDeleteAccountClick() {
  const ok = await confirmAction({
    title: "¿Eliminar tu cuenta?",
    message: "Se borran para siempre tus ingresos, gastos, deudas, metas e historial. No se puede deshacer.",
    confirmLabel: "Eliminar cuenta",
    danger: true,
  });
  if (!ok) return;
  const sure = await confirmAction({
    title: "Confirmá de nuevo",
    message: "Última confirmación: tu cuenta y todos tus datos se eliminarán ahora.",
    confirmLabel: "Sí, eliminar todo",
    danger: true,
  });
  if (!sure) return;
  try {
    await api.delete("/auth/account");
    authService.clearSession();
    showToast("Tu cuenta fue eliminada.");
    navigate("/login");
  } catch (err) {
    showToast(err.message);
  }
}

async function handleNewRecoveryCode() {
  const result = await promptPassword((password) => api.post("/auth/recovery-code", { password }));
  if (!result) return;
  await showRecoveryCode(result.recovery_code, { username: authService.username() });
}

/** Menú "Tu cuenta": código de recuperación y eliminar cuenta. */
function handleAccountClick() {
  const username = authService.username();
  let close;
  const then = (fn) => () => (close(), fn());
  const card = h("div", { class: "confirm-card glass-strong glass-in" }, [
    h("h3", { class: "confirm-card__title" }, "Tu cuenta"),
    username ? h("p", { class: "confirm-card__message", style: "margin-bottom:var(--space-4)" }, ["Usuario: ", h("strong", {}, username)]) : null,
    h("div", { class: "flex", style: "flex-direction:column;gap:var(--space-2)" }, [
      Button({ label: "Nuevo código de recuperación", variant: "secondary", fullWidth: true, onClick: then(handleNewRecoveryCode) }),
      Button({ label: "Eliminar cuenta", variant: "danger", fullWidth: true, onClick: then(handleDeleteAccountClick) }),
      Button({ label: "Cerrar", variant: "ghost", fullWidth: true, onClick: close }),
    ]),
  ]);
  close = openDialog(card, { dismissable: true, onDismiss: () => close() });
}

export function PageHeader({ eyebrow, title, pillLabel, onBellClick }) {
  // El mes va dos veces: junto al título en celular y en la barra de acciones
  // en escritorio; el CSS muestra solo una según el ancho.
  return h("header", { class: "page-header" }, [
    h("div", { class: "page-header__text" }, [
      h("p", { class: "page-header__eyebrow" }, eyebrow),
      h("h1", { class: "page-header__title" }, title),
      pillLabel ? h("p", { class: "page-header__period" }, pillLabel) : null,
    ]),
    h("div", { class: "page-header__actions" }, [
      pillLabel ? Pill({ label: pillLabel }) : null,
      h("div", { class: "page-header__tools glass" }, [
        IconButton({ iconName: "bell", dot: true, onClick: onBellClick, ariaLabel: "Notificaciones" }),
        IconButton({ iconName: "user", onClick: handleAccountClick, ariaLabel: "Tu cuenta" }),
        IconButton({ iconName: "x", onClick: handleLogoutClick, ariaLabel: "Cerrar sesión" }),
      ]),
    ]),
  ]);
}
