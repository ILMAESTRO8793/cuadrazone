import { PublicPlaceMap } from "@/components/maps/Maps";
import { StoreBrandBadge } from "@/components/marketplace/StoreBrand";
import { StoreStars } from "@/components/marketplace/VerificationStars";
import { StoreLogo } from "@/components/marketplace/StoreLogo";
import { productConditionLabels } from "@shared/marketplace";
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
  const [pickSize, setPickSize] = useState<string | null>(null);
  const [pickColor, setPickColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const p = product.data;
  const related = trpc.catalog.list.useQuery(
    { category: p?.category, limit: 5 },
    { enabled: mounted && Boolean(p) }
  );
  useEffect(() => {
    setVariantId(undefined);
    setPickSize(null);
    setPickColor(null);
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
  // Tallas y colores como botones; la combinación elegida es la variante.
  const sizes = Array.from(new Set(p.variants.map(v => v.size).filter((x): x is string => Boolean(x))));
  const colors = Array.from(new Set(p.variants.map(v => v.color).filter((x): x is string => Boolean(x))));
  const matches = (v: (typeof p.variants)[number], size: string | null, color: string | null) =>
    (!sizes.length || !size || v.size === size) && (!colors.length || !color || v.color === color);
  const variant =
    p.variants.find(v => v.id === variantId) ??
    p.variants.find(v => matches(v, pickSize, pickColor) && v.stock > 0) ??
    p.variants.find(v => matches(v, pickSize, pickColor)) ??
    p.variants.find(v => v.stock > 0) ??
    p.variants[0];
  const choose = (size: string | null, color: string | null) => {
    setPickSize(size);
    setPickColor(color);
    const next =
      p.variants.find(v => matches(v, size, color) && v.stock > 0) ??
      p.variants.find(v => matches(v, size, color));
    setVariantId(next?.id);
    setQuantity(1);
  };
  const stockFor = (size: string | null, color: string | null) =>
    p.variants.filter(v => matches(v, size, color)).reduce((n, v) => n + v.stock, 0);
  const price = variant?.priceCents ?? p.priceCents;
  // Precio rebajado: la fila cuesta menos que el precio base (liquidación).
  const listPrice = p.priceCents > price ? p.priceCents : null;
  const discountPct = listPrice ? Math.round((1 - price / listPrice) * 100) : 0;
  const stock = variant?.stock ?? 0;
  const canBuy = Boolean(variant) && stock > 0 && Number.isInteger(quantity) && quantity >= 1 && quantity <= Math.min(20, stock);
  const buy = async (thenCheckout: boolean) => {
    if (!auth.user) {
      navigate("/mi-cuenta");
      return;
    }
    if (!variant) return;
    try {
      await add.mutateAsync({ variantId: variant.id, quantity });
      if (thenCheckout) navigate("/comprar");
    } catch {
      /* el aviso lo muestra add.onError */
    }
  };
  const specs = (
    [
      ["Condición", productConditionLabels[p.condition ?? "nuevo"]],
      ["Marca", p.brand],
      ["Peso", p.weightGrams ? (p.weightGrams >= 1000 ? `${(p.weightGrams / 1000).toLocaleString("es-PA")} kg` : `${p.weightGrams} g`) : ""],
      ["Medidas", p.lengthCm && p.widthCm && p.heightCm ? `${p.lengthCm} × ${p.widthCm} × ${p.heightCm} cm` : ""],
      ["Garantía", p.warranty],
    ] as Array<[string, string]>
  ).filter(([, value]) => value);
  return (
    <div className="live-page container">
      <Link href="/mercado">← Catálogo real</Link>
      <div className="pd">
        {/* 1. Fotos: miniaturas en columna y la foto grande */}
        <section className="pd-gallery" aria-label="Fotos del producto">
          {p.images.length > 1 && (
            <div className="pd-thumbs">
              {p.images.map((image, i) => (
                <button
                  type="button"
                  className={photo === i ? "is-active" : ""}
                  key={image}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={photo === i}
                  onMouseEnter={() => setPhoto(i)}
                  onClick={() => setPhoto(i)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="pd-photo">
            {p.images[photo] ? (
              <img src={p.images[photo]} alt={p.title} />
            ) : (
              <Package size={70} aria-label="Sin fotografía" />
            )}
          </div>
          {(p.videos ?? []).length > 0 && (
            <div className="pd-videos" aria-label="Videos del producto">
              {p.videos.map((src, i) => (
                <video key={src} src={src} controls preload="metadata" playsInline aria-label={`Video ${i + 1} de ${p.title}`} />
              ))}
            </div>
          )}
        </section>

        {/* 2. Información y opciones */}
        <section className="pd-info">
          <Link className="pd-store" href={`/tiendas/${p.store.slug}`}>
            <StoreLogo name={p.store.name} logoUrl={p.store.logoUrl} size={22} />
            Visita la tienda {p.store.name}
            <BadgeCheck size={16} aria-label="Vendedor verificado" />
          </Link>
          <h1 className="pd-title">{p.title}</h1>
          <div className="pd-rating">
            <Star size={15} aria-hidden="true" />
            {p.reviewCount
              ? `${p.rating.toFixed(1)} · ${p.reviewCount} reseñas`
              : "Sin reseñas todavía"}
            <StoreStars slug={p.store.slug} size={14} />
            <StoreBrandBadge slug={p.store.slug} />
          </div>
          <p className="pd-category">{p.kind === "book" ? "Libro cristiano" : p.category}</p>
          <hr />
          <div className="pd-price">
            {discountPct > 0 && <span className="pd-off">−{discountPct} %</span>}
            <strong>{usd(price)}</strong>
          </div>
          {listPrice && (
            <p className="pd-list">Antes: <s>{usd(listPrice)}</s></p>
          )}
          {sizes.length > 0 && (
            <fieldset className="pd-chips">
              <legend>Talla: <b>{pickSize ?? variant?.size ?? "elige"}</b></legend>
              {sizes.map(size => {
                const left = stockFor(size, pickColor);
                const active = (pickSize ?? variant?.size) === size;
                return (
                  <button
                    key={size}
                    type="button"
                    className={`${active ? "is-active" : ""} ${left ? "" : "is-out"}`}
                    aria-pressed={active}
                    onClick={() => choose(size, pickColor)}
                  >
                    {size}
                  </button>
                );
              })}
            </fieldset>
          )}
          {colors.length > 0 && (
            <fieldset className="pd-chips">
              <legend>Color: <b>{pickColor ?? variant?.color ?? "elige"}</b></legend>
              {colors.map(color => {
                const left = stockFor(pickSize, color);
                const active = (pickColor ?? variant?.color) === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={`${active ? "is-active" : ""} ${left ? "" : "is-out"}`}
                    aria-pressed={active}
                    onClick={() => choose(pickSize, color)}
                  >
                    {color}
                  </button>
                );
              })}
            </fieldset>
          )}
          <div className={`pd-desc${showMore ? " is-open" : ""}`}>
            <p>{p.description}</p>
          </div>
          {p.description.length > 220 && (
            <button type="button" className="live-more" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
              {showMore ? "Ver menos" : "Ver más"}
            </button>
          )}
        </section>

        {/* 3. Cuadro de compra */}
        <aside className="pd-buy" aria-label="Comprar">
          <strong className="pd-buy-price">{usd(price)}</strong>
          <ShippingNote store={p.store} modes={p.deliveryModes} />
          <p className={`pd-stock ${stock ? "" : "is-out"}`}>
            {stock === 0 ? "Agotado" : stock <= 5 ? `¡Solo quedan ${stock}!` : "Disponible"}
          </p>
          <label className="pd-qty">
            Cantidad
            <select value={quantity} onChange={e => setQuantity(Number(e.target.value))} disabled={!stock}>
              {Array.from({ length: Math.max(1, Math.min(20, stock)) }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-gold btn-wide" disabled={add.isPending || !canBuy} onClick={() => buy(false)}>
            <ShoppingBag size={18} /> {stock ? "Añadir al carrito" : "Agotado"}
          </button>
          <button className="btn pd-now btn-wide" disabled={add.isPending || !canBuy} onClick={() => buy(true)}>
            Comprar ahora
          </button>
          <dl className="pd-facts">
            <div><dt>Vende</dt><dd><Link href={`/tiendas/${p.store.slug}`}>{p.store.name}</Link></dd></div>
            <div><dt>Desde</dt><dd>{p.store.province}</dd></div>
            <div><dt>Entrega</dt><dd>{p.deliveryModes.map(mode => (mode === "pickup" ? "Retiro" : mode === "shipping" ? "Envío" : "A domicilio")).join(" · ")}</dd></div>
            <div><dt>Pago</dt><dd>Directo a la tienda</dd></div>
          </dl>
          <Link href="/mi-carrito" className="pd-cart-link">Ver mi carrito</Link>
        </aside>
      </div>

      {/* Debajo, a todo el ancho: detalles, libro y ubicación */}
      {(specs.length > 0 || p.book) && (
        <section className="live-panel pd-more">
          <h2>Detalles</h2>
          {specs.length > 0 && (
            <dl className="live-book-meta live-specs">
              {specs.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          )}
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
                <div key={name}><dt>{name}</dt><dd>{value || "No indicado"}</dd></div>
              ))}
            </dl>
          )}
        </section>
      )}
      <PublicPlaceMap kind="tienda" slug={p.store.slug} title="Dónde está la tienda" />
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
