import { AuthGate } from "@/features/membership/AuthGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { authFetch } from "@/lib/authFetch";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveStoreInput,
  catalogCategories,
  type OwnerProduct,
  type ProductKind,
  type ProductStatus,
  type DeliveryMode,
  type SaveStoreInput,
} from "@shared/marketplace";
import { provinceOptions } from "@shared/membership";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ImagePlus,
  LoaderCircle,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Province = SaveStoreInput["deliveryProvinces"][number];
function validProvinces(values: string[]): Province[] {
  return values.filter(
    (v): v is Province =>
      saveStoreInput.shape.deliveryProvinces.safeParse([v]).success
  );
}
type SellerCatalogTab = "products" | "store";

/** Acepta "6123-4567", "+507 6123 4567" o "50761234567" y lo deja como "+50761234567". */
function normalizePanamaPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) return `+507${digits}`;
  if (digits.length === 11 && digits.startsWith("507")) return `+${digits}`;
  return value.trim();
}

type StoreForm = {
  name: string;
  description: string;
  province: string;
  city: string;
  shippingFee: string;
  homeFee: string;
  deliveryProvinces: Province[];
  /** Precio de envío escrito para cada provincia marcada («5.00»). */
  provinceFees: Record<string, string>;
  yappyPhone: string;
  yappyDirectory: string;
  cardPaymentUrl: string;
  cardOnDelivery: boolean;
};

type BookForm = {
  author: string;
  publisher: string;
  isbn: string;
  language: string;
  format: string;
  condition: "new" | "used";
};

type VariantForm = {
  id?: number;
  sku: string;
  size: string;
  color: string;
  stock: string;
  priceCents: string;
};

type ProductForm = {
  id?: number;
  expectedRevision?: number;
  kind: ProductKind;
  title: string;
  description: string;
  category: string;
  price: string;
  images: string[];
  deliveryModes: DeliveryMode[];
  variants: VariantForm[];
  book: BookForm;
};

type StoreSnapshot = {
  store: {
    id: number;
    slug: string;
    name: string;
    description: string;
    province: string;
    city: string;
    shippingFeeCents?: number | null;
    homeFeeCents?: number | null;
    deliveryProvinces?: string[];
    shippingFeesByProvince?: Record<string, number>;
    yappyPhone?: string | null;
    yappyDirectory?: string | null;
    cardPaymentUrl?: string | null;
    cardOnDelivery?: boolean;
    churchName?: string;
    verified?: boolean;
  } | null;
  canPublish: boolean;
  blockingReason: string | null;
};

const EMPTY_STORE: StoreForm = {
  name: "",
  description: "",
  province: "",
  city: "",
  shippingFee: "",
  homeFee: "",
  deliveryProvinces: [],
  provinceFees: {},
  yappyPhone: "",
  yappyDirectory: "",
  cardPaymentUrl: "",
  cardOnDelivery: false,
};
const EMPTY_BOOK: BookForm = {
  author: "",
  publisher: "",
  isbn: "",
  language: "Español",
  format: "",
  condition: "new",
};
const EMPTY_VARIANT: VariantForm = {
  sku: "",
  size: "",
  color: "",
  stock: "0",
  priceCents: "",
};
const EMPTY_PRODUCT: ProductForm = {
  kind: "product",
  title: "",
  description: "",
  category: "Hogar",
  price: "",
  images: [],
  deliveryModes: ["pickup"],
  variants: [{ ...EMPTY_VARIANT }],
  book: { ...EMPTY_BOOK },
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const storeProvinces = validProvinces(provinceOptions);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Converts a decimal text without floating point rounding (19.99 -> 1999). */
function decimalToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function statusLabel(status: ProductStatus) {
  return status === "published"
    ? "Publicado"
    : status === "archived"
      ? "Archivado"
      : "Borrador";
}

function statusClass(status: ProductStatus) {
  return `seller-catalog-status seller-catalog-status--${status}`;
}

function productToForm(product: OwnerProduct): ProductForm {
  return {
    id: product.id,
    expectedRevision: product.revision,
    kind: product.kind,
    title: product.title,
    description: product.description,
    category: product.category,
    price: centsToDecimal(product.priceCents),
    images: [...product.images],
    deliveryModes: [...product.deliveryModes],
    variants: product.variants.length
      ? product.variants.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size ?? "",
          color: variant.color ?? "",
          stock: String(variant.stock),
          priceCents:
            variant.priceCents === product.priceCents
              ? ""
              : centsToDecimal(variant.priceCents),
        }))
      : [{ ...EMPTY_VARIANT }],
    book: product.book
      ? {
          author: product.book.author,
          publisher: product.book.publisher,
          isbn: product.book.isbn,
          language: product.book.language,
          format: product.book.format,
          condition: product.book.condition === "used" ? "used" : "new",
        }
      : { ...EMPTY_BOOK },
  };
}

function emptyVariant() {
  return { ...EMPTY_VARIANT };
}

