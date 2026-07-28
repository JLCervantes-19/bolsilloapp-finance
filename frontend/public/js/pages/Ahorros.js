import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { Button } from "../components/Button.js";
import { createBottomSheet } from "../components/BottomSheet.js";
import { ContributeForm, NewGoalForm } from "./GoalForms.js";

export async function renderAhorros(pageEl) {
  const sheet = createBottomSheet();
  let goals = [];
  let dashboard = null;

  const goalsGrid = h("section", { class: "goals-grid" });
  const totalEl = h("p", { style: "margin:0 0 14px;font-size:26px;font-weight:800" });
  const goalsCountEl = h("span", { style: "font:var(--fw-bold) var(--fs-base)/var(--lh-tight) var(--font-primary);color:var(--text-primary)" });

  function renderGoals() {
    const totalSavings = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    totalEl.textContent = fmt(totalSavings);
    goalsCountEl.textContent = `Tus metas · ${goals.length}`;

    clear(goalsGrid);
    goalsGrid.append(
      ...goals.map((g, i) => {
        const pct = Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100));
        return h("div", { class: "goal-card glass glass-in", style: `--d:${i * 60}` }, [
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
              onClick: () => sheet.open(`Abonar a ${g.name}`, ContributeForm({ goal: g, availableBalance: dashboard?.balance ?? 0, onDone: refresh })),
            }),
          ]),
        ]);
      })
    );
  }

  async function refresh() {
    setTimeout(() => sheet.close(), 400);
    [goals, dashboard] = await Promise.all([financialService.listGoals(), financialService.getDashboardSummary()]);
    renderGoals();
  }

  clear(pageEl);
  pageEl.append(
    PageHeader({ eyebrow: "Tus metas", title: "Ahorros y metas" }),
    h("div", { class: "hero-savings glass-strong glass-in" }, [
      h("p", { style: "margin:0 0 4px;font-size:13px;font-weight:700;opacity:0.7" }, "Ahorro acumulado total"),
      totalEl,
    ]),
    h("div", { class: "flex items-center justify-between", style: "margin:var(--space-6) 2px var(--space-3)" }, [
      goalsCountEl,
      Button({ label: "Nueva meta", variant: "secondary", iconName: "plus", onClick: () => sheet.open("Nueva meta", NewGoalForm({ onDone: refresh })) }),
    ]),
    goalsGrid
  );

  try {
    await refresh();
  } catch (err) {
    clear(pageEl);
    pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudieron cargar los ahorros: ${err.message}`));
    return;
  }

  const onRefresh = () => refresh();
  window.addEventListener("bolsillo:refresh", onRefresh);
  return () => {
    window.removeEventListener("bolsillo:refresh", onRefresh);
    sheet.root.remove();
  };
}
