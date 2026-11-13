import { h } from "../utils/dom.js";
import { Pill } from "./Pill.js";
import { IconButton } from "./IconButton.js";
import { confirmAction } from "./Confirm.js";
import { authService } from "../services/auth.js";
import { navigate } from "../router.js";
import { showToast } from "./Toast.js";

async function handleLogoutClick() {
  const ok = await confirmAction({
    title: "¿Cerrar sesión?",
    message: "Vas a salir de tu cuenta de Bolsillo.",
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
    await authService.deleteAccount();
    showToast("Tu cuenta fue eliminada.");
    navigate("/login");
  } catch (err) {
    showToast(err.message);
  }
}

export function PageHeader({ eyebrow, title, pillLabel, onBellClick }) {
  return h("header", { class: "page-header" }, [
    h("div", {}, [h("p", { class: "page-header__eyebrow" }, eyebrow), h("h1", { class: "page-header__title" }, title)]),
    h("div", { class: "flex items-center gap-3" }, [
      pillLabel ? Pill({ label: pillLabel }) : null,
      IconButton({ iconName: "bell", dot: true, onClick: onBellClick, ariaLabel: "Notificaciones" }),
      IconButton({ iconName: "user", onClick: handleDeleteAccountClick, ariaLabel: "Eliminar cuenta" }),
      IconButton({ iconName: "x", onClick: handleLogoutClick, ariaLabel: "Cerrar sesión" }),
    ]),
  ]);
}
