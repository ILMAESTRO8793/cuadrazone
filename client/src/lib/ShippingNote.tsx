import { MapPin, Truck } from "lucide-react";
import { shippingDeal } from "@shared/shippingRules";
import { useMarket } from "@/contexts/MarketContext";

type StoreShipping = {
  province: string;
  shippingFeeCents: number | null;
  deliveryProvinces: string[];
  shippingFeesByProvince?: Record<string, number>;
};


/**
 * Dónde está la tienda y cómo llega a la provincia del comprador (la que eligió
 * arriba en «Explorar en»): gratis en la misma provincia; si no, se acuerda
 * directo con el vendedor.
 */
export function ShippingNote({ store, modes }: { store: StoreShipping; modes: readonly string[] }) {
  const { province } = useMarket();
  const ships = modes.includes("shipping") || modes.includes("home");
  const free = shippingDeal(store.province, province) === "free";
  return (
    <div className="ship-note">
      <span className="ship-origin"><MapPin size={14} aria-hidden="true" /> Desde {store.province}</span>
      <span className="ship-dest">
        <Truck size={14} aria-hidden="true" />{" "}
        {!ships
          ? `Retiro en ${store.province}`
          : free
            ? `Envío gratis en ${store.province}`
            : `Envío a ${province}: lo acuerdas y pagas con el vendedor`}
      </span>
    </div>
  );
}
