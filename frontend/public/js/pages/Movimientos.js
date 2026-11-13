import { h, clear, append } from "../utils/dom.js";
import { financialService } from "../services/financialService.js";
import { fmtMoney, todayISO } from "../utils/formatters.js";
import { PageHeader } from "../components/PageHeader.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { SummaryCard } from "../components/SummaryCard.js";
import { Chip } from "../components/Chip.js";
import { Button, setButtonState } from "../components/Button.js";
import { AmountField, shakeField } from "../components/AmountField.js";
import { MovementRow, TIPO_LABEL } from "../components/MovementRow.js";
import { createBottomSheet } from "../components/BottomSheet.js";
import { confirmAction } from "../components/Confirm.js";
import { showToast } from "../components/Toast.js";
import { findPocket, PAYMENT_METHODS } from "../services/pocketState.js";

const PAGE_SIZE = 20;
let editSheet = null;

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function periodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "mes":
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    case "mes-pasado":
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
    case "3m":
      return { start: iso(new Date(y, m - 2, 1)), end: iso(new Date(y, m + 1, 0)) };
    case "ano":
      return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
    default:
      return { start: undefined, end: undefined };
  }
}
const PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "ano", label: "Este año" },
  { key: "todo", label: "Todo" },
  { key: "rango", label: "Elegir fechas" },
];

function tiposFor(pocket) {
  if (!pocket) return ["ingreso", "gasto", "aporte", "retiro", "traslado"];
  return pocket.kind === "business" ? ["ingreso", "gasto", "aporte", "retiro", "traslado"] : ["ingreso", "gasto", "traslado", "retiro", "aporte"];
}

/**
 * Historial unificado del bolsillo activo (o de todos, con etiqueta de
 * bolsillo). Filtros por tipo, fechas, categoría, método de pago y texto;
 * paginación; tocar una fila abre la edición/eliminación.
 * Con `fixedTipo` se reutiliza como pestaña "Inversión" o "Retiros".
 */
