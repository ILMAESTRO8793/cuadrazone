import { Heart, ArrowUpRight, Star } from "lucide-react";
import { Link } from "wouter";
import {
  type Listing,
  getSeller,
  kindLabel,
  listingPath,
  money,
} from "@/data/catalog";
import { useMarket } from "@/contexts/MarketContext";

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span
      className="stars"
      aria-label={`Calificación de ejemplo ${value} de 5${count ? `, ${count} opiniones de ejemplo` : ""}`}
    >
      <Star size={12} fill="currentColor" /> <strong>{value.toFixed(1)}</strong>
      {count !== undefined && <span>({count})</span>}
      <span className="rating-demo">· ejemplo</span>
    </span>
  );
}
export default function ProductCard({ item }: { item: Listing }) {
  const { favorites, toggleFavorite, addToCart } = useMarket();
  const seller = getSeller(item.sellerId);
  const saved = favorites.includes(item.id);
  return (
    <article className="product-card">
      <div className={`product-image ${item.kind}`}>
        <Link href={listingPath(item)} aria-label={`Ver ${item.title}`}>
          <img src={item.image} alt={item.title} loading="lazy" />
        </Link>
        <span className="product-kind">{kindLabel[item.kind]}</span>
        <button
          className={`favorite-button ${saved ? "saved" : ""}`}
          onClick={() => toggleFavorite(item.id)}
          aria-label={
            saved
              ? `Quitar ${item.title} de favoritos`
              : `Guardar ${item.title} en favoritos`
          }
          aria-pressed={saved}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-body">
        <p className="product-seller">
          {seller.name} <span>· tienda de ejemplo</span>
        </p>
        <Link href={listingPath(item)} className="product-title">
          {item.title}
        </Link>
        <Stars value={item.rating} count={item.reviews} />
        <div className="product-price-row">
          <div>
            <span className="price-prefix">
              {item.kind === "evento" || item.kind === "servicio"
                ? "Desde "
                : ""}
            </span>
            <strong>{money(item.price)}</strong>
            {item.oldPrice && <del>{money(item.oldPrice)}</del>}
          </div>
          <span className="product-province">{item.province}</span>
        </div>
        <div className="product-card-bottom">
          <span>
            {item.tag}
            {item.tag?.includes("ejemplo") ? "" : " · ejemplo"}
          </span>
          {item.kind === "producto" || item.kind === "libro" ? (
            <button
              aria-label={`Añadir ${item.title} al carrito de demostración`}
              onClick={() => addToCart(item.id)}
              className="card-add"
            >
              +
            </button>
          ) : (
            <Link
              href={listingPath(item)}
              aria-label={`Ver ${item.title}`}
              className="card-add"
            >
              <ArrowUpRight size={17} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
