import { h } from "../utils/dom.js";
import { Pill } from "./Pill.js";
import { IconButton } from "./IconButton.js";
import { confirmAction } from "./Confirm.js";
import { authService } from "../services/auth.js";
import { navigate } from "../router.js";

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

export function PageHeader({ eyebrow, title, pillLabel, onBellClick }) {
  return h("header", { class: "page-header" }, [
    h("div", {}, [h("p", { class: "page-header__eyebrow" }, eyebrow), h("h1", { class: "page-header__title" }, title)]),
    h("div", { class: "flex items-center gap-3" }, [
      pillLabel ? Pill({ label: pillLabel }) : null,
      IconButton({ iconName: "bell", dot: true, onClick: onBellClick, ariaLabel: "Notificaciones" }),
      IconButton({ iconName: "x", onClick: handleLogoutClick, ariaLabel: "Cerrar sesión" }),
    ]),
  ]);
}
