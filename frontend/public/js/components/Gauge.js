import { h } from "../utils/dom.js";

const TAG_TONE = { Excelente: "positive", "Muy bueno": "positive", Regular: "warning", Atención: "negative" };

/** Arco semicircular 0-100 con animación de trazo al entrar. */
export function Gauge({ score, tag }) {
  const radius = 26;
  const circumference = Math.PI * radius; // medio círculo
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 68 40");
  svg.setAttribute("width", "68");
  svg.setAttribute("height", "40");

  const track = document.createElementNS(svgNS, "path");
  track.setAttribute("d", "M 8 34 A 26 26 0 0 1 60 34");
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "var(--glass-border-strong)");
  track.setAttribute("stroke-width", "5");
  track.setAttribute("stroke-linecap", "round");

  const fill = document.createElementNS(svgNS, "path");
  fill.setAttribute("d", "M 8 34 A 26 26 0 0 1 60 34");
  fill.setAttribute("fill", "none");
  fill.setAttribute("stroke", `var(--${TAG_TONE[tag] === "negative" ? "negative" : TAG_TONE[tag] === "warning" ? "warning" : "positive"})`);
  fill.setAttribute("stroke-width", "5");
  fill.setAttribute("stroke-linecap", "round");
  fill.setAttribute("stroke-dasharray", String(circumference));
  fill.setAttribute("stroke-dashoffset", String(circumference));
  fill.style.transition = "stroke-dashoffset 900ms var(--ease-spring)";

  svg.appendChild(track);
  svg.appendChild(fill);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.setAttribute("stroke-dashoffset", String(circumference * (1 - score / 100)));
    });
  });

  return h("div", { class: "gauge" }, [svg, h("p", { class: "gauge__tag" }, [h("strong", {}, String(score)), ` · ${tag}`])]);
}