function SellerCatalogContent({
  tab = "products",
}: {
  tab?: SellerCatalogTab;
}) {
  const { user, loading } = useAuth();
  const enabled = !loading && Boolean(user);
  const utils = trpc.useUtils();
  const storeQuery = trpc.catalog.myStore.useQuery(undefined, {
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const productsQuery = trpc.catalog.myProducts.useQuery(undefined, {
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const saveStore = trpc.catalog.saveStore.useMutation();
  const saveProduct = trpc.catalog.saveProduct.useMutation();
  const setStatus = trpc.catalog.setStatus.useMutation();

  const storeSnapshot = storeQuery.data as StoreSnapshot | undefined;
  const products = (productsQuery.data ?? []) as OwnerProduct[];
  const [activeTab, setActiveTab] = useState<SellerCatalogTab>(tab);
  const [storeForm, setStoreForm] = useState<StoreForm>(EMPTY_STORE);
  const [storeDirty, setStoreDirty] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [editorOpen, setEditorOpen] = useState(false);
  const [productDirty, setProductDirty] = useState(false);
  const [conflict, setConflict] = useState<"store" | "product" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const initializedStore = useRef(false);

  useEffect(() => {
    if (initializedStore.current || storeQuery.isLoading || !storeQuery.data)
      return;
    initializedStore.current = true;
    const store = storeSnapshot?.store;
    if (store)
      setStoreForm({
        name: store.name,
        description: store.description,
        province: store.province,
        city: store.city,
        shippingFee:
          store.shippingFeeCents == null
            ? ""
            : centsToDecimal(store.shippingFeeCents),
        homeFee:
          store.homeFeeCents == null ? "" : centsToDecimal(store.homeFeeCents),
        deliveryProvinces: validProvinces(store.deliveryProvinces ?? []),
        provinceFees: feesFromStore(store),
        yappyPhone: store.yappyPhone ?? "",
        yappyDirectory: store.yappyDirectory ?? "",
        cardPaymentUrl: store.cardPaymentUrl ?? "",
        cardOnDelivery: Boolean(store.cardOnDelivery),
      });
  }, [storeQuery.data, storeQuery.isLoading, storeSnapshot]);

  useEffect(() => setActiveTab(tab), [tab]);

  const canPublish = Boolean(storeSnapshot?.canPublish);
  const hasStore = Boolean(storeSnapshot?.store);
  const productCountLabel = useMemo(
    () =>
      `${products.length} ${products.length === 1 ? "publicación" : "publicaciones"}`,
    [products.length]
  );

  const updateStore = <K extends keyof StoreForm>(
    key: K,
    value: StoreForm[K]
  ) => {
    setStoreForm(previous => ({ ...previous, [key]: value }));
    setStoreDirty(true);
  };

  const updateProduct = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) => {
    setProductForm(previous => ({ ...previous, [key]: value }));
    setProductDirty(true);
  };

  const saveStoreDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConflict(null);
    try {
      const shippingFeeCentsLegacy = null;
      // Precio de envío por provincia: solo las provincias marcadas con precio.
      const feesByProvince: Record<string, number> = {};
      for (const [province, value] of Object.entries(storeForm.provinceFees)) {
        if (!value.trim()) continue;
        const cents = decimalToCents(value);
        if (cents === null) throw new Error(`Precio de envío inválido para ${province}; usa hasta dos decimales.`);
        feesByProvince[province] = cents;
      }
      const feeValues = Object.values(feesByProvince);
      const homeFeeCents = storeForm.homeFee.trim()
        ? decimalToCents(storeForm.homeFee)
        : null;
      if (
        (storeForm.homeFee.trim() && homeFeeCents === null)
      )
        throw new Error("Tarifa inválida; utiliza hasta dos decimales.");
      const saved = await saveStore.mutateAsync({
        name: storeForm.name,
        description: storeForm.description,
        province: storeForm.province,
        city: storeForm.city,
        // Tarifa base = la más baja; el precio real sale de cada provincia.
        shippingFeeCents: feeValues.length ? Math.min(...feeValues) : shippingFeeCentsLegacy,
        homeFeeCents,
        shippingFeesByProvince: feesByProvince,
        deliveryProvinces: validProvinces([
          ...Object.keys(feesByProvince),
          ...(homeFeeCents !== null && !(storeForm.province in feesByProvince) ? [storeForm.province] : []),
        ]),
        yappyPhone: normalizePanamaPhone(storeForm.yappyPhone),
        yappyDirectory: storeForm.yappyDirectory,
        cardPaymentUrl: storeForm.cardPaymentUrl.trim(),
        cardOnDelivery: storeForm.cardOnDelivery,
      });
      setStoreForm({
        name: saved.name,
        description: saved.description,
        province: saved.province,
        city: saved.city,
        shippingFee:
          saved.shippingFeeCents == null
            ? ""
            : centsToDecimal(saved.shippingFeeCents),
        homeFee:
          saved.homeFeeCents == null ? "" : centsToDecimal(saved.homeFeeCents),
        deliveryProvinces: validProvinces(saved.deliveryProvinces ?? []),
        provinceFees: feesFromStore(saved),
        yappyPhone: saved.yappyPhone ?? "",
        yappyDirectory: saved.yappyDirectory ?? "",
        cardPaymentUrl: saved.cardPaymentUrl ?? "",
        cardOnDelivery: Boolean(saved.cardOnDelivery),
      });
      setStoreDirty(false);
      await utils.catalog.myStore.invalidate();
      toast.success("Perfil público de tienda guardado");
    } catch (error) {
      const message = errorText(error, "No se pudo guardar la tienda.");
      if (/conflict|revision|cambió|actualiz/i.test(message))
        setConflict("store");
      toast.error("No se pudo guardar la tienda", { description: message });
    }
  };

  const reloadStore = async () => {
    const fresh = await storeQuery.refetch();
    const store = (fresh.data as StoreSnapshot | undefined)?.store;
    if (store)
      setStoreForm({
        name: store.name,
        description: store.description,
        province: store.province,
        city: store.city,
        shippingFee:
          store.shippingFeeCents == null
            ? ""
            : centsToDecimal(store.shippingFeeCents),
        homeFee:
          store.homeFeeCents == null ? "" : centsToDecimal(store.homeFeeCents),
        deliveryProvinces: validProvinces(store.deliveryProvinces ?? []),
        provinceFees: feesFromStore(store),
        yappyPhone: store.yappyPhone ?? "",
        yappyDirectory: store.yappyDirectory ?? "",
        cardPaymentUrl: store.cardPaymentUrl ?? "",
        cardOnDelivery: Boolean(store.cardOnDelivery),
      });
    else setStoreForm(EMPTY_STORE);
    setStoreDirty(false);
    setConflict(null);
  };

  const openNewProduct = () => {
    setProductForm({
      ...EMPTY_PRODUCT,
      variants: [{ ...EMPTY_VARIANT }],
      book: { ...EMPTY_BOOK },
    });
    setProductDirty(false);
    setUploadError(null);
    setConflict(null);
    setEditorOpen(true);
    setActiveTab("products");
  };

  const openProduct = (product: OwnerProduct) => {
    setProductForm(productToForm(product));
    setProductDirty(false);
    setUploadError(null);
    setConflict(null);
    setEditorOpen(true);
    setActiveTab("products");
  };

  const closeEditor = () => {
    if (
      productDirty &&
      !window.confirm("Tienes cambios sin guardar. ¿Cerrar sin guardar?")
    )
      return;
    setEditorOpen(false);
    setProductDirty(false);
    setConflict(null);
  };

  const saveProductDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConflict(null);
    const priceCents = decimalToCents(productForm.price);
    if (priceCents === null) {
      toast.error("Precio no válido", {
        description: "Usa un importe como 19.99, con máximo dos decimales.",
      });
      return;
    }
    if (productForm.kind === "book" && !productForm.book.author.trim()) {
      toast.error("Completa los metadatos del libro", {
        description: "El autor es obligatorio.",
      });
      return;
    }
    if (
      !productForm.title.trim() ||
      !productForm.category ||
      !productForm.deliveryModes.length
    ) {
      toast.error("Completa los campos requeridos", {
        description:
          "Título, categoría y una modalidad de entrega son obligatorios.",
      });
      return;
    }
    const normalizedVariants = productForm.variants.map(variant => ({
      ...variant,
      stockValue: /^\d+$/.test(variant.stock.trim())
        ? Number(variant.stock)
        : NaN,
      priceValue: variant.priceCents.trim()
        ? decimalToCents(variant.priceCents)
        : priceCents,
    }));
    if (
      normalizedVariants.some(
        variant =>
          !Number.isSafeInteger(variant.stockValue) || variant.stockValue < 0
      )
    ) {
      toast.error("Inventario no válido", {
        description:
          "Cada stock debe ser un número entero igual o mayor que cero.",
      });
      return;
    }
    if (normalizedVariants.some(variant => variant.priceValue === null)) {
      toast.error("Precio de variante no válido", {
        description: "Usa un importe como 19.99, con máximo dos decimales.",
      });
      return;
    }
    try {
      const saved = await saveProduct.mutateAsync({
        id: productForm.id,
        expectedRevision: productForm.expectedRevision,
        kind: productForm.kind,
        title: productForm.title.trim(),
        description: productForm.description.trim(),
        category: productForm.category,
        priceCents,
        images: productForm.images,
        deliveryModes: productForm.deliveryModes,
        variants: normalizedVariants.map(variant => ({
          id: variant.id,
          sku: variant.sku.trim(),
          size: variant.size.trim() || null,
          color: variant.color.trim() || null,
          stock: variant.stockValue,
          priceCents: variant.priceValue ?? priceCents,
        })),
        ...(productForm.kind === "book" ? { book: productForm.book } : {}),
      });
      setProductForm(productToForm(saved));
      setProductDirty(false);
      await productsQuery.refetch();
      toast.success(
        productForm.id
          ? "Publicación actualizada"
          : "Borrador de publicación guardado"
      );
    } catch (error) {
      const message = errorText(error, "No se pudo guardar la publicación.");
      if (/conflict|revision|cambió|actualiz/i.test(message))
        setConflict("product");
      toast.error("No se pudo guardar la publicación", {
        description: message,
      });
    }
  };

  const reloadProduct = async () => {
    const response = await productsQuery.refetch();
    const fresh = (response.data ?? []) as OwnerProduct[];
    const current = fresh.find(product => product.id === productForm.id);
    if (current) setProductForm(productToForm(current));
    setProductDirty(false);
    setConflict(null);
  };

  const transition = async (product: OwnerProduct, status: ProductStatus) => {
    if (status === "published" && !canPublish) return;
    try {
      await setStatus.mutateAsync({
        id: product.id,
        expectedRevision: product.revision,
        status,
      });
      await productsQuery.refetch();
      toast.success(
        status === "published"
          ? "Publicación enviada al catálogo"
          : `Publicación ${statusLabel(status).toLowerCase()}`
      );
    } catch (error) {
      toast.error("No se pudo cambiar el estado", {
        description: errorText(
          error,
          "La publicación pudo cambiar en otra sesión."
        ),
      });
      await productsQuery.refetch();
    }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!productForm.id || productDirty) {
      toast.error("Guarda el borrador antes de cargar fotos", {
        description:
          "Así cada foto se vincula a tu producto y su revisión actual.",
      });
      return;
    }
    if (productForm.images.length + files.length > 12) {
      toast.error("La galería admite hasta 12 fotos");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!IMAGE_TYPES.has(file.type))
          throw new Error("Solo se aceptan imágenes PNG, JPEG o WEBP.");
        if (file.size === 0 || file.size > MAX_IMAGE_BYTES)
          throw new Error("Cada foto debe pesar como máximo 5 MiB.");
        if (productForm.images.length >= 12)
          throw new Error(
            "Puedes cargar hasta 12 fotos públicas por publicación."
          );
        const response = await authFetch(
          `/api/catalog/products/${productForm.id}/images`,
          { method: "POST", body: file, headers: { "Content-Type": file.type } }
        );
        if (!response.ok) {
          let message = "No se pudo cargar la foto.";
          try {
            const body = (await response.json()) as { error?: string };
            message = body.error || message;
          } catch {
            /* HTTP error without JSON */
          }
          throw new Error(message);
        }
        const body = (await response.json()) as {
          url?: string;
          revision?: number;
        };
        if (!body.url)
          throw new Error("La API de imágenes no devolvió una URL pública.");
        setProductForm(previous => ({
          ...previous,
          images: [...previous.images, body.url as string],
          expectedRevision: body.revision ?? previous.expectedRevision,
        }));
      }
      await productsQuery.refetch();
      toast.success("Foto(s) cargada(s) y vinculada(s) al producto");
    } catch (error) {
      const message = errorText(error, "No se pudo cargar la foto.");
      setUploadError(message);
      toast.error("Carga no completada", { description: message });
    } finally {
      setUploading(false);
    }
  };

  const loadingState = storeQuery.isLoading || productsQuery.isLoading;
  if (loadingState)
    return (
      <div className="seller-catalog-page">
        <div className="seller-catalog-state">
          <LoaderCircle className="seller-catalog-spin" size={28} />
          <p>Cargando tu catálogo real…</p>
        </div>
      </div>
    );
  if (storeQuery.error || productsQuery.error)
    return (
      <div className="seller-catalog-page">
        <div className="seller-catalog-state seller-catalog-state--error">
          <h1>No pudimos cargar tu catálogo</h1>
          <p>
            {errorText(
              storeQuery.error || productsQuery.error,
              "Inténtalo de nuevo."
            )}
          </p>
          <button
            className="seller-catalog-button seller-catalog-button--gold"
            type="button"
            onClick={() =>
              void Promise.all([storeQuery.refetch(), productsQuery.refetch()])
            }
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  return (
    <div className="seller-catalog-page">
      <header className="seller-catalog-heading">
        <div>
          <p className="seller-catalog-eyebrow">PANEL DE VENDEDOR</p>
          <h1>Tu tienda y publicaciones</h1>
          <p>
            Prepara tus borradores, cuida tu inventario y publica solo cuando tu
            perfil vendedor esté aprobado, activo y con contactos verificados.
          </p>
        </div>
        <div className="seller-catalog-heading-actions">
          <Link
            className="seller-catalog-button seller-catalog-button--outline"
            href="/vendedor/pedidos"
          >
            <Package size={16} /> Pedidos
          </Link>
          <Link
            className="seller-catalog-button seller-catalog-button--outline"
            href="/vendedor/mensajes"
          >
            <MessageSquare size={16} /> Mensajes
          </Link>
        </div>
      </header>

      <nav className="seller-catalog-nav" aria-label="Navegación de vendedor">
        <button
          type="button"
          className={activeTab === "store" ? "is-active" : ""}
          onClick={() => setActiveTab("store")}
        >
          <Store size={17} /> Mi tienda
        </button>
        <button
          type="button"
          className={activeTab === "products" ? "is-active" : ""}
          onClick={() => setActiveTab("products")}
        >
          <Package size={17} /> Publicaciones <span>{productCountLabel}</span>
        </button>
        <Link href="/vendedor/pedidos">
          <Package size={17} /> Pedidos
        </Link>
        <Link href="/vendedor/mensajes">
          <MessageSquare size={17} /> Mensajes
        </Link>
      </nav>

      {!hasStore && (
        <div
          className="seller-catalog-notice seller-catalog-notice--warning"
          role="status"
        >
          <strong>Primero crea tu perfil público.</strong> Puedes guardar
          borradores, pero el servidor no permitirá publicar sin aprobación,
          suscripción activa y contactos verificados.
        </div>
      )}
      {storeSnapshot?.blockingReason && (
        <div
          className="seller-catalog-notice seller-catalog-notice--info"
          role="status"
        >
          <strong>Publicación bloqueada:</strong> {storeSnapshot.blockingReason}
        </div>
      )}

      {activeTab === "store" && (
        <section className="seller-catalog-card" aria-labelledby="store-title">
          <div className="seller-catalog-card-heading">
            <div>
              <p className="seller-catalog-eyebrow">PERFIL PÚBLICO</p>
              <h2 id="store-title">Información de tu tienda</h2>
              <p>
                Esta información se verá junto a tus publicaciones. No incluyas
                cédula, documentos ni datos privados.
              </p>
            </div>
            <Store size={25} aria-hidden="true" />
          </div>
          <form className="seller-catalog-form" onSubmit={saveStoreDraft}>
            <div className="seller-catalog-form-grid">
              <label>
                <span>Nombre público</span>
                <Input
                  value={storeForm.name}
                  onChange={event => updateStore("name", event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Ej. Librería Nueva Vida"
                />
              </label>
              <label>
                <span>Provincia</span>
                <select
                  value={storeForm.province}
                  onChange={event =>
                    updateStore("province", event.target.value)
                  }
                  required
                >
                  <option value="">Selecciona una provincia</option>
                  {provinceOptions.map(province => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ciudad</span>
                <Input
                  value={storeForm.city}
                  onChange={event => updateStore("city", event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Ciudad"
                />
              </label>
              <label className="seller-catalog-field--wide">
                <span>Bio de la tienda</span>
                <Textarea
                  value={storeForm.description}
                  onChange={event =>
                    updateStore("description", event.target.value)
                  }
                  maxLength={5000}
                  rows={6}
                  placeholder="Cuenta brevemente qué ofreces a la comunidad."
                />
              </label>
            </div>
            <fieldset className="seller-catalog-subsection">
              <legend>Cómo te pagan tus compradores</legend>
              <p>
                Tus compradores te pagan directo a ti; CuadraZone no recibe ese
                dinero ni guarda datos de tarjetas. Solo verán los métodos que
                configures aquí, además de transferencia y efectivo contra
                entrega.
              </p>
              <div className="seller-catalog-form-grid">
                <label>
                  Celular de Yappy
                  <Input
                    inputMode="tel"
                    value={storeForm.yappyPhone}
                    onChange={e => updateStore("yappyPhone", e.target.value)}
                    placeholder="+50760000000"
                    maxLength={16}
                  />
                </label>
                <label>
                  Nombre en el Directorio Yappy (si tienes Yappy Comercial)
                  <Input
                    value={storeForm.yappyDirectory}
                    onChange={e => updateStore("yappyDirectory", e.target.value)}
                    placeholder="Opcional"
                    maxLength={80}
                  />
                </label>
                <label>
                  Link de pago con tarjeta (Tilopay, PagueloFácil o PayPal)
                  <Input
                    type="url"
                    inputMode="url"
                    value={storeForm.cardPaymentUrl}
                    onChange={e => updateStore("cardPaymentUrl", e.target.value)}
                    placeholder="https://..."
                    maxLength={500}
                  />
                </label>
              </div>
              <label className="seller-catalog-inline-check">
                <input
                  type="checkbox"
                  checked={storeForm.cardOnDelivery}
                  onChange={e => updateStore("cardOnDelivery", e.target.checked)}
                />{" "}
                Cobro con tarjeta (datáfono) al retirar o entregar a domicilio
              </label>
            </fieldset>
            <fieldset className="seller-catalog-subsection">
              <legend>Envíos por provincia</legend>
              <p>
                Marca las provincias a las que envías y escribe el precio del
                envío para cada una. El comprador verá el precio de su
                provincia en cada producto. Escribe 0 para envío gratis. El
                retiro personal siempre es gratis.
              </p>
              <div className="ship-table" role="table" aria-label="Precio de envío por provincia">
                {storeProvinces.map(p => {
                  const enabled = p in storeForm.provinceFees;
                  return (
                    <div className="ship-row" role="row" key={p}>
                      <label className="ship-province" role="cell">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={e => {
                            const next = { ...storeForm.provinceFees };
                            if (e.target.checked) next[p] = next[p] ?? "";
                            else delete next[p];
                            updateStore("provinceFees", next);
                          }}
                        />
                        {p}
                        {p === storeForm.province && <span className="ship-own">Tu provincia</span>}
                      </label>
                      <label className="ship-price" role="cell">
                        <span className="visually-hidden">Precio de envío a {p} en dólares</span>
                        <span aria-hidden="true">US$</span>
                        <Input
                          inputMode="decimal"
                          disabled={!enabled}
                          value={storeForm.provinceFees[p] ?? ""}
                          onChange={e => updateStore("provinceFees", { ...storeForm.provinceFees, [p]: e.target.value })}
                          placeholder={enabled ? "0.00" : "No envía"}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="seller-catalog-form-grid">
                <label>
                  Entrega a domicilio en tu provincia (USD)
                  <Input
                    inputMode="decimal"
                    value={storeForm.homeFee}
                    onChange={e => updateStore("homeFee", e.target.value)}
                    placeholder="Sin configurar"
                  />
                </label>
              </div>
            </fieldset>
            <div className="seller-catalog-form-actions">
              <button
                className="seller-catalog-button seller-catalog-button--gold"
                type="submit"
                disabled={saveStore.isPending || !storeDirty}
              >
                <Save size={16} />{" "}
                {saveStore.isPending ? "Guardando…" : "Guardar perfil público"}
              </button>
              {storeDirty && (
                <span className="seller-catalog-dirty">
                  Cambios sin guardar
                </span>
              )}
            </div>
            {conflict === "store" && (
              <div className="seller-catalog-conflict" role="alert">
                <strong>El perfil cambió en otra sesión.</strong>
                <span>
                  Conservamos lo que escribiste. Recarga solo si deseas comparar
                  y reemplazar tu edición.
                </span>
                <button
                  type="button"
                  className="seller-catalog-button seller-catalog-button--small"
                  onClick={() => void reloadStore()}
                >
                  Recargar versión del servidor
                </button>
              </div>
            )}
          </form>
        </section>
      )}

      {activeTab === "products" && (
        <>
          <section className="seller-catalog-toolbar">
            <div>
              <p className="seller-catalog-eyebrow">CATÁLOGO PROPIO</p>
              <h2>Publicaciones</h2>
              <p>
                Los borradores no son visibles públicamente hasta que una
                publicación sea aprobada por las reglas reales del servidor.
              </p>
            </div>
            <button
              className="seller-catalog-button seller-catalog-button--gold"
              type="button"
              disabled={!hasStore}
              onClick={openNewProduct}
            >
              <Plus size={17} /> Nueva publicación
            </button>
          </section>
          {editorOpen && (
            <section
              className="seller-catalog-card seller-catalog-editor"
              aria-labelledby="editor-title"
            >
              <div className="seller-catalog-card-heading">
                <div>
                  <p className="seller-catalog-eyebrow">
                    {productForm.id
                      ? "EDITAR PUBLICACIÓN"
                      : "NUEVA PUBLICACIÓN"}
                  </p>
                  <h2 id="editor-title">
                    {productForm.kind === "book"
                      ? "Ficha de libro"
                      : "Ficha de producto"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="seller-catalog-icon-button"
                  aria-label="Cerrar editor"
                  onClick={closeEditor}
                >
                  <X size={19} />
                </button>
              </div>
              <form className="seller-catalog-form" onSubmit={saveProductDraft}>
                <div
                  className="seller-catalog-kind-switch"
                  role="radiogroup"
                  aria-label="Tipo de publicación"
                >
                  <button
                    type="button"
                    className={
                      productForm.kind === "product" ? "is-active" : ""
                    }
                    onClick={() => updateProduct("kind", "product")}
                  >
                    Producto
                  </button>
                  <button
                    type="button"
                    className={productForm.kind === "book" ? "is-active" : ""}
                    onClick={() => updateProduct("kind", "book")}
                  >
                    Libro cristiano
                  </button>
                </div>
                <div className="seller-catalog-form-grid">
                  <label>
                    <span>Título</span>
                    <Input
                      value={productForm.title}
                      onChange={event =>
                        updateProduct("title", event.target.value)
                      }
                      maxLength={240}
                      required
                      placeholder="Nombre de la publicación"
                    />
                  </label>
                  <label>
                    <span>Categoría</span>
                    <select
                      value={productForm.category}
                      onChange={event =>
                        updateProduct("category", event.target.value)
                      }
                      required
                    >
                      {catalogCategories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Precio (USD)</span>
                    <Input
                      inputMode="decimal"
                      value={productForm.price}
                      onChange={event =>
                        updateProduct("price", event.target.value)
                      }
                      required
                      placeholder="19.99"
                    />
                    <small>
                      Se guarda en centavos, sin redondeos binarios.
                    </small>
                  </label>
                  <label className="seller-catalog-field--wide">
                    <span>Descripción</span>
                    <Textarea
                      value={productForm.description}
                      onChange={event =>
                        updateProduct("description", event.target.value)
                      }
                      rows={5}
                      maxLength={10000}
                      placeholder="Describe con claridad lo que recibirá el comprador."
                    />
                  </label>
                </div>
                {productForm.kind === "book" && (
                  <fieldset className="seller-catalog-subsection">
                    <legend>Metadatos del libro</legend>
                    <div className="seller-catalog-form-grid">
                      <label>
                        <span>Autor</span>
                        <Input
                          value={productForm.book.author}
                          onChange={event => {
                            updateProduct("book", {
                              ...productForm.book,
                              author: event.target.value,
                            });
                          }}
                          required
                        />
                      </label>
                      <label>
                        <span>Editorial</span>
                        <Input
                          value={productForm.book.publisher}
                          onChange={event =>
                            updateProduct("book", {
                              ...productForm.book,
                              publisher: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>ISBN</span>
                        <Input
                          value={productForm.book.isbn}
                          onChange={event =>
                            updateProduct("book", {
                              ...productForm.book,
                              isbn: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Idioma</span>
                        <Input
                          value={productForm.book.language}
                          onChange={event =>
                            updateProduct("book", {
                              ...productForm.book,
                              language: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Formato</span>
                        <Input
                          value={productForm.book.format}
                          onChange={event =>
                            updateProduct("book", {
                              ...productForm.book,
                              format: event.target.value,
                            })
                          }
                          placeholder="Tapa blanda, digital…"
                        />
                      </label>
                      <label>
                        <span>Condición</span>
                        <select
                          value={productForm.book.condition}
                          onChange={event =>
                            updateProduct("book", {
                              ...productForm.book,
                              condition: event.target
                                .value as BookForm["condition"],
                            })
                          }
                        >
                          <option value="new">Nuevo</option>
                          <option value="used">Usado</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                )}
                <fieldset className="seller-catalog-subsection">
                  <legend>Entrega</legend>
                  <div className="seller-catalog-checks">
                    {(["shipping", "pickup", "home"] as const).map(mode => (
                      <label key={mode}>
                        <input
                          type="checkbox"
                          checked={productForm.deliveryModes.includes(mode)}
                          onChange={event =>
                            updateProduct(
                              "deliveryModes",
                              event.target.checked
                                ? [...productForm.deliveryModes, mode]
                                : productForm.deliveryModes.filter(
                                    item => item !== mode
                                  )
                            )
                          }
                        />
                        {mode === "shipping"
                          ? "Envío"
                          : mode === "pickup"
                            ? "Retiro"
                            : "Entrega a domicilio"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="seller-catalog-subsection">
                  <legend>Variantes e inventario</legend>
                  <div className="seller-catalog-variant-list">
                    {productForm.variants.map((variant, index) => (
                      <div
                        className="seller-catalog-variant"
                        key={variant.id ?? `new-${index}`}
                      >
                        <label>
                          <span>SKU</span>
                          <Input
                            value={variant.sku}
                            onChange={event =>
                              updateProduct(
                                "variants",
                                productForm.variants.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, sku: event.target.value }
                                    : item
                                )
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          <span>Talla</span>
                          <Input
                            value={variant.size}
                            onChange={event =>
                              updateProduct(
                                "variants",
                                productForm.variants.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, size: event.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Única"
                          />
                        </label>
                        <label>
                          <span>Color</span>
                          <Input
                            value={variant.color}
                            onChange={event =>
                              updateProduct(
                                "variants",
                                productForm.variants.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, color: event.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Stock</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={variant.stock}
                            onChange={event =>
                              updateProduct(
                                "variants",
                                productForm.variants.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, stock: event.target.value }
                                    : item
                                )
                              )
                            }
                            required
                          />
                        </label>
                        <label>
                          <span>Precio variante</span>
                          <Input
                            inputMode="decimal"
                            value={variant.priceCents}
                            onChange={event =>
                              updateProduct(
                                "variants",
                                productForm.variants.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        priceCents: event.target.value,
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="Usa el base"
                          />
                        </label>
                        <button
                          type="button"
                          className="seller-catalog-icon-button seller-catalog-remove"
                          aria-label={`Eliminar variante ${index + 1}`}
                          disabled={productForm.variants.length === 1}
                          onClick={() =>
                            updateProduct(
                              "variants",
                              productForm.variants.filter(
                                (_, itemIndex) => itemIndex !== index
                              )
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="seller-catalog-button seller-catalog-button--small"
                    onClick={() =>
                      updateProduct("variants", [
                        ...productForm.variants,
                        emptyVariant(),
                      ])
                    }
                  >
                    <Plus size={15} /> Añadir variante
                  </button>
                </fieldset>
                <fieldset className="seller-catalog-subsection">
                  <legend>Galería pública</legend>
                  <p className="seller-catalog-help">
                    Guarda primero el borrador antes de cargar fotos. PNG, JPEG
                    o WEBP · máximo 5 MiB por foto · hasta 12 fotos. No subas
                    cédulas, cartas pastorales ni imágenes con identidad
                    personal.
                  </p>
                  {uploadError && (
                    <p className="seller-catalog-error" role="alert">
                      {uploadError}
                    </p>
                  )}
                  <div className="seller-catalog-gallery">
                    {productForm.images.map((image, index) => (
                      <figure key={`${image}-${index}`}>
                        <img
                          src={image}
                          alt={`Foto ${index + 1} de ${productForm.title || "la publicación"}`}
                        />
                        <button
                          type="button"
                          aria-label={`Quitar foto ${index + 1}`}
                          onClick={() =>
                            updateProduct(
                              "images",
                              productForm.images.filter(
                                (_, imageIndex) => imageIndex !== index
                              )
                            )
                          }
                        >
                          <X size={15} />
                        </button>
                      </figure>
                    ))}
                    <label className="seller-catalog-upload">
                      <UploadCloud size={22} />
                      <span>{uploading ? "Cargando…" : "Cargar fotos"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        hidden
                        disabled={
                          !productForm.id ||
                          productDirty ||
                          uploading ||
                          productForm.images.length >= 12
                        }
                        onChange={event => {
                          void uploadImages(event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </fieldset>
                {conflict === "product" && (
                  <div className="seller-catalog-conflict" role="alert">
                    <strong>La publicación cambió en otra sesión.</strong>
                    <span>
                      Conservamos lo que escribiste; recarga solo si deseas
                      reemplazar tu edición local.
                    </span>
                    <button
                      type="button"
                      className="seller-catalog-button seller-catalog-button--small"
                      onClick={() => void reloadProduct()}
                    >
                      Recargar versión del servidor
                    </button>
                  </div>
                )}
                <div className="seller-catalog-form-actions">
                  <button
                    className="seller-catalog-button seller-catalog-button--gold"
                    type="submit"
                    disabled={saveProduct.isPending || !productDirty}
                  >
                    <Save size={16} />{" "}
                    {saveProduct.isPending ? "Guardando…" : "Guardar borrador"}
                  </button>
                  <button
                    className="seller-catalog-button seller-catalog-button--outline"
                    type="button"
                    onClick={closeEditor}
                  >
                    Cerrar
                  </button>
                  {productDirty && (
                    <span className="seller-catalog-dirty">
                      Cambios sin guardar
                    </span>
                  )}
                </div>
              </form>
            </section>
          )}
          {products.length === 0 ? (
            <div className="seller-catalog-empty">
              <Package size={30} />
              <h3>Aún no tienes publicaciones</h3>
              <p>
                Empieza con un borrador propio. No se muestra nada como
                publicado hasta que el servidor autorice la activación.
              </p>
              <button
                className="seller-catalog-button seller-catalog-button--gold"
                type="button"
                onClick={openNewProduct}
              >
                <Plus size={16} /> Crear primera publicación
              </button>
            </div>
          ) : (
            <div className="seller-catalog-product-list">
              {products.map(product => (
                <article
                  className="seller-catalog-product-card"
                  key={product.id}
                >
                  <div className="seller-catalog-product-image">
                    {product.images[0] ? (
                      <img src={product.images[0]} alt="" />
                    ) : (
                      <ImagePlus size={26} aria-hidden="true" />
                    )}
                  </div>
                  <div className="seller-catalog-product-main">
                    <div className="seller-catalog-product-top">
                      <div>
                        <span className={statusClass(product.status)}>
                          {statusLabel(product.status)}
                        </span>
                        <h3>{product.title}</h3>
                        <p>
                          {product.category} ·{" "}
                          {product.kind === "book" ? "Libro" : "Producto"} ·
                          revisión {product.revision}
                        </p>
                      </div>
                      <strong>{formatUsd(product.priceCents)}</strong>
                    </div>
                    <div className="seller-catalog-product-meta">
                      <span>
                        <b>
                          {product.variants.reduce(
                            (total, variant) => total + variant.stock,
                            0
                          )}
                        </b>{" "}
                        unidades en stock
                      </span>
                      <span>{product.images.length} fotos</span>
                      <span>{product.deliveryModes.length} modalidades</span>
                    </div>
                    <div className="seller-catalog-product-actions">
                      <button
                        className="seller-catalog-button seller-catalog-button--small"
                        type="button"
                        onClick={() => openProduct(product)}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      {product.status === "draft" && (
                        <button
                          className="seller-catalog-button seller-catalog-button--small seller-catalog-button--publish"
                          type="button"
                          disabled={!canPublish || setStatus.isPending}
                          onClick={() => void transition(product, "published")}
                          title={
                            !canPublish
                              ? (storeSnapshot?.blockingReason ??
                                "Publicación no autorizada")
                              : undefined
                          }
                        >
                          <Check size={14} /> Publicar
                        </button>
                      )}
                      {product.status === "published" && (
                        <button
                          className="seller-catalog-button seller-catalog-button--small"
                          type="button"
                          disabled={setStatus.isPending}
                          onClick={() => void transition(product, "archived")}
                        >
                          <Archive size={14} /> Archivar
                        </button>
                      )}
                      {product.status === "archived" && (
                        <button
                          className="seller-catalog-button seller-catalog-button--small"
                          type="button"
                          disabled={!canPublish || setStatus.isPending}
                          onClick={() => void transition(product, "published")}
                        >
                          <Check size={14} /> Reactivar
                        </button>
                      )}
                    </div>
                    {product.status === "draft" && !canPublish && (
                      <p className="seller-catalog-blocking">
                        <strong>Publicar bloqueado:</strong>{" "}
                        {storeSnapshot?.blockingReason ??
                          "Completa los requisitos de vendedor."}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SellerCatalogPage({
  tab = "products",
}: {
  tab?: SellerCatalogTab;
}) {
  return (
    <AuthGate>
      <SellerCatalogContent tab={tab} />
    </AuthGate>
  );
}

export default SellerCatalogPage;

/** Precios por provincia guardados; si la tienda usaba tarifa única, la aplica a sus provincias. */
function feesFromStore(store: { shippingFeesByProvince?: Record<string, number>; shippingFeeCents?: number | null; deliveryProvinces?: string[] }): Record<string, string> {
  const byProvince = store.shippingFeesByProvince ?? {};
  if (Object.keys(byProvince).length)
    return Object.fromEntries(Object.entries(byProvince).map(([p, c]) => [p, centsToDecimal(c)]));
  if (store.shippingFeeCents == null) return {};
  return Object.fromEntries((store.deliveryProvinces ?? []).map(p => [p, centsToDecimal(store.shippingFeeCents!)]));
}
