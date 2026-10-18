import { describe, expect, it } from "vitest";
import {
  addCartInput,
  assertCheckoutTotal,
  calculateSubtotal,
  canTransitionOrder,
  checkoutInput,
  deriveReviewEligibility,
  MAX_MONEY_CENTS,
  paymentStatusFor,
  assertSafeQuantity,
  sameCheckoutPayload,
  stableVariantOrder,
} from "@shared/commerce";
import { affectedRows, deliveryQuote } from "./services/commerce";

/**
 * These tests deliberately exercise pure guards only. Live DB integration tests
 * must run against the configured managed DB and real authenticated fixtures;
 * this file never seeds users, sellers, subscriptions or fake orders.
 */
describe("CuadraZone commerce invariants", () => {
  it("calcula dinero únicamente en centavos y sin tarifas cliente", () => {
    expect(calculateSubtotal([{ priceCents: 1299, quantity: 2 }, { priceCents: 500, quantity: 1 }])).toBe(3098);
    expect(paymentStatusFor("yappy")).toBe("awaiting_payment");
    expect(paymentStatusFor("transfer")).toBe("awaiting_payment");
    expect(paymentStatusFor("cod")).toBe("pending");
  });

  it("limita cantidades y evita inventario negativo", () => {
    expect(() => assertSafeQuantity(1, 1)).not.toThrow();
    expect(() => assertSafeQuantity(20, 20)).not.toThrow();
    expect(() => assertSafeQuantity(21, 50)).toThrow();
    expect(() => assertSafeQuantity(2, 1)).toThrow(/Inventario/);
  });

  it("mantiene transiciones separadas por actor", () => {
    expect(canTransitionOrder("pending", "confirmed", "seller")).toBe(true);
    expect(canTransitionOrder("confirmed", "shipped", "seller")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered", "buyer")).toBe(true);
    expect(canTransitionOrder("pending", "delivered", "buyer")).toBe(false);
    expect(canTransitionOrder("shipped", "cancelled", "seller")).toBe(false);
    expect(canTransitionOrder("delivered", "cancelled", "buyer")).toBe(false);
    expect(canTransitionOrder("confirmed", "cancelled", "buyer")).toBe(true);
  });

  it("rechaza payload de checkout sin UUID o con entrega duplicada a nivel de contrato", () => {
    expect(() => checkoutInput.parse({
      checkoutKey: "no-es-uuid", recipientName: "A", phone: "60000000", province: "Panamá",
      city: "Panamá", address: "privada", deliveries: [{ storeId: 1, mode: "pickup" }], paymentMethod: "cod",
    })).toThrow();
    const valid = checkoutInput.parse({
      checkoutKey: "3b241101-e2bb-4255-8caf-4136c566a962", expectedTotalCents: 0, recipientName: "A", phone: "60000000", province: "Panamá",
      city: "Panamá", address: "privada", deliveries: [{ storeId: 1, mode: "pickup" }], paymentMethod: "cod",
    });
    expect(valid.expectedTotalCents).toBe(0);
    expect(() => checkoutInput.parse({
      checkoutKey: "3b241101-e2bb-4255-8caf-4136c566a962", expectedTotalCents: 0, recipientName: "A", phone: "60000000", province: "Panamá",
      city: "Panamá", address: "privada", deliveries: [{ storeId: 1, mode: "pickup" }, { storeId: 1, mode: "pickup" }], paymentMethod: "cod",
    })).toThrow(/Entrega repetida/);
  });

  it("no permite cantidades cliente fuera del rango del carrito", () => {
    expect(() => addCartInput.parse({ variantId: 1, quantity: 0 })).toThrow();
    expect(() => addCartInput.parse({ variantId: 1, quantity: 20 })).not.toThrow();
  });

  it("hace replay solo con el mismo payload y ordena locks de inventario", () => {
    const input = { recipientName: "A", phone: "60000000", province: "Panamá", city: "Panamá", address: "privada", paymentMethod: "cod" as const,
      deliveries: [{ storeId: 20, mode: "pickup" as const }, { storeId: 3, mode: "pickup" as const }] };
    const previous = [
      { storeId: 3, deliveryMode: "pickup" as const, paymentMethod: "cod" as const, recipientName: "A", phone: "60000000", province: "Panamá", city: "Panamá", address: "privada" },
      { storeId: 20, deliveryMode: "pickup" as const, paymentMethod: "cod" as const, recipientName: "A", phone: "60000000", province: "Panamá", city: "Panamá", address: "privada" },
    ];
    expect(sameCheckoutPayload(input, previous)).toBe(true);
    expect(sameCheckoutPayload({ ...input, address: "otra dirección" }, previous)).toBe(false);
    expect(stableVariantOrder([19, 2, 19, 7])).toEqual([2, 7, 19, 19]);
  });

  it("lee affectedRows tanto del ResultSetHeader directo como del tuple de MySQL", () => {
    expect(affectedRows({ affectedRows: 1 })).toBe(1);
    expect(affectedRows([{ affectedRows: 1 }, []])).toBe(1);
    expect(affectedRows([{ insertId: 42 }, []])).toBe(0);
  });

  it("cotiza retiro, tarifa cero y cobertura sin confundir null con cero", () => {
    const store = { shippingFeeCents: 0, homeFeeCents: null, deliveryProvinces: ["Panamá"] };
    expect(deliveryQuote(store, "pickup", "Darién")).toBe(0);
    expect(deliveryQuote(store, "shipping", "Panamá")).toBe(0);
    expect(() => deliveryQuote(store, "home", "Panamá")).toThrow();
    expect(() => deliveryQuote(store, "shipping", "Darién")).toThrow();
  });

  it("valida total esperado, enteros y límite monetario", () => {
    expect(() => assertCheckoutTotal(3098, 3098)).not.toThrow();
    expect(() => assertCheckoutTotal(3098, 3099)).toThrow();
    expect(() => assertCheckoutTotal(1.5, 1.5)).toThrow();
    expect(() => assertCheckoutTotal(0, MAX_MONEY_CENTS + 1)).toThrow();
  });

  it("deriva elegibilidad sin exponer identidad del usuario", () => {
    const review = { id: 4, rating: 5, body: "Muy bueno", createdAt: new Date("2026-01-01T00:00:00.000Z") };
    expect(deriveReviewEligibility(true, true, null)).toEqual({ canReview: false, reason: "own_store", review: null });
    expect(deriveReviewEligibility(false, false, null)).toEqual({ canReview: false, reason: "not_delivered", review: null });
    expect(deriveReviewEligibility(false, true, review)).toEqual({ canReview: false, reason: "already_reviewed", review });
    expect(deriveReviewEligibility(false, true, null)).toEqual({ canReview: true, reason: "eligible", review: null });
  });
});
