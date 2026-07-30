import { h, clear } from "../utils/dom.js";
import { AmountField, shakeField } from "../components/AmountField.js";
import { Chip } from "../components/Chip.js";
import { Button, setButtonState } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { confirmAction } from "../components/Confirm.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { api } from "../services/api.js";

export function ContributeForm({ goal, availableBalance, onDone }) {
  let amount = "";
  const field = AmountField({ onChange: (v) => (amount = v) });
  const submitBtn = Button({ label: "Abonar", fullWidth: true, type: "submit" });

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const n = parseFloat(amount);
        if (!n || n <= 0) return shakeField(field);
        const ok = await confirmAction({ title: "¿Confirmar abono?", message: `${fmt(n)} a "${goal.name}"`, confirmLabel: "Abonar" });
        if (!ok) return;
        setButtonState(submitBtn, "loading");
        try {
          await financialService.contributeToGoal(goal.id, n);
          setButtonState(submitBtn, "success");
          showToast(`Abono registrado: ${fmt(n)}`);
          onDone?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          showToast(err.message || "No se pudo abonar");
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Monto a abonar"),
      field,
      h("p", { style: "margin:8px 0 20px;font-size:12px;font-weight:600;color:var(--text-secondary)" }, `Disponible: ${fmt(availableBalance)}`),
      submitBtn,
    ]
  );
  return form;
}

const GOAL_COLORS = ["var(--warning)", "var(--positive-2)", "var(--positive)", "var(--negative-2)", "var(--brand-accent)"];

export function NewGoalForm({ onDone }) {
  const nameField = h("input", { type: "text", class: "text-field", placeholder: "Ej. Viaje de fin de año" });
  const targetField = h("input", { type: "number", class: "text-field", placeholder: "0" });
  let isEmergency = false;
  const emergencyChipWrap = h("div", {});
  const submitBtn = Button({ label: "Crear meta", fullWidth: true, type: "submit" });

  function renderEmergencyChip() {
    clear(emergencyChipWrap);
    emergencyChipWrap.appendChild(
      Chip({ label: "Es mi fondo de emergencia", color: "var(--warning)", pressed: isEmergency, onClick: () => ((isEmergency = !isEmergency), renderEmergencyChip()) })
    );
  }
  renderEmergencyChip();

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const name = nameField.value.trim();
        const target = parseFloat(targetField.value);
        if (!name || !target || target <= 0) return;
        const ok = await confirmAction({ title: "¿Crear esta meta?", message: `${name} · objetivo ${fmt(target)}`, confirmLabel: "Crear" });
        if (!ok) return;
        setButtonState(submitBtn, "loading");
        try {
          await api.post("/goals", {
            name,
            target_amount: target,
            is_emergency_fund: isEmergency,
            color: GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)],
          });
          setButtonState(submitBtn, "success");
          showToast("Meta creada");
          onDone?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          showToast(err.message || "No se pudo crear la meta");
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Nombre"),
      nameField,
      h("p", { class: "field-label", style: "margin-top:var(--space-3)" }, "Monto objetivo"),
      targetField,
      h("div", { style: "margin:var(--space-4) 0 var(--space-5)" }, [emergencyChipWrap]),
      submitBtn,
    ]
  );
  return form;
}
