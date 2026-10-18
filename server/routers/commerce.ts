import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addCartInput, answerQuestionInput, checkoutInput, conversationsQuery, favoriteInput,
  messagesInput, notificationsQuery, ordersQuery, questionQuery, questionInput,
  readNotificationInput, removeCartInput, reviewInput, reviewsQuery, sendMessageInput,
  setCartQuantityInput, transitionOrderInput,
} from "@shared/commerce";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as commerce from "../services/commerce";

function call<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch(error => {
    if (error instanceof commerce.CommerceError) {
      const code = error.code === "BAD_REQUEST" ? "BAD_REQUEST" : error.code === "NOT_FOUND" ? "NOT_FOUND" : error.code === "FORBIDDEN" ? "FORBIDDEN" : error.code === "CONFLICT" ? "CONFLICT" : "PRECONDITION_FAILED";
      throw new TRPCError({ code, message: error.message });
    }
    if (error instanceof TRPCError) throw error;
    console.error("[commerce] operation failed", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo completar la operación" });
  });
}

const productIdInput = z.object({ productId: z.number().int().positive() }).strict();

export const commerceRouter = router({
  cart: protectedProcedure.query(({ ctx }) => call(() => commerce.getCart(ctx.user.id))),
  addCart: protectedProcedure.input(addCartInput).mutation(({ ctx, input }) => call(() => commerce.addCart(ctx.user.id, input.variantId, input.quantity))),
  setCartQuantity: protectedProcedure.input(setCartQuantityInput).mutation(({ ctx, input }) => call(() => commerce.setCartQuantity(ctx.user.id, input.id, input.quantity))),
  removeCart: protectedProcedure.input(removeCartInput).mutation(({ ctx, input }) => call(() => commerce.removeCart(ctx.user.id, input.id))),

  favorites: protectedProcedure.query(({ ctx }) => call(() => commerce.listFavorites(ctx.user.id))),
  toggleFavorite: protectedProcedure.input(favoriteInput).mutation(({ ctx, input }) => call(() => commerce.toggleFavorite(ctx.user.id, input.productId))),

  checkout: protectedProcedure.input(checkoutInput).mutation(({ ctx, input }) => call(() => commerce.checkout(ctx.user.id, input))),
  orders: protectedProcedure.input(ordersQuery).query(({ ctx, input }) => call(() => commerce.listOrders(ctx.user.id, input.status, false, input.limit))),
  sellerOrders: protectedProcedure.input(ordersQuery).query(({ ctx, input }) => call(() => commerce.listOrders(ctx.user.id, input.status, true, input.limit))),
  order: protectedProcedure.input(z.object({ id: z.number().int().positive() }).strict()).query(({ ctx, input }) => call(() => commerce.getOrder(ctx.user.id, input.id))),
  transitionOrder: protectedProcedure.input(transitionOrderInput).mutation(({ ctx, input }) => call(() => commerce.transitionOrder(ctx.user.id, input.id, input.status))),

  reviews: publicProcedure.input(reviewsQuery).query(({ input }) => call(() => commerce.listReviews(input.productId))),
  reviewEligibility: protectedProcedure.input(reviewsQuery).query(({ ctx, input }) => call(() => commerce.reviewEligibility(ctx.user.id, input.productId))),
  review: protectedProcedure.input(reviewInput).mutation(({ ctx, input }) => call(() => commerce.createReview(ctx.user.id, input.productId, input.rating, input.body))),
  questions: publicProcedure.input(questionQuery).query(({ input }) => call(() => commerce.listQuestions(input.productId))),
  askQuestion: protectedProcedure.input(questionInput).mutation(({ ctx, input }) => call(() => commerce.askQuestion(ctx.user.id, input.productId, input.body))),
  answerQuestion: protectedProcedure.input(answerQuestionInput).mutation(({ ctx, input }) => call(() => commerce.answerQuestion(ctx.user.id, input.id, input.body))),

  conversations: protectedProcedure.input(conversationsQuery).query(({ ctx, input }) => call(() => commerce.conversations(ctx.user.id, input.limit))),
  messages: protectedProcedure.input(messagesInput).query(({ ctx, input }) => call(() => commerce.messages(ctx.user.id, input.conversationId, input.limit))),
  sendMessage: protectedProcedure.input(sendMessageInput).mutation(({ ctx, input }) => call(() => commerce.sendMessage(ctx.user.id, input))),
  notifications: protectedProcedure.input(notificationsQuery).query(({ ctx, input }) => call(() => commerce.notifications(ctx.user.id, input.unreadOnly, input.limit))),
  readNotification: protectedProcedure.input(readNotificationInput).mutation(({ ctx, input }) => call(() => commerce.readNotification(ctx.user.id, input.id))),
});
