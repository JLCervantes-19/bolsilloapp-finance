import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt, fmtDateShort } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { Chip } from "../components/Chip.js";

const monthLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

export async function renderGastos(pageEl) {
  let expenses, categories;
  try {
    [expenses, categories] = await Promise.all([financialService.listExpenses(), financialService.listCategories()]);
  } catch (err) {
    clear(pageEl);
    pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar gastos: ${err.message}`));
    return;
  }

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  let activeFilter = "todas";

  const chipsRow = h("section", { class: "summary-row no-scrollbar" });
  const totalCard = h("div", { class: "flex items-center justify-between glass", style: "border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)" });
  const list = h("div", { class: "tx-list" });

  function renderChips() {
    clear(chipsRow);
    chipsRow.append(
      Chip({ label: "Todas", color: "var(--ink)", pressed: activeFilter === "todas", onClick: () => setFilter("todas") }),
      ...expenseCategories.map((c) => Chip({ label: c.name, color: c.color, pressed: activeFilter === c.name, onClick: () => setFilter(c.name) }))
    );
  }

  function renderList() {
    const filtered = expenses
      .filter((t) => activeFilter === "todas" || t.categories?.name === activeFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
    const total = filtered.reduce((s, t) => s + Number(t.amount), 0);

    clear(totalCard);
    totalCard.append(
      h("span", { style: "font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text-secondary)" }, `Total ${activeFilter === "todas" ? "" : "· " + activeFilter}`),
      h("span", { style: "font-size:var(--fs-xl);font-weight:var(--fw-extrabold);color:var(--text-primary)" }, fmt(total))
    );

    clear(list);
    if (!filtered.length) {
      list.appendChild(h("p", { style: "color:var(--text-tertiary);padding:var(--space-5) 0;text-align:center" }, "Sin movimientos en esta categoría"));
      return;
    }
    list.append(
      ...filtered.map((t) =>
        h("div", { class: "tx-row" }, [
          h("div", { class: "flex items-center gap-3", style: "min-width:0" }, [
            h("span", { style: `width:10px;height:10px;border-radius:50%;background:${t.categories?.color || "#787774"};flex:none` }),
            h("div", { style: "min-width:0" }, [
              h("p", { class: "tx-row__note" }, t.description || "Gasto"),
              h("p", { class: "tx-row__meta" }, `${t.categories?.name || "Sin categoría"} · ${fmtDateShort(t.date)}`),
            ]),
          ]),
          h("span", { class: "tx-row__amount" }, "-" + fmt(t.amount)),
        ])
      )
    );
  }

  function setFilter(name) {
    activeFilter = name;
    renderChips();
    renderList();
  }

  clear(pageEl);
  pageEl.append(
    PageHeader({ eyebrow: monthTitleCase, title: "Gastos" }),
    SectionTitle({ label: "Gastos por categoría", meta: `${expenses.length} movimientos` }),
    chipsRow,
    totalCard,
    list
  );

  renderChips();
  renderList();
}
