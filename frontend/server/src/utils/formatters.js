/**
 * Réplica exacta de `fmt()` en Bolsillo App.dc.html — peso colombiano sin
 * decimales, punto como separador de miles. El frontend es dueño del
 * formato visual; el backend solo lo replica en los mensajes de texto que
 * genera el Recommendation Engine (los `alerts.message`).
 */
export function formatCOP(amount) {
  return "$" + Math.round(amount).toLocaleString("es-CO");
}
