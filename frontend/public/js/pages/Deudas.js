import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { Chip } from "../components/Chip.js";
import { Button } from "../components/Button.js";
import { showToast } from "../components/Toast.js";
import { createBottomSheet } from "../components/BottomSheet.js";
import { DebtForm } from "./DebtForm.js";

const EXTRA_PAYMENT_OPTIONS = [100000, 200000, 300000, 400000, 500000];

export async function renderDeudas(pageEl) {
  const sheet = createBottomSheet();
  let debts, strategyData;
  let selectedStrategy = "avalanche";
  let extraPayment = 200000;

  async function loadStrategy() {
    strategyData = await financialService.getDebtStrategy(extraPayment);
  }

  try {
    debts = await financialService.listDebts();
    await loadStrategy();
  } catch (err) {
    clear(pageEl);
    pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar deudas: ${err.message}`));
    return;
  }

  const statsRow = h("section", { class: "flex gap-3", style: "margin-bottom:var(--space-4)" });
  const strategyChipsRow = h("section", { class: "flex gap-2", style: "margin-bottom:var(--space-4)" });
  const extraChipsRow = h("section", { class: "flex flex-wrap gap-2", style: "margin-bottom:var(--space-5)" });
  const comparisonRow = h("section", { class: "summary-grid", style: "margin-bottom:var(--space-5)" });
  const orderList = h("div", { class: "flex flex-col gap-2", style: "margin-bottom:var(--space-6)" });
  const debtsList = h("div", { class: "flex flex-col gap-2" });

  function openDebtForm(debt) {
    sheet.open(debt ? "Editar deuda" : "Agregar deuda", DebtForm({ debt, onDone: refreshAll }));
  }

  async function refreshAll() {
    setTimeout(() => sheet.close(), 400);
    debts = await financialService.listDebts();
    await loadStrategy();
    renderAll();
  }

  function renderStats() {
    clear(statsRow);
    statsRow.append(
      h("div", { class: "stat-card glass" }, [h("p", {}, "Deuda vs. ingresos"), h("p", {}, `${strategyData.stats.debtToIncomeMonths} meses`)]),
      h("div", { class: "stat-card glass" }, [h("p", {}, "Capacidad de pago usada"), h("p", {}, `${strategyData.stats.capacidadPagoPct}%`)])
    );
  }

  function renderStrategyChips() {
    clear(strategyChipsRow);
    strategyChipsRow.append(
      Chip({ label: "Bola de nieve", color: "var(--positive)", pressed: selectedStrategy === "snowball", onClick: () => setStrategy("snowball") }),
      Chip({ label: "Avalancha", color: "var(--negative)", pressed: selectedStrategy === "avalanche", onClick: () => setStrategy("avalanche") })
    );
  }

  function renderExtraChips() {
    clear(extraChipsRow);
    extraChipsRow.append(
      ...EXTRA_PAYMENT_OPTIONS.map((v) => Chip({ label: fmt(v), color: "var(--ink)", pressed: extraPayment === v, onClick: () => setExtraPayment(v) }))
    );
  }

  function renderComparison() {
    clear(comparisonRow);
    const s = strategyData.snowball;
    const a = strategyData.avalanche;
    comparisonRow.append(
      h("div", { class: "glass", style: `border-radius:var(--radius-lg);padding:16px;border:${selectedStrategy === "snowball" ? "2px solid var(--positive)" : "1px solid var(--glass-border)"}` }, [
        h("p", { style: "font-size:13px;font-weight:800;margin:0 0 8px" }, "❄️ Bola de nieve"),
        h("p", { style: "margin:0 0 2px;font-size:20px;font-weight:800" }, `${s.months} meses`),
        h("p", { style: "margin:0;font-size:12px;font-weight:600;color:var(--text-secondary)" }, `Interés total: ${fmt(s.totalInterest)}`),
      ]),
      h("div", { class: "glass", style: `border-radius:var(--radius-lg);padding:16px;border:${selectedStrategy === "avalanche" ? "2px solid var(--negative)" : "1px solid var(--glass-border)"}` }, [
        h("p", { style: "font-size:13px;font-weight:800;margin:0 0 8px" }, "🏔️ Avalancha"),
        h("p", { style: "margin:0 0 2px;font-size:20px;font-weight:800" }, `${a.months} meses`),
        h("p", { style: "margin:0;font-size:12px;font-weight:600;color:var(--text-secondary)" }, `Interés total: ${fmt(a.totalInterest)}`),
      ])
    );
  }

  function renderOrder() {
    clear(orderList);
    const selected = strategyData[selectedStrategy];
    orderList.append(
      ...selected.order.map((o, i) =>
        h("div", { class: "order-row glass" }, [
          h("span", { class: "order-row__position" }, String(i + 1)),
          h("div", { style: "flex:1;min-width:0" }, [
            h("p", { style: "margin:0;font-size:13.5px;font-weight:700" }, o.name),
            h("p", { style: "margin:2px 0 0;font-size:11.5px;font-weight:600;color:var(--text-secondary)" }, `${fmt(o.balance)} · ${o.rate > 0 ? o.rate + "% anual" : "Sin interés"}`),
          ]),
          h("span", { style: "font-size:12px;font-weight:700;color:var(--positive)" }, `Mes ${o.paidMonth}`),
        ])
      )
    );
  }

  function renderDebtsList() {
    clear(debtsList);
    debtsList.append(
      ...debts.map((d) =>
        h("div", { class: "debt-row glass" }, [
          h("div", { style: "flex:1;min-width:0" }, [
            h("p", { style: "margin:0;font-size:14px;font-weight:700" }, d.name),
            h("p", { style: "margin:3px 0 0;font-size:12px;font-weight:600;color:var(--text-secondary)" }, `${fmt(d.balance)} · ${d.interest_rate > 0 ? d.interest_rate + "% anual" : "Sin interés"} · mín. ${fmt(d.minimum_payment)}`),
          ]),
          h("span", { style: "cursor:pointer;color:var(--text-secondary);font-size:12px;font-weight:700;padding:6px 8px", onClick: () => openDebtForm(d) }, "Editar"),
          h("span", {
            style: "cursor:pointer;color:var(--negative);font-size:12px;font-weight:700;padding:6px 8px",
            onClick: async () => {
              await financialService.deleteDebt(d.id);
              showToast("Deuda eliminada");
              refreshAll();
            },
          }, "Eliminar"),
        ])
      )
    );
  }

  function renderAll() {
    renderStats();
    renderStrategyChips();
    renderExtraChips();
    renderComparison();
    renderOrder();
    renderDebtsList();
  }

  async function setStrategy(s) {
    selectedStrategy = s;
    renderStrategyChips();
    renderComparison();
    renderOrder();
  }

  async function setExtraPayment(v) {
    extraPayment = v;
    renderExtraChips();
    await loadStrategy();
    renderComparison();
    renderOrder();
    renderStats();
  }

  clear(pageEl);
  pageEl.append(
    PageHeader({ eyebrow: "Plan de pago", title: "Deudas" }),
    statsRow,
    SectionTitle({ label: "Estrategia de pago" }),
    strategyChipsRow,
    h("p", { class: "field-label" }, "Pago extra mensual"),
    extraChipsRow,
    comparisonRow,
    SectionTitle({ label: "Orden sugerido de pago", meta: selectedStrategy === "snowball" ? "Bola de nieve" : "Avalancha" }),
    orderList,
    h("div", { class: "flex items-center justify-between", style: "margin:22px 2px 10px" }, [
      h("span", { style: "font:var(--fw-bold) var(--fs-base)/var(--lh-tight) var(--font-primary);color:var(--text-primary)" }, "Tus deudas"),
      Button({ label: "Agregar deuda", variant: "secondary", iconName: "plus", onClick: () => openDebtForm(null) }),
    ]),
    debtsList
  );

  renderAll();

  const onRefresh = () => refreshAll();
  window.addEventListener("bolsillo:refresh", onRefresh);
  return () => {
    window.removeEventListener("bolsillo:refresh", onRefresh);
    sheet.root.remove();
  };
}
