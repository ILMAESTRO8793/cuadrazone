import { ShippingNote } from "@/lib/ShippingNote";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BadgeCheck, Package, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  usePublicCatalog,
  type RealProduct,
} from "@/contexts/PublicCatalogContext";
import { usd } from "@/lib/liveCatalog";
import { RequestError, RealProductCard } from "./PublicCatalogPages";
function Feedback({ product }: { product: RealProduct }) {
  const auth = useAuth();
  const { mounted } = usePublicCatalog();
  const utils = trpc.useUtils();
  const reviews = trpc.commerce.reviews.useQuery(
    { productId: product.id },
    { enabled: mounted }
  );
  const questions = trpc.commerce.questions.useQuery(
    { productId: product.id },
    { enabled: mounted }
  );
  const eligibility = trpc.commerce.reviewEligibility.useQuery(
    { productId: product.id },
    { enabled: mounted && !auth.loading && Boolean(auth.user) }
  );
  const shop = trpc.catalog.myStore.useQuery(undefined, {
    enabled: mounted && !auth.loading && Boolean(auth.user),
  });
  const canReview = eligibility.data?.canReview === true;
  const canAnswer = shop.data?.store?.id === product.store.id;
  const [question, setQuestion] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [rating, setRating] = useState(5);
  const ask = trpc.commerce.askQuestion.useMutation({
    onSuccess: () => {
      setQuestion("");
      questions.refetch();
      toast.success("Pregunta enviada");
    },
    onError: e => toast.error(e.message),
  });
  const review = trpc.commerce.review.useMutation({
    onSuccess: () => {
      setReviewBody("");
      reviews.refetch();
      eligibility.refetch();
      utils.catalog.list.invalidate();
      utils.catalog.detail.invalidate();
      toast.success("Reseña guardada");
    },
    onError: e => toast.error(e.message),
  });
  const reply = trpc.commerce.answerQuestion.useMutation({
    onSuccess: () => questions.refetch(),
    onError: e => toast.error(e.message),
  });
  return (
    <div className="live-feedback">
      <section className="live-panel">
        <h2>Reseñas de compras verificadas</h2>
        {reviews.error && (
          <RequestError
            message={reviews.error.message}
            retry={() => reviews.refetch()}
          />
        )}
        {reviews.data?.map(r => (
          <article className="live-feedback-item" key={r.id}>
            <strong>{r.rating} / 5 · Compra verificada</strong>
            <p>{r.body}</p>
          </article>
        ))}
        {!reviews.data && !reviews.error && (
          <p role="status">Cargando reseñas…</p>
        )}
        {reviews.data && reviews.data.length === 0 && (
          <p>Todavía no hay reseñas de compras entregadas.</p>
        )}
        {eligibility.error && (
          <RequestError
            message={eligibility.error.message}
            retry={() => eligibility.refetch()}
          />
        )}
        {eligibility.data?.review && (
          <div className="live-notice">
            <strong>Ya compartiste tu experiencia</strong>
            <p>Tu calificación: {eligibility.data.review.rating} / 5</p>
            <p>{eligibility.data.review.body}</p>
          </div>
        )}
        {canReview ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              review.mutate({
                productId: product.id,
                rating,
                body: reviewBody.trim(),
              });
            }}
          >
            <label>
              Tu calificación
              <select
                value={rating}
                onChange={e => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>
                    {n} estrellas
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tu experiencia
              <textarea
                required
                maxLength={4000}
                value={reviewBody}
                onChange={e => setReviewBody(e.target.value)}
              />
            </label>
            <button
              className="btn btn-gold"
              disabled={review.isPending || !reviewBody.trim()}
            >
              Publicar reseña
            </button>
          </form>
        ) : (
          <p className="live-muted">
            {eligibility.data?.reason === "own_store"
              ? "No puedes reseñar artículos de tu propia tienda."
              : eligibility.data?.reason === "already_reviewed"
                ? "Solo se permite una reseña por comprador y artículo."
                : auth.user && !eligibility.data && !eligibility.error
                  ? "Comprobando tus compras entregadas…"
                  : "Solo puedes reseñar este artículo después de recibir un pedido real. El servidor comprueba la compra sin limitarse a tus pedidos recientes."}
          </p>
        )}
      </section>
      <section className="live-panel" id="preguntas">
        <h2>Preguntas a la tienda</h2>
        {questions.error && (
          <RequestError
            message={questions.error.message}
            retry={() => questions.refetch()}
          />
        )}
        {questions.data?.map(q => (
          <article key={q.id} className="live-feedback-item">
            <p>
              <strong>Pregunta:</strong> {q.body}
            </p>
            {q.answerBody ? (
              <p>
                <strong>Vendedor:</strong> {q.answerBody}
              </p>
            ) : canAnswer ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const body = String(
                    new FormData(e.currentTarget).get("answer") ?? ""
                  ).trim();
                  if (body) reply.mutate({ id: q.id, body });
                }}
              >
                <label>
                  Tu respuesta
                  <textarea name="answer" required maxLength={4000} />
                </label>
                <button className="btn btn-outline" disabled={reply.isPending}>
                  Responder
                </button>
              </form>
            ) : (
              <small>Pendiente de respuesta</small>
            )}
          </article>
        ))}
        {!questions.data && !questions.error && (
          <p role="status">Cargando preguntas…</p>
        )}
        {questions.data?.length === 0 && (
          <p>¿Necesitas un detalle antes de comprar?</p>
        )}
        {auth.user ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              ask.mutate({ productId: product.id, body: question.trim() });
            }}
          >
            <label>
              Tu pregunta pública
              <textarea
                required
                maxLength={4000}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="No incluyas teléfono, dirección ni datos de identidad."
              />
            </label>
            <button
              className="btn btn-gold"
              disabled={ask.isPending || !question.trim()}
            >
              Enviar pregunta
            </button>
          </form>
        ) : (
          <Link href="/mi-cuenta" className="btn btn-outline">
            Entrar para preguntar
          </Link>
        )}
      </section>
    </div>
  );
}
export function RealDetailPage({ slug }: { slug: string }) {
  const { snapshot, mounted } = usePublicCatalog();
  const auth = useAuth();
  const [, navigate] = useLocation();
  const product = trpc.catalog.detail.useQuery(
    { slug },
    {
      initialData:
        snapshot.product?.slug === slug ? snapshot.product : undefined,
      enabled: mounted,
    }
  );
  const utils = trpc.useUtils();
  const add = trpc.commerce.addCart.useMutation({
    onSuccess: () => {
      utils.commerce.cart.invalidate();
      toast.success("Añadido a tu carrito guardado");
    },
    onError: e => toast.error(e.message),
  });
  const [variantId, setVariantId] = useState<number>();
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState(0);
  const p = product.data;
  const related = trpc.catalog.list.useQuery(
    { category: p?.category, limit: 5 },
    { enabled: mounted && Boolean(p) }
  );
  useEffect(() => {
    setVariantId(undefined);
    setQuantity(1);
    setPhoto(0);
  }, [slug]);
  useEffect(() => {
    if (p) {
      document.title = `${p.title} | CuadraZone`;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", p.description);
    }
  }, [p]);
  if (product.error)
    return (
      <div className="live-page container">
        <RequestError
          message={product.error.message}
          retry={() => product.refetch()}
        />
        <Link href="/mercado" className="btn btn-gold">
          Volver al catálogo
        </Link>
      </div>
    );
  if (!p)
    return (
      <div className="live-page container">
        <h1>Artículo no disponible</h1>
        <p>
          La publicación debe existir y pertenecer a una tienda aprobada y
          activa.
        </p>
        <Link href="/mercado" className="btn btn-gold">
          Explorar catálogo real
        </Link>
      </div>
    );
  const variant =
    p.variants.find(v => v.id === variantId) ??
    p.variants.find(v => v.stock > 0) ??
    p.variants[0];
  return (
    <div className="live-page container">
      <Link href="/mercado">← Catálogo real</Link>
      <div className="live-detail">
        <section className="live-gallery">
          <div className="live-detail-photo">
            {p.images[photo] ? (
              <img src={p.images[photo]} alt={p.title} />
            ) : (
              <Package size={70} aria-label="Sin fotografía" />
            )}
          </div>
          <div className="live-thumbnails">
            {p.images.map((image, i) => (
              <button
                className={photo === i ? "is-active" : ""}
                key={image}
                aria-label={`Ver foto ${i + 1}`}
                onClick={() => setPhoto(i)}
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        </section>
        <section className="live-detail-copy">
          <p className="eyebrow">
            {p.kind === "book" ? "LIBRO CRISTIANO" : p.category}
          </p>
          <h1>{p.title}</h1>
          <Link className="live-verified" href={`/tiendas/${p.store.slug}`}>
            <BadgeCheck size={20} />
            {p.store.name} · Vendedor verificado
          </Link>
          <p>
            <Star size={16} />{" "}
            {p.reviewCount
              ? `${p.rating.toFixed(1)} / 5 · ${p.reviewCount} reseñas`
              : "Sin reseñas todavía"}
          </p>
          <strong className="live-detail-price">
            {usd(variant?.priceCents ?? p.priceCents)}
          </strong>
          <p className="live-description">{p.description}</p>
          {p.book && (
            <dl className="live-book-meta">
              {[
                ["Autor", p.book.author],
                ["Editorial", p.book.publisher],
                ["ISBN", p.book.isbn],
                ["Idioma", p.book.language],
                ["Formato", p.book.format],
                ["Estado", p.book.condition === "used" ? "Usado" : "Nuevo"],
              ].map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value || "No indicado"}</dd>
                </div>
              ))}
            </dl>
          )}
          <label>
            Variante
            <select
              value={variant?.id ?? ""}
              onChange={e => {
                setVariantId(Number(e.target.value));
                setQuantity(1);
              }}
            >
              {p.variants.map(v => (
                <option key={v.id} value={v.id}>
                  {[v.size, v.color].filter(Boolean).join(" / ") ||
                    "Presentación estándar"}{" "}
                  · {v.stock} disponibles · {usd(v.priceCents)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input
              type="number"
              min={1}
              max={Math.min(20, variant?.stock ?? 0)}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            className="btn btn-gold btn-wide"
            disabled={
              add.isPending ||
              !variant ||
              variant.stock === 0 ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > Math.min(20, variant.stock)
            }
            onClick={() => {
              if (!auth.user) navigate("/mi-cuenta");
              else if (variant) add.mutate({ variantId: variant.id, quantity });
            }}
          >
            <ShoppingBag size={19} />
            {variant?.stock ? "Añadir al carrito" : "Agotado"}
          </button>
          <Link href="/mi-carrito" className="btn btn-outline btn-wide">
            Ver mi carrito guardado
          </Link>
          <div className="live-notice">
            <strong>Entrega desde {p.store.province}</strong>
            <ShippingNote store={p.store} modes={p.deliveryModes} />
            <p>
              {p.deliveryModes
                .map(mode =>
                  mode === "pickup"
                    ? "Retiro personal"
                    : mode === "shipping"
                      ? "Envío"
                      : "A domicilio"
                )
                .join(" · ")}
            </p>
            <small>
              Pago directo pendiente; la integración electrónica se conectará en
              su etapa. No se cobra una mensualidad al comprador.
            </small>
          </div>
        </section>
      </div>
      <Feedback key={p.id} product={p} />
      <h2>También en esta categoría</h2>
      {related.error && (
        <RequestError
          message="No pudimos cargar artículos relacionados."
          retry={() => related.refetch()}
        />
      )}
      {related.data?.items.filter(item => item.id !== p.id).length === 0 && (
        <p className="live-muted">
          Todavía no hay otros artículos activos en esta categoría.
        </p>
      )}
      <div className="live-product-grid">
        {related.data?.items
          .filter(item => item.id !== p.id)
          .slice(0, 4)
          .map(item => (
            <RealProductCard key={item.id} product={item} />
          ))}
      </div>
    </div>
  );
}
