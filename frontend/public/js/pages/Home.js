import { h, clear, append } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmt, fmtMoney, fmtPct } from "../utils/formatters.js";
import { SummaryCard } from "../components/SummaryCard.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { InsightBanner } from "../components/InsightBanner.js";
import { PageHeader } from "../components/PageHeader.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton.js";
import { MovementRow } from "../components/MovementRow.js";
import { Button } from "../components/Button.js";
import { renderDashboard, barConfig, donutConfig, lineConfig } from "./Dashboard.js";
import { KIND_LABEL } from "../services/pocketState.js";

const monthLabel = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
const monthTitleCase = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

/**
 * "Resumen" según el bolsillo activo:
 * - Todo / Consolidado → vista global.
 * - Bolsillo personal predeterminado → el dashboard de siempre (con deudas,
 *   ahorro, salud financiera), ahora limitado a ese bolsillo.
 * - Cualquier otro bolsillo → resumen de su caja (negocio o personal).
 */
export function renderHome(pageEl, ctx) {
  if (ctx.all) return renderConsolidado(pageEl);
  if (ctx.pocket?.is_default) return renderDashboard(pageEl, ctx);
  return renderPocketSummary(pageEl, ctx.pocket);
}

function addMovementButton(label) {
  return Button({ label, iconName: "plus", variant: "secondary", onClick: () => document.querySelector(".fab, .sidebar__add")?.click() });
}

function legendList(items, currency) {
  return h(
    "ul",
    { class: "legend-list" },
    items.map((c) =>
      h("li", {}, [
        h("span", { class: "legend-list__name" }, [h("span", { class: "legend-list__dot", style: `background:${c.color}` }), c.name]),
        h("span", { style: "font-weight:700" }, fmtMoney(c.value, currency)),
      ])
    )
  );
}

function withCharts(pageEl, drawFn) {
  let charts = [];
  const destroy = () => {
    charts.forEach((c) => c?.destroy());
    charts = [];
  };
  async function draw() {
    const made = await drawFn();
    if (!made) return;
    destroy();
    if (window.Chart) {
      Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      charts = made.map(([canvas, config]) => new Chart(canvas, config));
    }
  }
  return { draw, destroy };
}

