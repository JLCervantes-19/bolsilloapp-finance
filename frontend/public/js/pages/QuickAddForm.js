import { h, clear } from "../utils/dom.js";
import { Chip } from "../components/Chip.js";
import { AmountField, shakeField } from "../components/AmountField.js";
import { Button, setButtonState } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { confirmAction } from "../components/Confirm.js";
import { financialService } from "../services/financialService.js";
import { activePockets, findPocket, PAYMENT_METHODS } from "../services/pocketState.js";
import { fmtMoney, todayISO } from "../utils/formatters.js";

const MAX_CUSTOM_CATEGORIES = 3;
const CATEGORY_COLORS = ["#ff9466", "#2A9D8F", "#E76F51", "#4a4fd0", "#81B29A", "#c98a1c"];

// Tipos de movimiento por tipo de bolsillo. Ingreso/gasto van a sus tablas;
// inversión, retiro y traslado son transferencias (nunca suman como ingreso
// ni gasto en el consolidado).
const MODES = {
  expense: { label: (k) => (k === "business" ? "Egreso" : "Gasto"), color: "var(--negative)" },
  income: { label: (k) => (k === "business" ? "Ingreso / venta" : "Ingreso"), color: "var(--positive)" },
  aporte: { label: () => "Inversión", color: "var(--positive-2)" },
  retiro: { label: () => "Retiro", color: "var(--warning)" },
  traslado: { label: () => "Traslado", color: "var(--brand-accent)" },
};
const MODES_BY_KIND = {
  personal: ["expense", "income", "traslado"],
  business: ["income", "expense", "aporte", "retiro", "traslado"],
};
const EXTERNAL = "externo";

const categoryCache = new Map();
async function categoriesFor(pocketId) {
  if (!categoryCache.has(pocketId)) categoryCache.set(pocketId, await financialService.listCategories(pocketId));
  return categoryCache.get(pocketId);
}
export function clearCategoryCache() {
  categoryCache.clear();
}

/**
 * Bottom sheet "Agregar movimiento". Abre preseleccionado en el bolsillo
 * activo y en el tipo de la pestaña actual (en Inversión abre como
 * inversión). Conserva el flujo previo: confirmación antes de guardar,
 * categorías personalizadas (hasta 3 por bolsillo) y asignación automática
 * a fondo de emergencia (10%) / inversión (5%) en el bolsillo personal
 * predeterminado.
 */
