import { h, clear } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmtMoney, fmtDateShort } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { Chip } from "../components/Chip.js";
import { findPocket } from "../services/pocketState.js";

const monthLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

/**
 * Lista del mes por categoría — la pantalla "Gastos" de siempre, ahora
 * filtrada por el bolsillo activo y reutilizada para "Ingresos". En
 * "Todo / Consolidado" muestra todos los bolsillos con su etiqueta.
 */
function makeTxPage(kind) {
  const isIncome = kind === "income";

  return async function renderTxPage(pageEl, { pocket, all } = {}) {
    let rows = [];
    let categories = [];
    let activeFilter = "todas";
    const bolsillo = all ? undefined : pocket?.id;
    const title = isIncome ? "Ingresos" : pocket?.kind === "business" ? "Egresos" : "Gastos";
    const noun = isIncome ? "ingresos" : title.toLowerCase();
    const currency = pocket?.currency;

    const chipsRow = h("section", { class: "summary-row no-scrollbar" });
    const totalCard = h("div", {
      class: "flex items-center justify-between glass glass-in",
      style: "border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);--d:80",
    });
    const list = h("div", { class: "tx-list" });
    const meta = h("span", { class: "section-title__meta" });

    function renderChips() {
      clear(chipsRow);
      chipsRow.append(
        Chip({ label: "Todas", color: "var(--ink)", pressed: activeFilter === "todas", onClick: () => setFilter("todas") }),
        ...categories.map((c) => Chip({ label: c.name, color: c.color, pressed: activeFilter === c.name, onClick: () => setFilter(c.name) }))
      );
    }

    function renderList() {
      const filtered = rows
        .filter((t) => activeFilter === "todas" || t.categorias?.name === activeFilter)
        .sort((a, b) => b.date.localeCompare(a.date));
      const total = filtered.reduce((s, t) => s + Number(t.amount), 0);
      meta.textContent = `${rows.length} movimientos`;

      clear(totalCard);
      totalCard.append(
        h("span", { style: "font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text-secondary)" }, `Total ${activeFilter === "todas" ? "" : "· " + activeFilter}`),
        h("span", { style: "font-size:var(--fs-xl);font-weight:var(--fw-extrabold);color:var(--text-primary)" }, fmtMoney(total, currency))
      );

      clear(list);
      if (!filtered.length) {
        list.appendChild(
          h("p", { style: "color:var(--text-tertiary);padding:var(--space-5) 0;text-align:center" },
            rows.length ? "Sin movimientos en esta categoría" : `Todavía no hay ${noun} este mes. Usá el botón + para registrar uno.`)
        );
        return;
      }
      list.append(
        ...filtered.map((t, i) => {
          const p = all ? findPocket(t.bolsillo_id) : null;
          return h("div", { class: "tx-row glass-in", style: `--d:${Math.min(i, 10) * 30}` }, [
            h("div", { class: "flex items-center gap-3", style: "min-width:0" }, [
              h("span", { style: `width:10px;height:10px;border-radius:50%;background:${t.categorias?.color || "#787774"};flex:none` }),
              h("div", { style: "min-width:0" }, [
                h("p", { class: "tx-row__note" }, t.description || (isIncome ? "Ingreso" : "Gasto")),
                h("p", { class: "tx-row__meta" }, [
                  p ? h("span", { class: "pocket-tag", style: `--pc:${p.color}` }, `${p.icon} ${p.name}`) : null,
                  [t.categorias?.name || "Sin categoría", t.payment_method, fmtDateShort(t.date)].filter(Boolean).join(" · "),
                ]),
              ]),
            ]),
            h("span", { class: `tx-row__amount${isIncome ? " tx-row__amount--in" : ""}` }, (isIncome ? "+" : "-") + fmtMoney(t.amount, p?.currency || currency)),
          ]);
        })
      );
    }

    function setFilter(name) {
      activeFilter = name;
      renderChips();
      renderList();
    }

    async function load() {
      const [data, cats] = await Promise.all([
        isIncome ? financialService.listIncomes({ bolsillo }) : financialService.listExpenses({ bolsillo }),
        financialService.listCategories(bolsillo),
      ]);
      rows = data;
      // En el consolidado puede haber categorías homónimas de distintos bolsillos: un chip por nombre.
      const seen = new Set();
      categories = cats.filter((c) => c.kind === kind && !seen.has(c.name) && seen.add(c.name));
      renderChips();
      renderList();
    }

    clear(pageEl);
    pageEl.append(
      PageHeader({ eyebrow: `${all ? "Todos los bolsillos" : `${pocket?.icon} ${pocket?.name}`} · ${monthTitleCase}`, title }),
      SectionTitle({ label: `${title} por categoría`, meta }),
      chipsRow,
      totalCard,
      list
    );

    try {
      await load();
    } catch (err) {
      clear(pageEl);
      pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar ${noun}: ${err.message}`));
      return;
    }

    const onRefresh = () => load().catch(() => {});
    window.addEventListener("bolsillo:refresh", onRefresh);
    return () => window.removeEventListener("bolsillo:refresh", onRefresh);
  };
}

export const renderGastos = makeTxPage("expense");
export const renderIngresos = makeTxPage("income");