function makeMovementsPage({ fixedTipo = null } = {}) {
  return async function renderMovementsPage(pageEl, { pocket, all } = {}) {
    if (!editSheet) editSheet = createBottomSheet();
    const bolsillo = all ? undefined : pocket?.id;
    const f = { tipo: fixedTipo || "", period: fixedTipo ? "todo" : "mes", start: "", end: "", categoria: "", metodo: "", q: "", page: 1 };
    let categories = [];
    let searchTimer = null;

    const filtersEl = h("div", { class: "filters" });
    const listEl = h("div", { class: "tx-list glass", style: "border-radius:var(--radius-lg);padding:0 var(--space-4)" });
    const pagerEl = h("div", { class: "pager" });
    const meta = h("span", { class: "section-title__meta" });
    const summaryEl = h("section", { class: "summary-row no-scrollbar" });

    function params() {
      const range = f.period === "rango" ? { start: f.start || undefined, end: f.end || undefined } : periodRange(f.period);
      return { bolsillo, tipo: f.tipo || undefined, ...range, categoria: f.categoria || undefined, metodo: f.metodo || undefined, q: f.q || undefined, page: f.page, pageSize: PAGE_SIZE };
    }

    function select(options, value, onChange, label) {
      const el = h("select", { class: "text-field select-field", "aria-label": label, onChange: (e) => onChange(e.target.value) },
        options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)));
      return el;
    }

    function renderFilters() {
      clear(filtersEl);
      if (!fixedTipo) {
        filtersEl.append(
          h("div", { class: "summary-row no-scrollbar" }, [
            Chip({ label: "Todos", color: "var(--ink)", pressed: !f.tipo, onClick: () => update({ tipo: "" }) }),
            ...tiposFor(pocket).map((t) =>
              Chip({ label: t === "gasto" && pocket?.kind === "business" ? "Egresos" : TIPO_LABEL[t], color: "var(--ink)", pressed: f.tipo === t, onClick: () => update({ tipo: t }) })
            ),
          ])
        );
      }
      const search = h("input", {
        type: "search",
        class: "text-field",
        placeholder: "Buscar por descripción o categoría",
        value: f.q,
        maxLength: 80,
        "aria-label": "Buscar movimientos",
        onInput: (e) => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => update({ q: e.target.value.trim() }, { keepFilters: true }), 350);
        },
      });
      const row = [
        select(PERIODS.map((p) => ({ value: p.key, label: p.label })), f.period, (v) => update({ period: v }), "Periodo"),
        fixedTipo ? null : select([{ value: "", label: "Todas las categorías" }, ...categories.map((c) => ({ value: c.id, label: c.label }))], f.categoria, (v) => update({ categoria: v }), "Categoría"),
        select([{ value: "", label: "Cualquier método" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))], f.metodo, (v) => update({ metodo: v }), "Método de pago"),
      ];
      filtersEl.append(h("div", { class: "filters__grid" }, [search, ...row]));
      if (f.period === "rango") {
        filtersEl.append(
          h("div", { class: "filters__grid" }, [
            h("label", {}, [h("span", { class: "field-label" }, "Desde"), h("input", { type: "date", class: "text-field", value: f.start, onChange: (e) => update({ start: e.target.value }) })]),
            h("label", {}, [h("span", { class: "field-label" }, "Hasta"), h("input", { type: "date", class: "text-field", value: f.end, onChange: (e) => update({ end: e.target.value }) })]),
          ])
        );
      }
    }

    function update(patch, { keepFilters = false } = {}) {
      Object.assign(f, patch, { page: patch.page ?? 1 });
      if (!keepFilters) renderFilters();
      load();
    }

    let loadSeq = 0;
    async function load() {
      const seq = ++loadSeq;
      const p = params();
      if (p.start && p.end && p.start > p.end) {
        clear(listEl);
        listEl.append(h("p", { class: "empty-row" }, "La fecha inicial es posterior a la final."));
        return;
      }
      let res;
      try {
        res = await financialService.listMovements(p);
      } catch (err) {
        if (seq !== loadSeq) return;
        clear(listEl);
        listEl.append(h("p", { class: "empty-row" }, `No se pudieron cargar los movimientos: ${err.message}`));
        return;
      }
      if (seq !== loadSeq) return; // llegó una respuesta vieja: hay un filtro más nuevo
      meta.textContent = `${res.total} ${res.total === 1 ? "movimiento" : "movimientos"}`;
      clear(listEl);
      if (!res.data.length) {
        listEl.append(h("p", { class: "empty-row" }, res.total ? "No hay más resultados." : "No hay movimientos con estos filtros."));
      } else {
        listEl.append(...res.data.map((m, i) => MovementRow(m, { showPocket: all, delay: Math.min(i, 10) * 20, onClick: () => openEdit(m) })));
      }
      renderPager(res.total);
    }

    function renderPager(total) {
      clear(pagerEl);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (pages <= 1) return;
      const from = (f.page - 1) * PAGE_SIZE + 1;
      const to = Math.min(total, f.page * PAGE_SIZE);
      const prev = Button({ label: "Anterior", variant: "ghost", disabled: f.page <= 1, onClick: () => update({ page: f.page - 1 }, { keepFilters: true }) });
      const next = Button({ label: "Siguiente", variant: "ghost", disabled: f.page >= pages, onClick: () => update({ page: f.page + 1 }, { keepFilters: true }) });
      pagerEl.append(prev, h("span", { class: "pager__info" }, `${from}–${to} de ${total}`), next);
    }

    async function renderSummary() {
      if (!fixedTipo || !pocket) return;
      clear(summaryEl);
      const m = (await financialService.listPockets().catch(() => [])).find((x) => x.id === pocket.id)?.metrics;
      if (!m) return;
      if (fixedTipo === "aporte") {
        summaryEl.append(
          SummaryCard({ iconName: "trend", tone: "positive2", label: "Capital invertido", value: m.negocio?.capitalInvertido ?? 0 }),
          SummaryCard({ iconName: "in", tone: "positive", label: "Aportes del mes", value: m.periodo.aportes, delay: 40 })
        );
      } else {
        summaryEl.append(
          SummaryCard({ iconName: "wallet", tone: "warning", label: "Retiros acumulados", value: m.negocio?.retirosAcumulados ?? 0 }),
          SummaryCard({ iconName: "out", tone: "negative", label: "Retiros del mes", value: m.periodo.retiros, delay: 40 })
        );
      }
    }

    function openEdit(m) {
      editSheet.open(`Editar ${(m.tipo === "gasto" && findPocket(m.bolsillo_id)?.kind === "business" ? "egreso" : TIPO_LABEL[m.tipo]).toLowerCase()}`, EditMovementForm({
        movement: m,
        categories: categories.filter((c) => c.bolsillo_id === m.bolsillo_id && c.kind === (m.tipo === "ingreso" ? "income" : "expense")),
        onDone: () => {
          setTimeout(() => editSheet.close(), 300);
          window.dispatchEvent(new CustomEvent("bolsillo:refresh"));
        },
      }));
    }

    async function loadCategories() {
      const cats = await financialService.listCategories(bolsillo).catch(() => []);
      categories = cats.map((c) => {
        const p = all ? findPocket(c.bolsillo_id) : null;
        return { ...c, label: p ? `${c.name} · ${p.name}` : c.name };
      });
    }

    const titles = { aporte: "Inversión", retiro: "Retiros" };
    const notes = {
      aporte: "Dinero que metés al negocio para hacerlo crecer. Aumenta la caja y el capital invertido; no es una venta ni suma a la utilidad.",
      retiro: "Dinero que sacás de la caja del negocio para vos. No es un gasto del negocio ni resta de la utilidad.",
    };
    clear(pageEl);
    append(pageEl, 
      PageHeader({ eyebrow: all ? "Todos los bolsillos" : `${pocket?.icon} ${pocket?.name}`, title: fixedTipo ? titles[fixedTipo] : "Movimientos" }),
      fixedTipo ? h("p", { class: "form-note", style: "margin-top:calc(-1 * var(--space-3))" }, notes[fixedTipo]) : null,
      summaryEl,
      filtersEl,
      SectionTitle({ label: fixedTipo ? "Historial" : "Historial completo", meta }),
      listEl,
      pagerEl
    );

    await loadCategories();
    renderFilters();
    await Promise.all([load(), renderSummary()]);

    const onRefresh = () => {
      load();
      renderSummary();
    };
    window.addEventListener("bolsillo:refresh", onRefresh);
    return () => {
      clearTimeout(searchTimer);
      window.removeEventListener("bolsillo:refresh", onRefresh);
    };
  };
}