// ---------------------------------------------------------------------------
// Bolsillo (negocio o personal adicional)
// ---------------------------------------------------------------------------
async function renderPocketSummary(pageEl, pocket) {
  const isBusiness = pocket.kind === "business";
  const egresoLabel = isBusiness ? "Egresos" : "Gastos";

  const { draw, destroy } = withCharts(pageEl, async () => {
    let overview, recent;
    try {
      [overview, recent] = await Promise.all([
        financialService.getPocketOverview(pocket.id),
        financialService.listMovements({ bolsillo: pocket.id, pageSize: 6 }),
      ]);
    } catch (err) {
      clear(pageEl);
      pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar el bolsillo: ${err.message}`));
      return null;
    }
    const p = overview.pocket;
    const m = p.metrics;
    const cur = p.currency;
    const empty = !recent.total;

    const cards = [
      SummaryCard({ iconName: "wallet", tone: "positive", label: isBusiness ? "Saldo en caja" : "Saldo", value: m.saldo, delay: 0 }),
      SummaryCard({ iconName: "in", tone: "positive", label: "Ingresos del mes", value: m.periodo.ingresos, delay: 40 }),
      SummaryCard({ iconName: "out", tone: "negative", label: `${egresoLabel} del mes`, value: m.periodo.gastos, delay: 80 }),
      SummaryCard({ iconName: "layers", tone: m.periodo.resultado >= 0 ? "positive2" : "negative", label: isBusiness ? "Utilidad del mes" : "Balance del mes", value: m.periodo.resultado, delay: 120 }),
    ];
    if (isBusiness) {
      const n = m.negocio;
      cards.push(
        SummaryCard({ iconName: "trend", tone: "positive2", label: "Capital invertido", value: n.capitalInvertido, delay: 160 }),
        SummaryCard({ iconName: "card", tone: "warning", label: "Retiros acumulados", value: n.retirosAcumulados, delay: 200 }),
        SummaryCard({
          iconName: "gauge",
          tone: n.rentabilidadPct === null ? "neutral" : n.rentabilidadPct >= 0 ? "positive" : "negative",
          label: "Rentabilidad",
          value: h("p", { class: "summary-card__value" }, n.rentabilidadPct === null ? "—" : fmtPct(n.rentabilidadPct, 1)),
          footer: h("span", { class: "summary-card__hint" }, n.rentabilidadPct === null ? "Registrá capital para calcularla" : `Utilidad acumulada ${fmtMoney(n.utilidadAcumulada, cur)}`),
          delay: 240,
        })
      );
    } else if (m.periodo.entradas || m.periodo.salidas) {
      cards.push(SummaryCard({ iconName: "swap", tone: "neutral", label: "Transferencias recibidas", value: m.periodo.entradas, delay: 160 }));
    }

    const barCanvas = h("canvas");
    const lineCanvas = h("canvas");
    const donutCanvas = h("canvas");
    const gastosCat = overview.categorias.gastos;
    const ingresosCat = overview.categorias.ingresos;

    clear(pageEl);
    append(pageEl, 
      PageHeader({ eyebrow: `${p.icon} ${KIND_LABEL[p.kind]}${p.archived_at ? " · Archivado" : ""}`, title: p.name, pillLabel: monthTitleCase }),
      p.archived_at ? InsightBanner({ tone: "warning", text: "Este bolsillo está archivado: su saldo se conserva, pero no se pueden registrar movimientos nuevos. Desarchivalo desde el panel de bolsillos." }) : null,
      cur !== "COP" ? h("p", { class: "form-note" }, `Montos en ${cur}.`) : null,
      SectionTitle({ label: "Resumen del mes" }),
      h("section", { class: "summary-row no-scrollbar" }, cards)
    );

    if (empty) {
      append(pageEl, 
        h("div", { class: "empty-state glass glass-in" }, [
          h("span", { class: "empty-state__icon", "aria-hidden": "true" }, p.icon),
          h("h3", {}, "Este bolsillo está listo"),
          h("p", {}, isBusiness
            ? "Registrá tu primera venta, un egreso o el capital que le metés al negocio. Todo lo de aquí queda separado de tus finanzas personales."
            : "Registrá ingresos y gastos de este bolsillo o traé dinero desde otro con un traslado."),
          h("div", { class: "flex flex-wrap gap-2", style: "justify-content:center" }, [addMovementButton(isBusiness ? "Registrar movimiento" : "Agregar movimiento")]),
        ])
      );
      return [];
    }

    append(pageEl, 
      SectionTitle({ label: "Análisis" }),
      h("section", { class: "summary-grid" }, [
        h("div", { class: "chart-card glass" }, [h("h3", {}, `Ingresos vs. ${egresoLabel.toLowerCase()}`), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:220px" }, [barCanvas])]),
        h("div", { class: "chart-card glass" }, [
          h("h3", {}, `${egresoLabel} por categoría`),
          h("p", {}, monthTitleCase),
          gastosCat.length
            ? h("div", { style: "position:relative;max-width:210px;margin:0 auto;height:180px" }, [donutCanvas])
            : h("p", { class: "form-note" }, `Sin ${egresoLabel.toLowerCase()} este mes.`),
          legendList(gastosCat, cur),
          ingresosCat.length ? h("h3", { style: "margin-top:var(--space-4)" }, "Ingresos por categoría") : null,
          ingresosCat.length ? legendList(ingresosCat, cur) : null,
        ]),
        h("div", { class: "chart-card glass", style: "grid-column:1 / -1" }, [
          h("h3", {}, isBusiness ? "Evolución de la caja" : "Evolución del saldo"),
          h("p", {}, "Últimos 6 meses"),
          h("div", { style: "height:220px" }, [lineCanvas]),
        ]),
      ]),
      SectionTitle({ label: "Últimos movimientos", meta: h("a", { href: "#/movimientos", class: "link" }, "Ver todos") }),
      h("div", { class: "tx-list glass", style: "border-radius:var(--radius-lg);padding:0 var(--space-4)" }, recent.data.map((x, i) => MovementRow(x, { delay: i * 30 })))
    );

    const s = overview.serie;
    const made = [
      [barCanvas, barConfig(s.labels, s.ingresos, s.gastos, { income: "Ingresos", expense: egresoLabel })],
      [lineCanvas, lineConfig(s.labels, s.saldo, "Saldo")],
    ];
    if (gastosCat.length) made.push([donutCanvas, donutConfig(gastosCat)]);
    return made;
  });

  clear(pageEl);
  pageEl.appendChild(DashboardSkeleton());
  await draw();
  const onRefresh = () => draw();
  window.addEventListener("bolsillo:refresh", onRefresh);
  return () => {
    window.removeEventListener("bolsillo:refresh", onRefresh);
    destroy();
  };
}

// ---------------------------------------------------------------------------
// Todo / Consolidado
// ---------------------------------------------------------------------------
async function renderConsolidado(pageEl) {
  const { draw, destroy } = withCharts(pageEl, async () => {
    let c, recent;
    try {
      [c, recent] = await Promise.all([financialService.getConsolidated(), financialService.listMovements({ pageSize: 8 })]);
    } catch (err) {
      clear(pageEl);
      pageEl.appendChild(h("p", { style: "color:var(--text-secondary)" }, `No se pudo cargar el consolidado: ${err.message}`));
      return null;
    }

    const barCanvas = h("canvas");
    const lineCanvas = h("canvas");
    const donutCanvas = h("canvas");
    const solo = c.porBolsillo.length === 1;

    clear(pageEl);
    append(pageEl, 
      PageHeader({ eyebrow: "Todos tus bolsillos", title: "Consolidado", pillLabel: monthTitleCase }),
      c.monedasMezcladas
        ? InsightBanner({ tone: "warning", text: `Tenés bolsillos en monedas distintas (${c.monedas.join(", ")}). Los totales se suman sin convertir.` })
        : null,
      SectionTitle({ label: "Panorama del mes" }),
      h("section", { class: "summary-row no-scrollbar" }, [
        SummaryCard({ iconName: "layers", tone: "neutral", label: "Patrimonio total", value: c.patrimonio, delay: 0 }),
        SummaryCard({ iconName: "in", tone: "positive", label: "Ingresos globales", value: c.ingresosPeriodo, delay: 40 }),
        SummaryCard({ iconName: "out", tone: "negative", label: "Gastos globales", value: c.gastosPeriodo, delay: 80 }),
        SummaryCard({ iconName: "wallet", tone: c.balancePeriodo >= 0 ? "positive2" : "negative", label: "Balance global", value: c.balancePeriodo, delay: 120 }),
      ]),
      h("p", { class: "form-note" }, "Las transferencias entre tus bolsillos (inversiones, retiros y traslados) mueven saldos pero no cuentan como ingreso ni como gasto."),
      solo
        ? h("div", { class: "empty-state glass glass-in" }, [
            h("h3", {}, "Por ahora tenés un solo bolsillo"),
            h("p", {}, "Cuando crees un bolsillo para tu negocio, acá vas a ver cuánto aporta cada uno y el total de todo junto."),
          ])
        : null,
      SectionTitle({ label: "Por bolsillo" }),
      h(
        "div",
        { class: "pocket-compare glass" },
        c.porBolsillo.map((b) =>
          h("div", { class: "pocket-compare__row", style: `--pc:${b.color}` }, [
            h("span", { class: "pocket-row__icon", "aria-hidden": "true" }, b.icon),
            h("div", { class: "pocket-compare__body" }, [
              h("div", { class: "pocket-compare__head" }, [
                h("span", { class: "pocket-row__name" }, `${b.name}${b.archived ? " (archivado)" : ""}`),
                h("span", { class: "pocket-row__balance" }, fmt(b.saldo)),
              ]),
              h("div", { class: "progress-bar__track" }, [h("div", { class: "progress-bar__fill", style: `width:${Math.max(0, Math.min(100, b.participacionPct))}%;background:${b.color}` })]),
              h("p", { class: "tx-row__meta" }, `${fmtPct(b.participacionPct)} del patrimonio · Ingresos ${fmt(b.ingresos)} · Gastos ${fmt(b.gastos)} · Resultado ${b.resultado >= 0 ? "+" : "-"}${fmt(Math.abs(b.resultado))}`),
            ]),
          ])
        )
      ),
      SectionTitle({ label: "Análisis" }),
      h("section", { class: "summary-grid" }, [
        h("div", { class: "chart-card glass" }, [h("h3", {}, "Ingresos vs. gastos globales"), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:220px" }, [barCanvas])]),
        h("div", { class: "chart-card glass" }, [
          h("h3", {}, "Top de categorías"),
          h("p", {}, `Gastos de todos los bolsillos · ${monthTitleCase}`),
          c.topCategorias.length ? h("div", { style: "position:relative;max-width:210px;margin:0 auto;height:180px" }, [donutCanvas]) : h("p", { class: "form-note" }, "Sin gastos este mes."),
          legendList(c.topCategorias),
        ]),
        h("div", { class: "chart-card glass", style: "grid-column:1 / -1" }, [h("h3", {}, "Evolución del patrimonio total"), h("p", {}, "Últimos 6 meses"), h("div", { style: "height:220px" }, [lineCanvas])]),
      ]),
      SectionTitle({ label: "Últimos movimientos", meta: h("a", { href: "#/movimientos", class: "link" }, "Ver todos") }),
      recent.data.length
        ? h("div", { class: "tx-list glass", style: "border-radius:var(--radius-lg);padding:0 var(--space-4)" }, recent.data.map((x, i) => MovementRow(x, { showPocket: true, delay: i * 30 })))
        : h("p", { class: "form-note" }, "Todavía no hay movimientos.")
    );

    const s = c.serie;
    const made = [
      [barCanvas, barConfig(s.labels, s.ingresos, s.gastos)],
      [lineCanvas, lineConfig(s.labels, s.saldo, "Patrimonio")],
    ];
    if (c.topCategorias.length) made.push([donutCanvas, donutConfig(c.topCategorias)]);
    return made;
  });

  clear(pageEl);
  pageEl.appendChild(DashboardSkeleton());
  await draw();
  const onRefresh = () => draw();
  window.addEventListener("bolsillo:refresh", onRefresh);
  return () => {
    window.removeEventListener("bolsillo:refresh", onRefresh);
    destroy();
  };
}
