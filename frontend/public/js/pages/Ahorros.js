import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { Button } from "../components/Button.js";
import { ActivityChart } from "../components/ActivityChart.js";
import { createBottomSheet } from "../components/BottomSheet.js";
import { ContributeForm, NewGoalForm } from "./GoalForms.js";

export async function renderAhorros(pageEl) {
  const sheet = createBottomSheet();
  let goals, dashboard;
  try {
    [goals, dashboard] = await Promise.all([financialService.listGoals(), financialService.getDashboardSummary()]);
  } catch (err) {
    clear(pageEl);
    pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudieron cargar los ahorros: ${err.message}`));
    return;
  }

  async function refresh() {
    setTimeout(() => sheet.close(), 400);
    [goals, dashboard] = await Promise.all([financialService.listGoals(), financialService.getDashboardSummary()]);
    renderGoals();
  }

  const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const goalsGrid = h("section", { class: "goals-grid" });

  function renderGoals() {
    clear(goalsGrid);
    goalsGrid.append(
      ...goals.map((g) => {
        const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
        return h("div", { class: "goal-card glass glass-in" }, [
          h("div", { class: "flex items-center gap-2", style: "margin-bottom:10px" }, [
            h("span", { style: `width:10px;height:10px;border-radius:50%;background:${g.color || "var(--brand-accent)"}` }),
            h("p", { style: "margin:0;font-size:14px;font-weight:700;color:var(--text-primary)" }, g.name),
          ]),
          ProgressBar({ percent: pct, label: `${pct}% de la meta · ${fmt(g.current_amount)} / ${fmt(g.target_amount)}`, color: g.color || "var(--brand-accent)" }),
          h("div", { style: "margin-top:14px" }, [
            Button({
              label: "Abonar",
              variant: "secondary",
              fullWidth: true,
              onClick: () => sheet.open(`Abonar a ${g.name}`, ContributeForm({ goal: g, availableBalance: dashboard.balance, onDone: refresh })),
            }),
          ]),
        ]);
      })
    );
  }

  clear(pageEl);
  pageEl.append(
    PageHeader({ eyebrow: "Tus metas", title: "Ahorros y metas" }),
    h("div", { class: "hero-savings glass-strong glass-in" }, [
      h("p", { style: "margin:0 0 4px;font-size:13px;font-weight:700;opacity:0.7" }, "Ahorro acumulado total"),
      h("p", { style: "margin:0 0 14px;font-size:26px;font-weight:800" }, fmt(totalSavings)),
      ActivityChart({ values: [20, 35, 30, 50, 45, 60, 55, 70, 65, 80, 78, 90], changePercent: 6 }),
    ]),
    h("div", { class: "flex items-center justify-between", style: "margin:var(--space-6) 2px var(--space-3)" }, [
      h("span", { style: "font:var(--fw-bold) var(--fs-base)/var(--lh-tight) var(--font-primary);color:var(--text-primary)" }, `Tus metas · ${goals.length}`),
      Button({ label: "Nueva meta", variant: "secondary", iconName: "plus", onClick: () => sheet.open("Nueva meta", NewGoalForm({ onDone: refresh })) }),
    ]),
    goalsGrid
  );

  renderGoals();
  return () => sheet.root.remove();
}
