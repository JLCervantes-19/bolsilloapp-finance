import { h } from "../utils/dom.js";
import { PASSWORD_RULES } from "../utils/passwordPolicy.js";

/**
 * Checklist en vivo debajo del campo de contraseña — cada regla se marca
 * en verde apenas se cumple, para que el usuario sepa exactamente qué le
 * falta antes de intentar enviar el formulario (evita el viaje al servidor
 * solo para volver con un error genérico).
 */
export function PasswordRules() {
  const items = new Map(PASSWORD_RULES.map((rule) => [rule.id, h("li", { class: "password-rule" }, [h("span", { class: "password-rule__dot" }), rule.label])]));

  const list = h(
    "ul",
    { class: "password-rules" },
    PASSWORD_RULES.map((rule) => items.get(rule.id))
  );

  function update(value) {
    for (const rule of PASSWORD_RULES) {
      const ok = rule.test(value);
      items.get(rule.id).classList.toggle("password-rule--ok", ok);
    }
  }

  update("");
  return { el: list, update };
}
