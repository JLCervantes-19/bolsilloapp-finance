import { h, clear } from "../utils/dom.js";
import { Chip } from "../components/Chip.js";
import { AmountField, shakeField } from "../components/AmountField.js";
import { Button, setButtonState } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { confirmAction } from "../components/Confirm.js";
import { financialService } from "../services/financialService.js";
import { fmt, todayISO } from "../utils/formatters.js";

const MAX_CUSTOM_CATEGORIES = 3;
const CATEGORY_COLORS = ["#ff9466", "#2A9D8F", "#E76F51", "#4a4fd0", "#81B29A", "#c98a1c"];

/**
 * Contenido del bottom sheet "Agregar gasto/ingreso rápido" — port del
 * flujo submitSheet() del prototipo, incluida la asignación automática a
 * fondo de emergencia (10%) / inversión (5%) cuando el modo es ingreso.
 */
export function QuickAddForm({ categories, onDone }) {
  const state = {
    mode: "expense",
    categoryId: categories.find((c) => c.kind === "expense")?.id || null,
    amount: "",
    allocFund: true,
    allocInvest: true,
    creatingCategory: false,
    newCategoryName: "",
    newCategoryColor: CATEGORY_COLORS[0],
  };

  const modeRow = h("section", { class: "flex gap-2 mb-4" });
  const categoryLabel = h("p", { class: "field-label" }, "Categoría");
  const categoryRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const newCategoryPanel = h("div", { class: "mb-4" });
  const amountLabel = h("p", { class: "field-label" }, "Monto");
  const amountField = AmountField({ onChange: (v) => (state.amount = v) });
  const allocSection = h("div", { class: "mb-5" });
  const submitBtn = Button({ label: "Agregar gasto", fullWidth: true, type: "submit" });

  const customCategoryCount = () => categories.filter((c) => !c.is_default).length;

  function renderModeRow() {
    clear(modeRow);
    modeRow.append(
      Chip({ label: "Gasto", color: "var(--negative)", pressed: state.mode === "expense", onClick: () => setMode("expense") }),
      Chip({ label: "Ingreso", color: "var(--positive)", pressed: state.mode === "income", onClick: () => setMode("income") })
    );
  }

  function renderCategoryRow() {
    clear(categoryRow);
    const list = categories.filter((c) => c.kind === state.mode);
    categoryRow.append(
      ...list.map((c) => {
        const chip = Chip({ label: c.name, color: c.color, pressed: c.id === state.categoryId, onClick: () => (state.categoryId = c.id, renderCategoryRow()) });
        if (c.is_default) return chip;

        // Categoría personalizada: se puede borrar. El botón va aparte del
        // Chip (no adentro) para no interferir con su onClick de selección.
        return h("div", { class: "flex items-center gap-1" }, [
          chip,
          h(
            "button",
            {
              type: "button",
              "aria-label": `Eliminar categoría ${c.name}`,
              title: "Eliminar categoría",
              style:
                "width:20px;height:20px;border-radius:50%;border:none;background:var(--surface-2,rgba(0,0,0,0.06));color:var(--text-tertiary);font-size:13px;line-height:1;cursor:pointer",
              onClick: async () => {
                const ok = await confirmAction({
                  title: `¿Eliminar "${c.name}"?`,
                  message: "Los movimientos ya registrados con esta categoría no se borrarán, solo dejará de poder usarse en nuevos movimientos.",
                  confirmLabel: "Eliminar",
                  danger: true,
                });
                if (!ok) return;
                try {
                  await financialService.deleteCategory(c.id);
                  const idx = categories.findIndex((cat) => cat.id === c.id);
                  if (idx !== -1) categories.splice(idx, 1);
                  if (state.categoryId === c.id) {
                    state.categoryId = categories.find((cat) => cat.kind === state.mode)?.id || null;
                  }
                  renderCategoryRow();
                  showToast(`Categoría "${c.name}" eliminada`);
                } catch (err) {
                  showToast(err.message || "No se pudo eliminar la categoría");
                }
              },
            },
            "×"
          ),
        ]);
      })
    );
    if (!state.creatingCategory && customCategoryCount() < MAX_CUSTOM_CATEGORIES) {
      categoryRow.append(
        Chip({
          label: "+ Nueva",
          color: "var(--brand-accent)",
          pressed: false,
          onClick: () => {
            state.creatingCategory = true;
            state.newCategoryName = "";
            state.newCategoryColor = CATEGORY_COLORS[0];
            renderCategoryRow();
            renderNewCategoryPanel();
          },
        })
      );
    }
  }

  function renderNewCategoryPanel() {
    clear(newCategoryPanel);
    if (!state.creatingCategory) return;

    const nameInput = h("input", {
      type: "text",
      placeholder: "Nombre de la nueva categoría",
      class: "amount-field glass",
      style: "font-size:15px;padding:10px 14px;height:auto;width:100%",
      value: state.newCategoryName,
      onInput: (e) => (state.newCategoryName = e.target.value),
    });

    const swatches = h(
      "div",
      { class: "flex gap-2", style: "margin:10px 0" },
      CATEGORY_COLORS.map((color) =>
        h("button", {
          type: "button",
          "aria-label": `Color ${color}`,
          style: `width:24px;height:24px;border-radius:50%;background:${color};cursor:pointer;border:2px solid ${
            color === state.newCategoryColor ? "var(--text-primary)" : "transparent"
          }`,
          onClick: () => {
            state.newCategoryColor = color;
            renderNewCategoryPanel();
          },
        })
      )
    );

    const saveBtn = Button({
      label: "Guardar categoría",
      variant: "secondary",
      onClick: async () => {
        const name = state.newCategoryName.trim();
        if (!name) {
          shakeField(nameInput);
          return;
        }
        const ok = await confirmAction({
          title: "¿Crear esta categoría?",
          message: `"${name}" quedará disponible para clasificar tus ${state.mode === "expense" ? "gastos" : "ingresos"}.`,
          confirmLabel: "Crear",
        });
        if (!ok) return;
        setButtonState(saveBtn, "loading");
        try {
          const created = await financialService.createCategory({ name, color: state.newCategoryColor, kind: state.mode });
          categories.push(created);
          state.categoryId = created.id;
          state.creatingCategory = false;
          renderCategoryRow();
          renderNewCategoryPanel();
          showToast(`Categoría "${created.name}" creada`);
        } catch (err) {
          setButtonState(saveBtn, null);
          showToast(err.message || "No se pudo crear la categoría");
        }
      },
    });

    const cancelBtn = Button({
      label: "Cancelar",
      variant: "ghost",
      onClick: () => {
        state.creatingCategory = false;
        renderCategoryRow();
        renderNewCategoryPanel();
      },
    });

    newCategoryPanel.append(nameInput, swatches, h("div", { class: "flex gap-2" }, [saveBtn, cancelBtn]));
  }

  function renderAlloc() {
    clear(allocSection);
    if (state.mode !== "income") return;
    allocSection.append(
      h("p", { class: "field-label" }, "Asignación automática"),
      h("div", { class: "flex flex-wrap gap-2" }, [
        Chip({
          label: "Fondo de emergencia · 10%",
          color: "var(--warning)",
          pressed: state.allocFund,
          onClick: () => (state.allocFund = !state.allocFund, renderAlloc()),
        }),
        Chip({
          label: "Inversión · 5%",
          color: "var(--positive-2)",
          pressed: state.allocInvest,
          onClick: () => (state.allocInvest = !state.allocInvest, renderAlloc()),
        }),
      ])
    );
  }

  function setMode(mode) {
    state.mode = mode;
    state.categoryId = categories.find((c) => c.kind === mode)?.id || null;
    state.creatingCategory = false;
    submitBtn.querySelector(".btn__label").textContent = mode === "income" ? "Agregar ingreso" : "Agregar gasto";
    renderModeRow();
    renderCategoryRow();
    renderNewCategoryPanel();
    renderAlloc();
  }

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const amount = parseFloat(state.amount);
        if (!amount || amount <= 0) {
          shakeField(amountField);
          return;
        }
        const categoryName = categories.find((c) => c.id === state.categoryId)?.name;
        const ok = await confirmAction({
          title: state.mode === "expense" ? "¿Agregar este gasto?" : "¿Agregar este ingreso?",
          message: `${fmt(amount)}${categoryName ? " · " + categoryName : ""}`,
          confirmLabel: "Agregar",
        });
        if (!ok) return;
        setButtonState(submitBtn, "loading");
        try {
          if (state.mode === "expense") {
            await financialService.quickExpense({ category_id: state.categoryId, amount, date: todayISO() });
            showToast(`Gasto agregado: ${fmt(amount)}`);
          } else {
            await financialService.quickIncome({
              category_id: state.categoryId,
              amount,
              date: todayISO(),
              allocate_emergency_fund_pct: state.allocFund ? 10 : 0,
              allocate_investment_pct: state.allocInvest ? 5 : 0,
            });
            showToast(`Ingreso agregado: ${fmt(amount)}`);
          }
          setButtonState(submitBtn, "success");
          onDone?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          showToast(err.message || "No se pudo guardar");
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [modeRow, categoryLabel, categoryRow, newCategoryPanel, amountLabel, amountField, allocSection, submitBtn]
  );

  renderModeRow();
  renderCategoryRow();
  renderNewCategoryPanel();
  renderAlloc();

  return form;
}
