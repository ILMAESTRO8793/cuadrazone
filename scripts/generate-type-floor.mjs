/*
 * Genera client/src/styles/type-floor.css: sube a un mínimo legible los
 * tamaños de letra diminutos (7–11 px) declarados en las hojas de estilo
 * existentes, respetando sus selectores y media queries.
 *
 * Uso: node scripts/generate-type-floor.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const postcss = require(
  path.resolve("node_modules/.pnpm/postcss@8.5.6/node_modules/postcss")
);

const sources = [
  "client/src/index.css",
  "client/src/pages/marketplace/pages.css",
  "client/src/features/commerce/commerce.css",
  "client/src/features/catalog/seller-catalog.css",
  "client/src/features/membership/membership.css",
  "client/src/features/realEstate/realEstate.css",
  "client/src/features/jobs/jobs.css",
  "client/src/features/services/services.css",
];

// px de origen → px mínimo. Mantiene la jerarquía, solo la hace legible.
const floor = { 7: 11, 7.5: 11, 8: 11.5, 8.5: 11.5, 9: 12, 9.5: 12, 10: 12.5, 10.5: 13, 11: 13 };
const remFloor = px => (px < 11.5 ? floor[Math.round(px * 2) / 2] ?? null : null);

const toPx = value => {
  const v = value.trim();
  let m = v.match(/^([\d.]+)px$/);
  if (m) return Number(m[1]);
  m = v.match(/^([\d.]+)rem$/);
  if (m) return Number(m[1]) * 16;
  return null;
};

const out = postcss.root();
let count = 0;
for (const file of sources) {
  const css = fs.readFileSync(file, "utf8");
  const root = postcss.parse(css, { from: file });
  root.walkDecls("font-size", decl => {
    const px = toPx(decl.value);
    if (px === null) return;
    const target = remFloor(px);
    if (!target || target <= px) return;
    const rule = decl.parent;
    if (rule.type !== "rule") return;
    // Reconstruye la cadena de @media que envuelve la regla.
    const chain = [];
    let node = rule.parent;
    while (node && node.type !== "root") {
      if (node.type === "atrule") chain.unshift(node);
      node = node.parent;
    }
    let container = out;
    for (const at of chain) {
      const wrapper = postcss.atRule({ name: at.name, params: at.params });
      container.append(wrapper);
      container = wrapper;
    }
    container.append(
      postcss.rule({ selector: rule.selector }).append(
        postcss.decl({ prop: "font-size", value: `${target}px` })
      )
    );
    count++;
  });
}

const header = `/*
 * Generado por scripts/generate-type-floor.mjs — no editar a mano.
 * Sube a un mínimo legible ${count} tamaños de letra diminutos de las hojas
 * originales, con sus mismos selectores y media queries.
 */
`;
fs.mkdirSync("client/src/styles", { recursive: true });
fs.writeFileSync("client/src/styles/type-floor.css", header + out.toString() + "\n");
console.log(`type-floor.css: ${count} reglas`);
