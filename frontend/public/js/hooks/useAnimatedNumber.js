const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Anima el conteo de un nodo de texto desde su valor actual hasta `to`,
 * formateando cada frame con `format`. Usado en las summary cards para que
 * los montos "cuenten" al llegar en vez de aparecer de golpe.
 */
export function animateNumber(el, to, { from = 0, duration = 900, format = (n) => String(Math.round(n)) } = {}) {
  if (prefersReducedMotion) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3); // ease-out cubic

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    const value = from + (to - from) * ease(progress);
    el.textContent = format(value);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
