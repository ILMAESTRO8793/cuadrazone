import React from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { BusinessCategoryPicker } from "../client/src/features/membership/BusinessCategoryPicker";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { and } from "drizzle-orm";
import {
  businessCategories,
  businessSelectionsInput,
  matchingBusinessSelections,
  readBusinessSelections,
} from "@shared/businessCategories";
import {
  storeDirectoryInput,
  storeDirectoryQuery,
  storeDirectoryHref,
  type DirectoryStore,
} from "@shared/storeDirectory";
import { directoryConditions } from "./services/storeDirectory";
import { renderPage } from "../client/src/entry-server";
import { serializePublicSnapshot } from "./services/publicSnapshot";

const source = fs.readFileSync(
  "docs/categorias-negocios-originales.md",
  "utf8"
);
const category = businessCategories.find(c => c.id === "hogar-y-construccion")!;
const specialty = category.specialties.find(
  s => s.label === "Plomería, electricidad y soldadura"
)!;
const selection = [{ categoryId: category.id, specialtyIds: [specialty.id] }];

describe("clasificación y directorio de negocios", () => {
  it("conserva los 11 grupos y las 103 especialidades (96 originales + 7 de educación)", () => {
    const labels = source
      .split(/\r?\n/)
      .filter(line => line.startsWith("**"))
      .map(line => line.replaceAll("**", ""));
    const specialties = source
      .split(/\r?\n/)
      .filter(line => line.startsWith("- "))
      .map(line => line.slice(2));
    expect(businessCategories.map(c => c.label)).toEqual(labels);
    expect(
      businessCategories.flatMap(c => c.specialties.map(s => s.label))
    ).toEqual(specialties);
    expect(labels).toHaveLength(11);
    expect(specialties).toHaveLength(103);
    expect(
      new Set(businessCategories.flatMap(c => c.specialties.map(s => s.id)))
        .size
    ).toBe(103);
  });
  it("acepta varias categorías con sus especialidades y rechaza mezclas y repetidos", () => {
    const travel = businessCategories[0];
    expect(
      businessSelectionsInput.parse([
        ...selection,
        { categoryId: travel.id, specialtyIds: [] },
      ])
    ).toHaveLength(2);
    expect(() =>
      businessSelectionsInput.parse([...selection, ...selection])
    ).toThrow(/repitas/);
    expect(() =>
      businessSelectionsInput.parse([
        { categoryId: travel.id, specialtyIds: [specialty.id] },
      ])
    ).toThrow(/pertenece/);
    expect(() =>
      businessSelectionsInput.parse([
        { categoryId: category.id, specialtyIds: [specialty.id, specialty.id] },
      ])
    ).toThrow(/repitas/);
    expect(() => businessSelectionsInput.parse([])).toThrow(/categoría/);
  });
  it("normaliza expedientes anteriores sin asignarles categorías inventadas ni divulgar datos privados", () => {
    expect(readBusinessSelections(null)).toEqual([]);
    expect(readBusinessSelections({ identificationNumber: "PRIVADO" })).toEqual(
      []
    );
    expect(
      readBusinessSelections({
        businessCategories: selection,
        identificationNumber: "PRIVADO",
        contactEmail: "privado@example.test",
      })
    ).toEqual(selection);
    expect(
      JSON.stringify(
        readBusinessSelections({
          businessCategories: selection,
          identificationNumber: "PRIVADO",
        })
      )
    ).not.toContain("PRIVADO");
  });
  it("encuentra especialidades sin exigir tildes y conserva filtros en URL", () => {
    expect(matchingBusinessSelections("plomeria")).toContainEqual(selection[0]);
    expect(matchingBusinessSelections("tramites")[0]?.categoryId).toBe(
      "tramites-y-oficina"
    );
    const search = `?category=${category.id}&specialty=${specialty.id}&province=Panam%C3%A1&q=negocio`;
    const input = storeDirectoryInput.parse(storeDirectoryQuery(search));
    expect(input).toMatchObject({
      category: category.id,
      specialty: specialty.id,
      province: "Panamá",
      q: "negocio",
    });
    const href = storeDirectoryHref(search, {
      category: "viajes-y-turismo",
      specialty: undefined,
    });
    expect(href).toContain("province=");
    expect(href).not.toContain("specialty=");
    expect(() =>
      storeDirectoryInput.parse({
        category: "viajes-y-turismo",
        specialty: specialty.id,
      })
    ).toThrow(/pertenece/);
  });
  it("consulta categorías/especialidades con SQL parametrizado y las seis guardas de tienda activa", () => {
    const dialect = new MySqlDialect();
    const compiled = dialect.sqlToQuery(
      and(
        ...directoryConditions(
          storeDirectoryInput.parse({
            category: category.id,
            specialty: specialty.id,
            q: "plomeria",
            cursor: 80,
          })
        )
      )!
    );
    expect(compiled.sql).toContain("json_contains");
    expect(compiled.sql).toContain("emailVerifiedAt");
    expect(compiled.sql).toContain("phoneVerifiedAt");
    expect(compiled.sql).toContain("contactEmail");
    expect(compiled.sql).toContain("contactPhone");
    expect(compiled.params).toContain("approved");
    expect(compiled.params).toContain("active");
    expect(compiled.params).toContain(JSON.stringify(selection));
    expect(compiled.sql).not.toContain(specialty.id);
    expect(compiled.params).toContain(80);
  });
  it("entrega filtros, categorías y vacío real en HTML sin login ni empresas de ejemplo", () => {
    const result = renderPage(`/tiendas?category=${category.id}`, {
      url: `/tiendas?category=${category.id}`,
      directory: { items: [], nextCursor: null },
    });
    expect(result.meta.status).toBe(200);
    expect(result.meta.private).toBe(false);
    expect(result.html).toContain("Encuentra el talento de tu comunidad");
    expect(result.html).toContain("No hay tiendas activas con estos filtros");
    for (const c of businessCategories) expect(result.html).toContain(c.label);
    expect(result.html).not.toContain("Cargando tiendas de la comunidad");
  });
  it("renderiza solo el DTO público con enlaces a la categoría registrada", () => {
    const store: DirectoryStore = {
      id: 77,
      slug: "solo-fixture-unitaria",
      name: "Negocio de prueba unitaria",
      description: "No se inserta en DB",
      city: "Panamá",
      province: "Panamá",
      churchName: "Iglesia",
      verified: true,
      businessCategories: selection,
    };
    const html = renderPage("/tiendas", {
      url: "/tiendas",
      directory: { items: [store], nextCursor: null },
    }).html;
    expect(html).toContain("Negocio de prueba unitaria");
    expect(html).toContain("Plomería, electricidad y soldadura");
    expect(html).toContain(`/tiendas?category=${category.id}`);
    expect(html).not.toContain("No hay tiendas activas con estos filtros");
    const json = serializePublicSnapshot({
      directory: { items: [store], nextCursor: null },
    });
    for (const privateField of [
      "identificationNumber",
      "contactPhone",
      "contactEmail",
      "pastorName",
      "bytes",
      "details",
      "userId",
    ])
      expect(json).not.toContain(privateField);
  });
  it("distingue errores, filtros inválidos y carga de un vacío verdadero", () => {
    expect(renderPage("/tiendas").html).toContain(
      "Cargando tiendas de la comunidad"
    );
    const failed = renderPage("/tiendas", { url: "/tiendas", failed: true });
    expect(failed.meta.status).toBe(503);
    expect(failed.html).toContain("No pudimos cargar las tiendas");
    expect(failed.html).not.toContain(
      "No hay tiendas activas con estos filtros"
    );
    const invalid = renderPage("/tiendas?category=invalida", {
      url: "/tiendas?category=invalida",
      badRequest: "Categoría de negocio no válida",
    });
    expect(invalid.meta.status).toBe(400);
    expect(invalid.html).toContain("Categoría de negocio no válida");
  });
});

describe("selector visible de categorías", () => {
  it("muestra grupos y especialidades seleccionadas sin convertirlos en negocios reales", () => {
    const html = renderToString(
      React.createElement(Router, {
        ssrPath: "/solicitud-vendedor",
        children: React.createElement(BusinessCategoryPicker, {
          value: selection,
          onChange: () => undefined,
          disabled: false,
        }),
      })
    );
    for (const c of businessCategories) expect(html).toContain(c.label);
    expect(html).toContain(specialty.label);
    expect(html.replace(/<!--.*?-->/g, "")).toContain(
      "1 categoría seleccionada"
    );
    expect(html).toContain("checked");
    expect(html).toContain(`/tiendas?category=${category.id}`);
  });
});
