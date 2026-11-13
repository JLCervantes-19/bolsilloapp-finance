import { h, clear } from "../utils/dom.js";
import { Chip } from "./Chip.js";
import { AmountField, shakeField } from "./AmountField.js";
import { Button, setButtonState } from "./Button.js";
import { showToast } from "./Toast.js";
import { confirmAction } from "./Confirm.js";
import { financialService } from "../services/financialService.js";
import { pockets, KIND_LABEL } from "../services/pocketState.js";
import { fmtMoney } from "../utils/formatters.js";

export const POCKET_COLORS = ["#3b7bf6", "#0ea894", "#e8734f", "#4a4fd0", "#c98a1c", "#e8543f", "#16a672", "#9b5de5"];
const POCKET_ICONS = ["👛", "👤", "🏪", "📱", "💍", "☕", "🚚", "🛠️", "🎨", "💼", "🏠", "🐾"];
const CURRENCIES = ["COP", "USD", "EUR", "MXN"];

/**
 * Crear o editar un bolsillo. En edición: renombrar, color, ícono y moneda;
 * además archivar/desarchivar y eliminar (salvo el personal predeterminado).
 * El tipo solo se elige al crear.
 */
export function PocketForm({ pocket = null, onDone }) {
  const editing = Boolean(pocket);
  const state = {
    name: pocket?.name || "",
    kind: pocket?.kind || "business",
    color: pocket?.color || POCKET_COLORS[1],
    icon: pocket?.icon || "🏪",
    currency: pocket?.currency || "COP",
    initial: "",
  };

  const nameInput = h("input", {
    type: "text",
    class: "text-field",
    placeholder: "Ej. Venta de teléfonos",
    maxLength: 60,
    value: state.name,
    onInput: (e) => (state.name = e.target.value),
  });
  const kindRow = h("div", { class: "flex gap-2 mb-4" });
  const colorRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const iconRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const currencyRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const initialField = AmountField({ onChange: (v) => (state.initial = v) });
  initialField.placeholder = "0 (opcional)";

  function renderKind() {
    clear(kindRow);
    kindRow.append(
      Chip({ label: "Negocio", color: "var(--ink)", pressed: state.kind === "business", onClick: () => ((state.kind = "business"), renderKind()) }),
      Chip({ label: "Personal", color: "var(--ink)", pressed: state.kind === "personal", onClick: () => ((state.kind = "personal"), renderKind()) })
    );
  }

  function renderColors() {
    clear(colorRow);
    colorRow.append(
      ...POCKET_COLORS.map((c) =>
        h("button", {
          type: "button",
          class: `swatch${c === state.color ? " swatch--active" : ""}`,
          style: `background:${c}`,
          "aria-label": `Color ${c}`,
          "aria-pressed": String(c === state.color),
          onClick: () => ((state.color = c), renderColors()),
        })
      )
    );
  }

  function renderIcons() {
    clear(iconRow);
    iconRow.append(
      ...POCKET_ICONS.map((i) =>
        h("button", {
          type: "button",
          class: `emoji-pick${i === state.icon ? " emoji-pick--active" : ""}`,
          "aria-label": `Ícono ${i}`,
          "aria-pressed": String(i === state.icon),
          onClick: () => ((state.icon = i), renderIcons()),
        }, i)
      )
    );
  }

  function renderCurrency() {
    clear(currencyRow);
    currencyRow.append(...CURRENCIES.map((c) => Chip({ label: c, color: "var(--ink)", pressed: state.currency === c, onClick: () => ((state.currency = c), renderCurrency()) })));
  }

  const submitBtn = Button({ label: editing ? "Guardar cambios" : "Crear bolsillo", fullWidth: true, type: "submit" });

  const extra = [];
  if (editing && !pocket.is_default) {
    const archiveBtn = Button({
      label: pocket.archived_at ? "Desarchivar" : "Archivar",
      variant: "secondary",
      onClick: async () => {
        const archiving = !pocket.archived_at;
        if (archiving) {
          const ok = await confirmAction({
            title: `¿Archivar "${pocket.name}"?`,
            message: "Sus movimientos y su saldo se conservan y siguen sumando en el consolidado, pero no vas a poder registrar movimientos nuevos hasta desarchivarlo.",
            confirmLabel: "Archivar",
          });
          if (!ok) return;
        }
        try {
          await financialService.updatePocket(pocket.id, { archived: archiving });
          showToast(archiving ? "Bolsillo archivado" : "Bolsillo desarchivado");
          onDone?.({ changed: true });
        } catch (err) {
          showToast(err.message || "No se pudo actualizar");
        }
      },
    });
    const deleteBtn = Button({ label: "Eliminar", variant: "danger", onClick: () => deletePocketFlow(pocket, onDone) });
    extra.push(h("div", { class: "flex gap-2", style: "margin-top:var(--space-3)" }, [archiveBtn, deleteBtn]));
  }
  if (editing && pocket.is_default) {
    extra.push(h("p", { class: "form-note" }, "Este es tu bolsillo personal principal: se puede renombrar y cambiar de color o ícono, pero no archivar ni eliminar."));
  }

  const form = h(
    "form",
    {
      novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        const name = state.name.trim();
        if (!name) {
          shakeField(nameInput);
          nameInput.focus();
          return;
        }
        const initial = state.initial === "" ? 0 : Number(state.initial);
        if (!editing && (!Number.isFinite(initial) || initial < 0)) {
          shakeField(initialField);
          return;
        }
        setButtonState(submitBtn, "loading");
        try {
          if (editing) {
            await financialService.updatePocket(pocket.id, { name, color: state.color, icon: state.icon, currency: state.currency });
            showToast("Bolsillo actualizado");
            onDone?.({ changed: true });
          } else {
            const created = await financialService.createPocket({
              name,
              kind: state.kind,
              color: state.color,
              icon: state.icon,
              currency: state.currency,
              initial_balance: initial,
            });
            showToast(`Bolsillo "${created.name}" creado`);
            onDone?.({ changed: true, created });
          }
        } catch (err) {
          setButtonState(submitBtn, "error");
          showToast(err.message || "No se pudo guardar");
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Nombre"),
      h("div", { class: "mb-4" }, [nameInput]),
      editing ? h("p", { class: "form-note", style: "margin-top:0" }, `Tipo: ${KIND_LABEL[pocket.kind]}`) : h("p", { class: "field-label" }, "Tipo"),
      editing ? null : kindRow,
      h("p", { class: "field-label" }, "Color"),
      colorRow,
      h("p", { class: "field-label" }, "Ícono"),
      iconRow,
      h("p", { class: "field-label" }, "Moneda"),
      currencyRow,
      editing ? null : h("p", { class: "field-label" }, "Saldo inicial"),
      editing ? null : h("div", { class: "mb-2" }, [initialField]),
      editing ? null : h("p", { class: "form-note" }, "El dinero con el que arranca esta caja. En un negocio cuenta como capital invertido."),
      h("div", { style: "margin-top:var(--space-4)" }, [submitBtn]),
      ...extra,
    ]
  );

  renderKind();
  renderColors();
  renderIcons();
  renderCurrency();
  return form;
}

/**
 * Eliminar sin perder datos en silencio: si tiene movimientos, se ofrece
 * moverlos a otro bolsillo del mismo tipo; borrarlos exige una segunda
 * confirmación explícita.
 */
async function deletePocketFlow(pocket, onDone) {
  const destinos = pockets().filter((p) => p.id !== pocket.id && p.kind === pocket.kind && !p.archived_at);
  const m = pocket.metrics || {};
  const tieneMovimientos = (m.ingresos || 0) + (m.gastos || 0) + (m.entradas || 0) + (m.salidas || 0) > 0;

  if (!tieneMovimientos) {
    const ok = await confirmAction({
      title: `¿Eliminar "${pocket.name}"?`,
      message: "No tiene movimientos registrados. Se borra junto con sus categorías.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    return runDelete(pocket, {}, onDone);
  }

  const choice = await chooseDeleteMode(pocket, destinos);
  if (!choice) return;
  if (choice.borrar_movimientos) {
    const sure = await confirmAction({
      title: "¿Borrar todos sus movimientos?",
      message: `Se eliminan para siempre los ingresos, gastos y transferencias de "${pocket.name}". Los saldos de los bolsillos con los que tuvo transferencias cambian. No se puede deshacer.`,
      confirmLabel: "Sí, borrar todo",
      danger: true,
    });
    if (!sure) return;
  }
  return runDelete(pocket, choice, onDone);
}

async function runDelete(pocket, payload, onDone) {
  try {
    await financialService.deletePocket(pocket.id, payload);
    showToast(payload.destino ? "Movimientos movidos y bolsillo eliminado" : "Bolsillo eliminado");
    onDone?.({ changed: true, deleted: pocket.id });
  } catch (err) {
    showToast(err.message || "No se pudo eliminar");
  }
}

/** Diálogo propio (no confirmAction) porque necesita elegir el destino. */
function chooseDeleteMode(pocket, destinos) {
  return new Promise((resolve) => {
    let overlay;
    let destino = destinos[0]?.id || null;
    const close = (result) => {
      overlay.classList.remove("confirm-overlay--open");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };
    const list = h("div", { class: "flex flex-col gap-2", style: "margin:var(--space-3) 0" });
    function renderList() {
      clear(list);
      if (!destinos.length) {
        list.append(h("p", { class: "confirm-card__message" }, `No tenés otro bolsillo de tipo ${KIND_LABEL[pocket.kind].toLowerCase()} activo para recibirlos. Creá uno o elegí borrarlos.`));
        return;
      }
      list.append(
        ...destinos.map((d) =>
          h("button", {
            type: "button",
            class: `pocket-choice${destino === d.id ? " pocket-choice--active" : ""}`,
            style: `--pc:${d.color}`,
            onClick: () => ((destino = d.id), renderList()),
          }, [h("span", {}, `${d.icon} ${d.name}`), h("span", { class: "pocket-choice__meta" }, fmtMoney(d.metrics?.saldo, d.currency))])
        )
      );
    }
    renderList();

    const moveBtn = Button({ label: "Mover y eliminar", onClick: () => destino && close({ destino }), disabled: !destinos.length });
    const wipeBtn = Button({ label: "Borrar movimientos", variant: "danger", onClick: () => close({ borrar_movimientos: true }) });
    const cancelBtn = Button({ label: "Cancelar", variant: "ghost", onClick: () => close(null) });

    const card = h("div", { class: "confirm-card glass-strong glass-in", style: "max-width:380px" }, [
      h("h3", { class: "confirm-card__title" }, `¿Eliminar "${pocket.name}"?`),
      h("p", { class: "confirm-card__message" }, "Tiene movimientos registrados. Elegí a qué bolsillo pasarlos (con sus categorías y su saldo) antes de eliminarlo:"),
      list,
      h("div", { class: "flex flex-wrap gap-2", style: "justify-content:flex-end" }, [cancelBtn, wipeBtn, moveBtn]),
    ]);
    overlay = h("div", { class: "confirm-overlay", onClick: (e) => (e.target === overlay ? close(null) : null) }, [card]);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("confirm-overlay--open"));
  });
}
