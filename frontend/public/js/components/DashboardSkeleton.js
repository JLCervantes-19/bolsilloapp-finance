import { h } from "../utils/dom.js";

/**
 * Esqueleto con la misma forma que el dashboard real (header, 10 cards en
 * fila horizontal, hero, 3 chart-cards) — evita el salto de layout que deja
 * un placeholder genérico y hace sentir la carga inicial intencional.
 */
export function DashboardSkeleton() {
  const summaryCard = () => h("div", { class: "summary-card glass", style: "gap:10px" }, [
    h("div", { class: "skeleton", style: "width:32px;height:32px;border-radius:11px" }),
    h("div", { class: "skeleton", style: "width:70%;height:11px" }),
    h("div", { class: "skeleton", style: "width:85%;height:20px;margin-top:auto" }),
  ]);

  const chartCard = (tall) =>
    h("div", { class: "chart-card glass" }, [
      h("div", { class: "skeleton", style: "width:45%;height:14px;margin-bottom:8px" }),
      h("div", { class: "skeleton", style: "width:30%;height:10px;margin-bottom:16px" }),
      h("div", { class: "skeleton", style: `height:${tall ? 220 : 180}px;border-radius:16px` }),
    ]);

  return h("div", { class: "dashboard-skeleton" }, [
    h("header", { class: "page-header" }, [
      h("div", {}, [h("div", { class: "skeleton", style: "width:120px;height:14px;margin-bottom:8px" }), h("div", { class: "skeleton", style: "width:160px;height:28px" })]),
      h("div", { class: "flex items-center gap-3" }, [
        h("div", { class: "skeleton", style: "width:78px;height:36px;border-radius:999px" }),
        h("div", { class: "skeleton", style: "width:38px;height:38px;border-radius:50%" }),
      ]),
    ]),
    h("div", { class: "skeleton", style: "width:160px;height:14px;margin:24px 0 12px" }),
    h("section", { class: "summary-row no-scrollbar" }, Array.from({ length: 6 }, summaryCard)),
    h("div", { class: "skeleton", style: "max-width:420px;height:150px;border-radius:28px;margin-top:20px" }),
    h("div", { class: "skeleton", style: "width:110px;height:14px;margin:24px 0 12px" }),
    h("section", { class: "summary-grid" }, [chartCard(), chartCard(), h("div", { style: "grid-column:1 / -1" }, [chartCard(true)])]),
  ]);
}