/** Edición/eliminación de un movimiento del historial (va a su tabla de origen). */
function EditMovementForm({ movement: m, categories, onDone }) {
  const isTransfer = m.origen === "transferencias";
  const state = {
    amount: String(Number(m.monto)),
    date: m.fecha,
    description: m.descripcion || "",
    method: m.metodo_pago || "",
    categoryId: m.category_id,
  };

  const amountField = AmountField({ value: state.amount, onChange: (v) => (state.amount = v) });
  const dateInput = h("input", { type: "date", class: "text-field", value: state.date, max: todayISO(), onInput: (e) => (state.date = e.target.value) });
  const descInput = h("input", { type: "text", class: "text-field", maxLength: 280, value: state.description, placeholder: "Descripción o nota", onInput: (e) => (state.description = e.target.value) });
  const catRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });
  const methodRow = h("div", { class: "flex flex-wrap gap-2 mb-4" });

  function renderCats() {
    clear(catRow);
    catRow.append(...categories.map((c) => Chip({ label: c.name, color: c.color, pressed: c.id === state.categoryId, onClick: () => ((state.categoryId = c.id), renderCats()) })));
  }
  function renderMethods() {
    clear(methodRow);
    methodRow.append(...PAYMENT_METHODS.map((x) => Chip({ label: x, color: "var(--ink)", pressed: state.method === x, onClick: () => ((state.method = state.method === x ? "" : x), renderMethods()) })));
  }

  const saveBtn = Button({ label: "Guardar cambios", fullWidth: true, type: "submit" });
  const deleteBtn = Button({
    label: "Eliminar movimiento",
    variant: "danger",
    fullWidth: true,
    onClick: async () => {
      const ok = await confirmAction({
        title: "¿Eliminar este movimiento?",
        message: `${fmtMoney(m.monto, findPocket(m.bolsillo_id)?.currency)} · ${m.descripcion || TIPO_LABEL[m.tipo]}. ${isTransfer ? "Se quita de los dos bolsillos. " : ""}No se puede deshacer.`,
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      try {
        if (m.origen === "ingresos") await financialService.deleteIncome(m.id);
        else if (m.origen === "gastos") await financialService.deleteExpense(m.id);
        else await financialService.deleteTransfer(m.id);
        showToast("Movimiento eliminado");
        onDone?.();
      } catch (err) {
        showToast(err.message || "No se pudo eliminar");
      }
    },
  });

  const form = h(
    "form",
    {
      novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        const amount = parseFloat(state.amount);
        if (!amount || amount <= 0) return shakeField(amountField);
        if (!state.date || state.date > todayISO()) return shakeField(dateInput);
        const payload = { amount, date: state.date, description: state.description.trim(), payment_method: state.method };
        setButtonState(saveBtn, "loading");
        try {
          if (m.origen === "ingresos") await financialService.updateIncome(m.id, { ...payload, category_id: state.categoryId });
          else if (m.origen === "gastos") await financialService.updateExpense(m.id, { ...payload, category_id: state.categoryId });
          else await financialService.updateTransfer(m.id, payload);
          showToast("Movimiento actualizado");
          setButtonState(saveBtn, "success");
          onDone?.();
        } catch (err) {
          setButtonState(saveBtn, "error");
          showToast(err.message || "No se pudo guardar");
          setTimeout(() => setButtonState(saveBtn, null), 900);
        }
      },
    },
    [
      h("p", { class: "field-label" }, "Monto"),
      h("div", { class: "mb-4" }, [amountField]),
      !isTransfer && categories.length ? h("p", { class: "field-label" }, "Categoría") : null,
      !isTransfer ? catRow : null,
      h("p", { class: "field-label" }, "Método de pago"),
      methodRow,
      h("div", { class: "form-grid mb-4" }, [
        h("label", {}, [h("span", { class: "field-label" }, "Fecha"), dateInput]),
        h("label", {}, [h("span", { class: "field-label" }, "Nota"), descInput]),
      ]),
      isTransfer ? h("p", { class: "form-note mb-4" }, "El tipo y los bolsillos de una transferencia no se cambian: si te equivocaste, eliminala y registrala de nuevo.") : null,
      saveBtn,
      h("div", { style: "margin-top:var(--space-2)" }, [deleteBtn]),
    ]
  );
  renderCats();
  renderMethods();
  return form;
}

export const renderMovimientos = makeMovementsPage();
export const renderInversion = makeMovementsPage({ fixedTipo: "aporte" });
export const renderRetiros = makeMovementsPage({ fixedTipo: "retiro" });
