import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { listings } from "@/data/catalog";
import { toast } from "sonner";

type CartEntry = { id: string; quantity: number };
type MarketState = {
  cart: CartEntry[];
  favorites: string[];
  province: string;
  addToCart: (id: string, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setProvince: (province: string) => void;
  cartCount: number;
};
const MarketContext = createContext<MarketState | null>(null);
export function MarketProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [province, updateProvince] = useState("Panamá");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("cuadrazone-demo") || "{}"
      );
      if (Array.isArray(stored.cart))
        setCart(
          stored.cart.filter(
            (entry: CartEntry) =>
              listings.some(item => item.id === entry.id) &&
              Number.isInteger(entry.quantity) &&
              entry.quantity > 0 &&
              entry.quantity <= 20
          )
        );
      if (Array.isArray(stored.favorites))
        setFavorites(
          stored.favorites.filter((id: string) =>
            listings.some(item => item.id === id)
          )
        );
      if (typeof stored.province === "string") updateProvince(stored.province);
    } catch {
      /* An unavailable browser store does not block browsing. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(
          "cuadrazone-demo",
          JSON.stringify({ cart, favorites, province })
        );
      } catch {
        /* Browsing remains available without persistence. */
      }
    }
  }, [cart, favorites, province, loaded]);
  function addToCart(id: string, quantity = 1) {
    if (!listings.some(item => item.id === id)) return;
    setCart(current => {
      const exists = current.find(entry => entry.id === id);
      return exists
        ? current.map(entry =>
            entry.id === id
              ? { ...entry, quantity: Math.min(20, entry.quantity + quantity) }
              : entry
          )
        : [...current, { id, quantity: Math.min(20, Math.max(1, quantity)) }];
    });
    toast.success("Añadido al carrito de demostración", {
      description: "No se realizan compras ni cobros en esta etapa.",
    });
  }
  function toggleFavorite(id: string) {
    setFavorites(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : [...current, id]
    );
  }
  return (
    <MarketContext.Provider
      value={{
        cart,
        favorites,
        province,
        addToCart,
        toggleFavorite,
        cartCount: cart.reduce((total, entry) => total + entry.quantity, 0),
        setProvince: updateProvince,
        setQuantity: (id, quantity) =>
          setCart(current =>
            current.map(entry =>
              entry.id === id
                ? { ...entry, quantity: Math.max(1, Math.min(20, quantity)) }
                : entry
            )
          ),
        removeFromCart: id =>
          setCart(current => current.filter(entry => entry.id !== id)),
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}
export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) throw new Error("useMarket requires MarketProvider");
  return context;
}
