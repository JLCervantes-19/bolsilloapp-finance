import { h, clear } from "../utils/dom.js";
import { Chip } from "../components/Chip.js";
import { AmountField, shakeField } from "../components/AmountField.js";
import { Button, setButtonState } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { financialService } from "../services/financialService.js";
import { fmt, todayISO } from "../utils/formatters.js";

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
  };

  const modeRow = h("section", { class: "flex gap-2 mb-4" });
  const categoryLabel = h("p", { class: "field-label" }, "Categoría");
  const categoryRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const amountLabel = h("p", { class: "field-label" }, "Monto");
  const amountField = AmountField({ onChange: (v) => (state.amount = v) });
  const allocSection = h("div", { class: "mb-5" });
  const submitBtn = Button({ label: "Agregar gasto", fullWidth: true, type: "submit" });

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
      ...list.map((c) => Chip({ label: c.name, color: c.color, pressed: c.id === state.categoryId, onClick: () => (state.categoryId = c.id, renderCategoryRow()) }))
    );
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
    submitBtn.querySelector(".btn__label").textContent = mode === "income" ? "Agregar ingreso" : "Agregar gasto";
    renderModeRow();
    renderCategoryRow();
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
    [modeRow, categoryLabel, categoryRow, amountLabel, amountField, allocSection, submitBtn]
  );

  renderModeRow();
  renderCategoryRow();
  renderAlloc();

  return form;
}
