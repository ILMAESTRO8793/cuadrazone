import { MapPin, Truck } from "lucide-react";
import { shippingFeeFor } from "@shared/marketplace";
import { useMarket } from "@/contexts/MarketContext";

type StoreShipping = {
  province: string;
  shippingFeeCents: number | null;
  deliveryProvinces: string[];
  shippingFeesByProvince?: Record<string, number>;
};

const usd = (cents: number) => `US$${(cents / 100).toFixed(2)}`;

/**
 * Dónde está la tienda y cuánto cuesta el envío a la provincia del comprador
 * (la que eligió arriba en «Explorar en»).
 */
export function ShippingNote({ store, modes }: { store: StoreShipping; modes: readonly string[] }) {
  const { province } = useMarket();
  const fee = modes.includes("shipping") ? shippingFeeFor(store, province) : null;
  return (
    <div className="ship-note">
      <span className="ship-origin"><MapPin size={14} aria-hidden="true" /> Desde {store.province}</span>
      <span className={`ship-dest ${fee === null ? "ship-dest--none" : ""}`}>
        <Truck size={14} aria-hidden="true" />{" "}
        {fee !== null
          ? fee === 0
            ? `Envío gratis a ${province}`
            : `Envío a ${province}: ${usd(fee)}`
          : modes.includes("pickup")
            ? `No envía a ${province} · retiro en ${store.province}`
            : `No envía a ${province}`}
      </span>
    </div>
  );
}