export function QuickAddForm({ pocketId, mode = "expense", onDone }) {
  const startPocket = findPocket(pocketId) || activePockets()[0];
  const state = {
    pocketId: startPocket?.id,
    mode: MODES_BY_KIND[startPocket?.kind || "personal"].includes(mode) ? mode : MODES_BY_KIND[startPocket?.kind || "personal"][0],
    categories: [],
    categoryId: null,
    amount: "",
    description: "",
    date: todayISO(),
    method: "",
    counterpart: null, // origen de la inversión, destino del retiro o del traslado
    allocFund: true,
    allocInvest: true,
    creatingCategory: false,
    newCategoryName: "",
    newCategoryColor: CATEGORY_COLORS[0],
  };

  const pocket = () => findPocket(state.pocketId);
  const isTransfer = () => ["aporte", "retiro", "traslado"].includes(state.mode);

  const pocketRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const modeRow = h("section", { class: "flex flex-wrap gap-2 mb-4" });
  const categorySection = h("div");
  const counterpartSection = h("div");
  const amountField = AmountField({ onChange: (v) => (state.amount = v) });
  const methodRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const descInput = h("input", {
    type: "text",
    class: "text-field",
    placeholder: "Descripción o nota (opcional)",
    maxLength: 280,
    onInput: (e) => (state.description = e.target.value),
  });
  const dateInput = h("input", { type: "date", class: "text-field", value: state.date, max: todayISO(), onInput: (e) => (state.date = e.target.value) });
  const allocSection = h("div", { class: "mb-5" });
  const submitBtn = Button({ label: "Agregar", fullWidth: true, type: "submit" });

  function counterpartOptions() {
    const others = activePockets().filter((x) => x.id !== state.pocketId);
    if (state.mode === "aporte") return [{ id: EXTERNAL, label: "Dinero externo" }, ...others.filter((x) => x.kind === "personal").map(asOption)];
    if (state.mode === "retiro") return [...others.filter((x) => x.kind === "personal").map(asOption), { id: EXTERNAL, label: "No registrarlo en un bolsillo" }];
    if (state.mode === "traslado") return others.map(asOption);
    return [];
  }
  const asOption = (x) => ({ id: x.id, label: `${x.icon} ${x.name}`, color: x.color });

  function defaultCounterpart() {
    const opts = counterpartOptions();
    if (state.mode === "aporte" || state.mode === "retiro") {
      // Por defecto el dinero sale de / va al bolsillo personal principal: así
      // queda como transferencia enlazada y el consolidado no lo duplica.
      return (opts.find((o) => findPocket(o.id)?.is_default) || opts[0])?.id || null;
    }
    return opts[0]?.id || null;
  }

  function renderPockets() {
    clear(pocketRow);
    const list = activePockets();
    if (list.length < 2) return;
    pocketRow.append(
      ...list.map((p) =>
        Chip({ label: `${p.icon} ${p.name}`, color: p.color, pressed: p.id === state.pocketId, onClick: () => setPocket(p.id) })
      )
    );
  }

  function renderModes() {
    clear(modeRow);
    const kind = pocket()?.kind || "personal";
    modeRow.append(
      ...MODES_BY_KIND[kind].map((m) =>
        Chip({ label: MODES[m].label(kind), color: MODES[m].color, pressed: state.mode === m, onClick: () => setMode(m) })
      )
    );
    const labels = { expense: "Agregar " + MODES.expense.label(kind).toLowerCase(), income: "Agregar ingreso", aporte: "Registrar inversión", retiro: "Registrar retiro", traslado: "Trasladar" };
    submitBtn.querySelector(".btn__label").textContent = labels[state.mode];
  }

  function renderCategories() {
    clear(categorySection);
    if (isTransfer()) return;
    const kind = state.mode;
    const list = state.categories.filter((c) => c.kind === kind);
    const row = h("div", { class: "flex flex-wrap gap-2 mb-4" });
    row.append(
      ...list.map((c) => {
        const chip = Chip({ label: c.name, color: c.color, pressed: c.id === state.categoryId, onClick: () => ((state.categoryId = c.id), renderCategories()) });
        if (c.is_default) return chip;
        return h("div", { class: "flex items-center gap-1" }, [
          chip,
          h("button", {
            type: "button",
            class: "chip-remove",
            "aria-label": `Eliminar categoría ${c.name}`,
            title: "Eliminar categoría",
            onClick: () => removeCategory(c),
          }, "×"),
        ]);
      })
    );
    const customCount = state.categories.filter((c) => !c.is_default).length;
    if (!state.creatingCategory && customCount < MAX_CUSTOM_CATEGORIES) {
      row.append(Chip({ label: "+ Nueva", color: "var(--brand-accent)", onClick: () => ((state.creatingCategory = true), (state.newCategoryName = ""), renderCategories()) }));
    }
    categorySection.append(h("p", { class: "field-label" }, "Categoría"), row);
    if (state.creatingCategory) categorySection.append(newCategoryPanel());
  }

  async function removeCategory(c) {
    const ok = await confirmAction({
      title: `¿Eliminar "${c.name}"?`,
      message: "Los movimientos ya registrados con esta categoría no se borrarán, solo dejará de poder usarse en nuevos movimientos.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await financialService.deleteCategory(c.id);
      state.categories = state.categories.filter((x) => x.id !== c.id);
      categoryCache.set(state.pocketId, state.categories);
      if (state.categoryId === c.id) state.categoryId = state.categories.find((x) => x.kind === state.mode)?.id || null;
      renderCategories();
      showToast(`Categoría "${c.name}" eliminada`);
    } catch (err) {
      showToast(err.message || "No se pudo eliminar la categoría");
    }
  }

  function newCategoryPanel() {
    const nameInput = h("input", {
      type: "text",
      placeholder: "Nombre de la nueva categoría",
      class: "text-field",
      maxLength: 60,
      value: state.newCategoryName,
      onInput: (e) => (state.newCategoryName = e.target.value),
    });
    const swatches = h(
      "div",
      { class: "flex gap-2", style: "margin:10px 0" },
      CATEGORY_COLORS.map((color) =>
        h("button", {
          type: "button",
          class: `swatch swatch--sm${color === state.newCategoryColor ? " swatch--active" : ""}`,
          "aria-label": `Color ${color}`,
          style: `background:${color}`,
          onClick: () => ((state.newCategoryColor = color), renderCategories()),
        })
      )
    );
    const saveBtn = Button({
      label: "Guardar categoría",
      variant: "secondary",
      onClick: async () => {
        const name = state.newCategoryName.trim();
        if (!name) return shakeField(nameInput);
        const ok = await confirmAction({
          title: "¿Crear esta categoría?",
          message: `"${name}" quedará disponible para clasificar tus ${state.mode === "expense" ? "gastos" : "ingresos"} en ${pocket()?.name || "este bolsillo"}.`,
          confirmLabel: "Crear",
        });
        if (!ok) return;
        setButtonState(saveBtn, "loading");
        try {
          const created = await financialService.createCategory({ bolsillo_id: state.pocketId, name, color: state.newCategoryColor, kind: state.mode });
          state.categories = [...state.categories, created];
          categoryCache.set(state.pocketId, state.categories);
          state.categoryId = created.id;
          state.creatingCategory = false;
          renderCategories();
          showToast(`Categoría "${created.name}" creada`);
        } catch (err) {
          setButtonState(saveBtn, null);
          showToast(err.message || "No se pudo crear la categoría");
        }
      },
    });
    const cancelBtn = Button({ label: "Cancelar", variant: "ghost", onClick: () => ((state.creatingCategory = false), renderCategories()) });
    return h("div", { class: "mb-4" }, [nameInput, swatches, h("div", { class: "flex gap-2" }, [saveBtn, cancelBtn])]);
  }

  function renderCounterpart() {
    clear(counterpartSection);
    if (!isTransfer()) return;
    const opts = counterpartOptions();
    const title = { aporte: "¿De dónde sale el dinero?", retiro: "¿A dónde va el retiro?", traslado: "Bolsillo de destino" }[state.mode];
    const note = {
      aporte: "Aumenta la caja y el capital invertido del negocio. No cuenta como venta ni como utilidad.",
      retiro: "Sale de la caja del negocio. No es un gasto ni resta de la utilidad. Si lo enviás a un bolsillo personal, entra ahí como transferencia enlazada.",
      traslado: "Mueve dinero entre tus bolsillos. No cuenta como ingreso ni como gasto.",
    }[state.mode];
    if (!opts.length) {
      counterpartSection.append(
        h("p", { class: "field-label" }, title),
        h("p", { class: "form-note mb-4" }, "Necesitás otro bolsillo activo para hacer un traslado. Creá uno desde el panel de bolsillos.")
      );
      return;
    }
    counterpartSection.append(
      h("p", { class: "field-label" }, title),
      h("div", { class: "flex flex-wrap gap-2 mb-2" }, opts.map((o) => Chip({ label: o.label, color: o.color || "var(--ink)", pressed: state.counterpart === o.id, onClick: () => ((state.counterpart = o.id), renderCounterpart()) }))),
      h("p", { class: "form-note mb-4" }, note)
    );
  }

  function renderMethods() {
    clear(methodRow);
    methodRow.append(
      ...PAYMENT_METHODS.map((m) => Chip({ label: m, color: "var(--ink)", pressed: state.method === m, onClick: () => ((state.method = state.method === m ? "" : m), renderMethods()) }))
    );
  }

  function renderAlloc() {
    clear(allocSection);
    if (state.mode !== "income" || !pocket()?.is_default) return;
    allocSection.append(
      h("p", { class: "field-label" }, "Asignación automática"),
      h("div", { class: "flex flex-wrap gap-2" }, [
        Chip({ label: "Fondo de emergencia · 10%", color: "var(--warning)", pressed: state.allocFund, onClick: () => ((state.allocFund = !state.allocFund), renderAlloc()) }),
        Chip({ label: "Inversión · 5%", color: "var(--positive-2)", pressed: state.allocInvest, onClick: () => ((state.allocInvest = !state.allocInvest), renderAlloc()) }),
      ])
    );
  }

  function renderAll() {
    renderPockets();
    renderModes();
    renderCategories();
    renderCounterpart();
    renderAlloc();
  }

  function setMode(m) {
    state.mode = m;
    state.categoryId = state.categories.find((c) => c.kind === m)?.id || null;
    state.creatingCategory = false;
    state.counterpart = defaultCounterpart();
    renderAll();
  }

  async function setPocket(id) {
    state.pocketId = id;
    const kind = pocket()?.kind || "personal";
    if (!MODES_BY_KIND[kind].includes(state.mode)) state.mode = MODES_BY_KIND[kind][0];
    form.style.setProperty("--pocket-color", pocket()?.color || "var(--brand-accent)");
    renderAll();
    try {
      state.categories = await categoriesFor(id);
    } catch {
      state.categories = [];
    }
    if (state.pocketId !== id) return; // el usuario cambió de bolsillo mientras cargaba
    setMode(state.mode);
  }

  async function submit() {
    const amount = parseFloat(state.amount);
    if (!amount || amount <= 0) return shakeField(amountField);
    if (!state.date || state.date > todayISO()) return shakeField(dateInput);
    const p = pocket();
    if (!p) return showToast("Elegí un bolsillo");
    if (state.mode === "traslado" && !state.counterpart) return showToast("Elegí el bolsillo de destino");

    const kindLabel = MODES[state.mode].label(p.kind);
    const cp = state.counterpart && state.counterpart !== EXTERNAL ? findPocket(state.counterpart) : null;
    const categoryName = state.categories.find((c) => c.id === state.categoryId)?.name;
    const detail = isTransfer()
      ? state.mode === "aporte"
        ? `${cp ? cp.icon + " " + cp.name : "Dinero externo"} → ${p.icon} ${p.name}`
        : `${p.icon} ${p.name} → ${cp ? cp.icon + " " + cp.name : "fuera de Bolsillo"}`
      : `${p.icon} ${p.name}${categoryName ? " · " + categoryName : ""}`;

    const ok = await confirmAction({ title: `¿Registrar ${kindLabel.toLowerCase()}?`, message: `${fmtMoney(amount, p.currency)} · ${detail}`, confirmLabel: "Registrar" });
    if (!ok) return;

    const common = { amount, date: state.date, description: state.description.trim() || undefined, payment_method: state.method || undefined };
    setButtonState(submitBtn, "loading");
    try {
      if (state.mode === "expense") {
        await financialService.quickExpense({ ...common, bolsillo_id: p.id, category_id: state.categoryId });
      } else if (state.mode === "income") {
        await financialService.quickIncome({
          ...common,
          bolsillo_id: p.id,
          category_id: state.categoryId,
          allocate_emergency_fund_pct: p.is_default && state.allocFund ? 10 : 0,
          allocate_investment_pct: p.is_default && state.allocInvest ? 5 : 0,
        });
      } else {
        const other = state.counterpart === EXTERNAL ? null : state.counterpart;
        await financialService.createTransfer({
          ...common,
          kind: state.mode,
          from_bolsillo_id: state.mode === "aporte" ? other : p.id,
          to_bolsillo_id: state.mode === "aporte" ? p.id : other,
        });
      }
      showToast(`${kindLabel} registrado: ${fmtMoney(amount, p.currency)}`);
      setButtonState(submitBtn, "success");
      onDone?.();
    } catch (err) {
      setButtonState(submitBtn, "error");
      showToast(err.message || "No se pudo guardar");
      setTimeout(() => setButtonState(submitBtn, null), 900);
    }
  }

  const form = h(
    "form",
    {
      class: "movement-form",
      novalidate: true,
      onSubmit: (e) => {
        e.preventDefault();
        if (!state.categoryId && !isTransfer() && state.categories.length === 0) return showToast("Cargando categorías…");
        submit();
      },
    },
    [
      activePockets().length > 1 ? h("p", { class: "field-label" }, "Bolsillo") : null,
      pocketRow,
      modeRow,
      categorySection,
      counterpartSection,
      h("p", { class: "field-label" }, "Monto"),
      h("div", { class: "mb-4" }, [amountField]),
      h("p", { class: "field-label" }, "Método de pago (opcional)"),
      methodRow,
      h("div", { class: "form-grid mb-4" }, [
        h("label", {}, [h("span", { class: "field-label" }, "Fecha"), dateInput]),
        h("label", {}, [h("span", { class: "field-label" }, "Nota"), descInput]),
      ]),
      allocSection,
      submitBtn,
    ]
  );

  renderMethods();
  if (state.pocketId) setPocket(state.pocketId);
  return form;
}
