/**
 * Paleta de Chart.js para el sistema Liquid Glass claro — los canvas no
 * pueden leer custom properties CSS directamente, así que estos valores
 * replican a mano los tokens de tokens.css (texto navy oscuro sobre claro,
 * grid casi invisible, positive=teal/negative=terracota).
 */
export const chartTheme = {
  textColor: "#12141c",
  tickColor: "rgba(18, 20, 28, 0.55)",
  gridColor: "rgba(18, 20, 28, 0.08)",
  positive: "#0ea894",
  negative: "#e8543f",
  fixed: "#4a4fd0",
  variable: "#c98a1c",
  lineColor: "#12141c",
  lineFillTop: "rgba(18, 20, 28, 0.12)",
  lineFillBottom: "rgba(18, 20, 28, 0)",
  donutBorder: "#eef1f6",
  legendLabels: { color: "#12141c", usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 11, weight: 600 } },
};
