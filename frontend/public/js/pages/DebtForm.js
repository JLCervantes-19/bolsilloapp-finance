import { h } from "../utils/dom.js";
import { Button, setButtonState } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { financialService } from "../services/financialService.js";

export function DebtForm({ debt, onDone }) {
  const nameField = h("input", { type: "text", class: "text-field", placeholder: "Ej. Tarjeta de crédito", value: debt?.name || "" });
  const balanceField = h("input", { type: "number", class: "text-field", placeholder: "0", value: debt?.balance ?? "" });
  const rateField = h("input", { type: "number", class: "text-field", placeholder: "0", value: debt?.interest_rate ?? "" });
  const minField = h("input", { type: "number", class: "text-field", placeholder: "0", value: debt?.minimum_payment ?? "" });
  const submitBtn = Button({ label: debt ? "Guardar cambios" : "Guardar deuda", fullWidth: true, type: "submit" });

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const name = nameField.value.trim();
        const balance = parseFloat(balanceField.value);
        if (!name || !balance || balance <= 0) return;
        const payload = {
          name,
          balance,
          interest_rate: parseFloat(rateField.value) || 0,
          minimum_payment: parseFloat(minField.value) || 0,
        };
        setButtonState(submitBtn, "loading");
        try {
          if (debt) await financialService.updateDebt(debt.id, payload);
          else await financialService.createDebt({ ...payload, original_balance: balance });
          setButtonState(submitBtn, "success");
          showToast(debt ? "Deuda actualizada" : "Deuda agregada");
          onDone?.();
        } catch (err) {
          setButtonState(submitBtn, "error");
          showToast(err.message || "No se pudo guardar");
          setTimeout(() => setButtonState(submitBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Nombre"),
      nameField,
      h("p", { class: "field-label", style: "margin-top:var(--space-3)" }, "Saldo actual"),
      balanceField,
      h("div", { class: "flex gap-3", style: "margin-top:var(--space-3)" }, [
        h("div", { style: "flex:1" }, [h("p", { class: "field-label" }, "Tasa anual %"), rateField]),
        h("div", { style: "flex:1" }, [h("p", { class: "field-label" }, "Pago mínimo"), minField]),
      ]),
      h("div", { style: "margin-top:var(--space-5)" }, [submitBtn]),
    ]
  );

  return form;
}
