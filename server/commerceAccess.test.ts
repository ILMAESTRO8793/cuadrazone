import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const anonymous = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
describe("acceso privado del marketplace", () => {
  it("rechaza consultas de carrito, deseos, pedidos, mensajes y tienda sin sesión", async () => {
    for (const query of [() => anonymous.commerce.cart(), () => anonymous.commerce.favorites(), () => anonymous.commerce.orders({}), () => anonymous.commerce.sellerOrders({}), () => anonymous.commerce.messages({ conversationId: 1 }), () => anonymous.catalog.myStore(), () => anonymous.commerce.reviewEligibility({ productId: 1 })]) await expect(query()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rechaza mutaciones antes de tocar inventario, pedidos o publicaciones", async () => {
    await expect(anonymous.commerce.addCart({ variantId: 1, quantity: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.commerce.transitionOrder({ id: 1, status: "delivered" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.commerce.review({ productId: 1, rating: 5, body: "Prueba sin sesión" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.catalog.setStatus({ id: 1, expectedRevision: 1, status: "published" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
