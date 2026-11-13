import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Camera,
  Clock,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import {
  defaultWeekHours,
  menuTags,
  optionGroupKindLabels,
  optionGroupKinds,
  weekDayLabels,
  weekDays,
  type MenuOptionGroup,
  type MenuSize,
  type OptionGroupKind,
  type PublicMenuItem,
  type WeekHours,
} from "@shared/menu";
import { trpc } from "@/lib/trpc";
import "./restaurant.css";

const usd = (c: number) => `US$${(c / 100).toFixed(2)}`;
const toCents = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
const toDollars = (c: number) => (c / 100).toFixed(2);
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

/** /vendedor/menu: el restaurante arma su menú. */
export function MenuEditorPage() {
  const menu = trpc.menu.mine.useQuery();
  const d = menu.data;
  return (
    <div className="rm-page container">
      <header className="rm-head">
        <UtensilsCrossed size={30} aria-hidden="true" />
        <div>
          <p className="eyebrow">Restaurante</p>
          <h1>Mi menú</h1>
          <p>
            Arma tus secciones y platos con tamaños, combos, ingredientes para
            quitar y extras.
          </p>
        </div>
      </header>
      {menu.isLoading && <p role="status">Cargando…</p>}
      {d?.status === "no_store" && (
        <p className="member-notice">
          Primero guarda los datos de tu tienda en{" "}
          <Link href="/vendedor/productos">Mi tienda</Link>.
        </p>
      )}
      {d?.status === "not_commerce" && (
        <p className="member-notice">
          El menú de restaurante es para tiendas de comercio.
        </p>
      )}
      {d?.status === "ok" && (
        <>
          <RestaurantSettings current={d.restaurant} />
          {d.restaurant?.enabled && (
            <Sections sections={d.sections} items={d.items} />
          )}
        </>
      )}
    </div>
  );
}

function RestaurantSettings({
  current,
}: {
  current: { enabled: boolean; prepMinutes: number; hours: WeekHours } | null;
}) {
  const utils = trpc.useUtils();
  const save = trpc.menu.saveRestaurant.useMutation();
  const [enabled, setEnabled] = useState(current?.enabled ?? false);
  const [prep, setPrep] = useState(String(current?.prepMinutes ?? 25));
  const [hours, setHours] = useState<WeekHours>(
    current?.hours ?? defaultWeekHours
  );
  useEffect(() => {
    if (current) {
      setEnabled(current.enabled);
      setPrep(String(current.prepMinutes));
      setHours(current.hours);
    }
  }, [current?.enabled, current?.prepMinutes, JSON.stringify(current?.hours)]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        enabled,
        prepMinutes: Number(prep) || 25,
        hours,
      });
      await utils.menu.invalidate();
      toast.success(
        enabled ? "Restaurante guardado" : "Menú de restaurante apagado"
      );
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <form className="rm-card" onSubmit={submit}>
      <label className="rm-switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
        <span>
          <strong>Es un restaurante</strong>
          <small>Tu tienda mostrará tu menú en lugar de solo productos.</small>
        </span>
      </label>
      {enabled && (
        <>
          <label className="rm-field rm-field--short">
            <span>
              <Clock size={14} aria-hidden="true" /> Tiempo de preparación
              (minutos)
            </span>
            <input
              type="number"
              min={5}
              max={180}
              value={prep}
              onChange={e => setPrep(e.target.value)}
            />
          </label>
          <fieldset className="rm-hours">
            <legend>Horario de atención (hora de Panamá)</legend>
            {weekDays.map(day => {
              const h = hours[day];
              return (
                <div key={day} className="rm-hours-row">
                  <span>{weekDayLabels[day]}</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={!h}
                      onChange={e =>
                        setHours({
                          ...hours,
                          [day]: e.target.checked
                            ? null
                            : { open: "11:00", close: "21:00" },
                        })
                      }
                    />{" "}
                    Cerrado
                  </label>
                  {h && (
                    <>
                      <input
                        type="time"
                        aria-label={`${weekDayLabels[day]}: abre`}
                        value={h.open}
                        onChange={e =>
                          setHours({
                            ...hours,
                            [day]: { ...h, open: e.target.value },
                          })
                        }
                      />
                      <span>a</span>
                      <input
                        type="time"
                        aria-label={`${weekDayLabels[day]}: cierra`}
                        value={h.close}
                        onChange={e =>
                          setHours({
                            ...hours,
                            [day]: { ...h, close: e.target.value },
                          })
                        }
                      />
                    </>
                  )}
                </div>
              );
            })}
          </fieldset>
          <p className="rm-hint">
            Entregas solo por delivery con despachador de CuadraZone, dentro de
            tu provincia.
          </p>
        </>
      )}
      <button className="btn btn-gold" type="submit" disabled={save.isPending}>
        {save.isPending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

type Section = { id: number; name: string; sortOrder: number };

function Sections({
  sections,
  items,
}: {
  sections: Section[];
  items: PublicMenuItem[];
}) {
  const utils = trpc.useUtils();
  const saveSection = trpc.menu.saveSection.useMutation();
  const deleteSection = trpc.menu.deleteSection.useMutation();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{
    sectionId: number;
    item: PublicMenuItem | null;
  } | null>(null);

  async function run(p: Promise<unknown>, ok?: string) {
    try {
      await p;
      await utils.menu.invalidate();
      if (ok) toast.success(ok);
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  return (
    <>
      <form
        className="rm-card rm-add-section"
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) return;
          run(
            saveSection.mutateAsync({ name, sortOrder: sections.length }),
            "Sección agregada"
          ).then(() => setName(""));
        }}
      >
        <label className="rm-field">
          <span>Nueva sección del menú</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            placeholder="Ej.: Desayunos, Combos, Bebidas, Postres"
          />
        </label>
        <button
          className="btn btn-outline"
          type="submit"
          disabled={saveSection.isPending}
        >
          <Plus size={16} aria-hidden="true" /> Agregar sección
        </button>
      </form>
      {!sections.length && (
        <p className="rm-hint">
          Crea tu primera sección para empezar a agregar platos.
        </p>
      )}
      {sections.map((s, i) => {
        const dishes = items.filter(it => it.sectionId === s.id);
        return (
          <section key={s.id} className="rm-card rm-section">
            <header className="rm-section-head">
              <h2>{s.name}</h2>
              <div className="rm-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={i === 0}
                  onClick={() =>
                    run(
                      Promise.all([
                        saveSection.mutateAsync({
                          id: s.id,
                          name: s.name,
                          sortOrder: i - 1,
                        }),
                        saveSection.mutateAsync({
                          id: sections[i - 1]!.id,
                          name: sections[i - 1]!.name,
                          sortOrder: i,
                        }),
                      ])
                    )
                  }
                  aria-label={`Subir ${s.name}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    const next = window.prompt(
                      "Nuevo nombre de la sección",
                      s.name
                    );
                    if (next?.trim())
                      run(
                        saveSection.mutateAsync({
                          id: s.id,
                          name: next,
                          sortOrder: s.sortOrder,
                        })
                      );
                  }}
                >
                  <Pencil size={14} aria-hidden="true" /> Renombrar
                </button>
                <button
                  type="button"
                  className="btn btn-outline rm-danger"
                  onClick={() =>
                    window.confirm(
                      `¿Eliminar la sección «${s.name}» y sus ${dishes.length} platos?`
                    ) &&
                    run(
                      deleteSection.mutateAsync({ id: s.id }),
                      "Sección eliminada"
                    )
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Eliminar
                </button>
              </div>
            </header>
            <div className="rm-dishes">
              {dishes.map(it => (
                <DishRow
                  key={it.id}
                  item={it}
                  onEdit={() => setEditing({ sectionId: s.id, item: it })}
                />
              ))}
            </div>
            {editing?.sectionId === s.id ? (
              <DishForm
                sectionId={s.id}
                sections={sections}
                item={editing.item}
                nextOrder={dishes.length}
                onDone={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => setEditing({ sectionId: s.id, item: null })}
              >
                <Plus size={16} aria-hidden="true" /> Agregar plato
              </button>
            )}
          </section>
        );
      })}
    </>
  );
}

function DishRow({
  item,
  onEdit,
}: {
  item: PublicMenuItem;
  onEdit: () => void;
}) {
  const utils = trpc.useUtils();
  const setAvailable = trpc.menu.setAvailable.useMutation();
  const remove = trpc.menu.deleteItem.useMutation();
  const [uploading, setUploading] = useState(false);
  async function run(p: Promise<unknown>) {
    try {
      await p;
      await utils.menu.invalidate();
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const r = await fetch(`/api/menu/items/${item.id}/photo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type, "x-cz-request": "1" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
      await utils.menu.invalidate();
      toast.success("Foto guardada");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setUploading(false);
    }
  }
  return (
    <article className={`rm-dish ${item.available ? "" : "is-off"}`}>
      <div className="rm-dish-photo">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" />
        ) : (
          <UtensilsCrossed size={26} aria-hidden="true" />
        )}
      </div>
      <div className="rm-dish-body">
        <strong>{item.name}</strong>
        <span>
          {item.sizes.length
            ? `Desde ${usd(item.priceCents)}`
            : usd(item.priceCents)}
          {item.optionGroups.length
            ? ` · ${item.optionGroups.map(g => g.name).join(", ")}`
            : ""}
        </span>
        {!item.available && <em>Agotado</em>}
      </div>
      <div className="rm-actions">
        <button
          type="button"
          className={`btn ${item.available ? "btn-outline" : "btn-gold"}`}
          onClick={() =>
            run(
              setAvailable.mutateAsync({
                id: item.id,
                available: !item.available,
              })
            )
          }
        >
          {item.available ? "Marcar agotado" : "Marcar disponible"}
        </button>
        <label className="btn btn-outline rm-file">
          <Camera size={14} aria-hidden="true" />{" "}
          {uploading ? "Subiendo…" : "Foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={uploading}
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) upload(f);
            }}
          />
        </label>
        <button type="button" className="btn btn-outline" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" /> Editar
        </button>
        <button
          type="button"
          className="btn btn-outline rm-danger"
          aria-label={`Eliminar ${item.name}`}
          onClick={() =>
            window.confirm(`¿Eliminar «${item.name}»?`) &&
            run(remove.mutateAsync({ id: item.id }))
          }
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

type DraftOption = { name: string; price: string };
type DraftGroup = {
  name: string;
  kind: OptionGroupKind;
  min: string;
  max: string;
  options: DraftOption[];
};

const groupPresets: Array<{ label: string; group: DraftGroup }> = [
  {
    label: "Combo: acompañante",
    group: {
      name: "Acompañante",
      kind: "choice",
      min: "1",
      max: "1",
      options: [
        { name: "Papas fritas", price: "0" },
        { name: "Ensalada", price: "0" },
      ],
    },
  },
  {
    label: "Combo: bebida",
    group: {
      name: "Bebida",
      kind: "choice",
      min: "1",
      max: "1",
      options: [
        { name: "Refresco", price: "0" },
        { name: "Jugo natural", price: "0.50" },
        { name: "Agua", price: "0" },
      ],
    },
  },
  {
    label: "Quitar ingredientes",
    group: {
      name: "Quitar",
      kind: "remove",
      min: "0",
      max: "2",
      options: [
        { name: "Sin cebolla", price: "0" },
        { name: "Sin tomate", price: "0" },
      ],
    },
  },
  {
    label: "Extras",
    group: {
      name: "Extras",
      kind: "extra",
      min: "0",
      max: "3",
      options: [
        { name: "Queso extra", price: "0.75" },
        { name: "Tocino", price: "1.00" },
      ],
    },
  },
];

function DishForm({
  sectionId,
  sections,
  item,
  nextOrder,
  onDone,
}: {
  sectionId: number;
  sections: Section[];
  item: PublicMenuItem | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const save = trpc.menu.saveItem.useMutation();
  const [section, setSection] = useState(item?.sectionId ?? sectionId);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? toDollars(item.priceCents) : "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [sizes, setSizes] = useState<DraftOption[]>(
    (item?.sizes ?? []).map(s => ({
      name: s.name,
      price: toDollars(s.priceCents),
    }))
  );
  const [groups, setGroups] = useState<DraftGroup[]>(
    (item?.optionGroups ?? []).map(g => ({
      name: g.name,
      kind: g.kind,
      min: String(g.min),
      max: String(g.max),
      options: g.options.map(o => ({
        name: o.name,
        price: toDollars(o.priceCents),
      })),
    }))
  );

  function setGroup(i: number, patch: Partial<DraftGroup>) {
    setGroups(groups.map((g, gi) => (gi === i ? { ...g, ...patch } : g)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sizeList: MenuSize[] = sizes
      .filter(s => s.name.trim())
      .map(s => ({ name: s.name.trim(), priceCents: toCents(s.price) }));
    const groupList: MenuOptionGroup[] = groups.map(g => ({
      name: g.name.trim(),
      kind: g.kind,
      min: Number(g.min) || 0,
      max: Math.max(1, Number(g.max) || 1),
      options: g.options
        .filter(o => o.name.trim())
        .map(o => ({
          name: o.name.trim(),
          priceCents: g.kind === "remove" ? 0 : toCents(o.price),
        })),
    }));
    const base = sizeList.length
      ? Math.min(...sizeList.map(s => s.priceCents))
      : toCents(price);
    if (
      [
        base,
        ...sizeList.map(s => s.priceCents),
        ...groupList.flatMap(g => g.options.map(o => o.priceCents)),
      ].some(Number.isNaN)
    ) {
      toast.error("Revisa los precios: usa números como 4.50");
      return;
    }
    try {
      await save.mutateAsync({
        ...(item ? { id: item.id } : {}),
        sectionId: section,
        name,
        description,
        priceCents: base,
        available: item?.available ?? true,
        tags: tags as (typeof menuTags)[number][],
        sizes: sizeList,
        optionGroups: groupList,
        sortOrder: item ? 0 : nextOrder,
      });
      await utils.menu.invalidate();
      toast.success(
        item ? "Plato guardado" : "Plato agregado. Ahora súbele una foto."
      );
      onDone();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <form className="rm-dish-form" onSubmit={submit}>
      <h3>{item ? `Editar «${item.name}»` : "Nuevo plato"}</h3>
      <div className="rm-grid">
        <label className="rm-field">
          <span>Nombre</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Ej.: Hamburguesa de la casa"
          />
        </label>
        <label className="rm-field">
          <span>Sección</span>
          <select
            value={section}
            onChange={e => setSection(Number(e.target.value))}
          >
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {!sizes.length && (
          <label className="rm-field">
            <span>Precio (US$)</span>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              inputMode="decimal"
              required
              placeholder="6.50"
            />
          </label>
        )}
      </div>
      <label className="rm-field">
        <span>Descripción</span>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ingredientes y cómo se sirve"
        />
      </label>
      <fieldset className="rm-tags">
        <legend>Etiquetas</legend>
        {menuTags.map(t => (
          <label key={t}>
            <input
              type="checkbox"
              checked={tags.includes(t)}
              onChange={e =>
                setTags(
                  e.target.checked ? [...tags, t] : tags.filter(x => x !== t)
                )
              }
            />{" "}
            {t}
          </label>
        ))}
      </fieldset>

      <fieldset className="rm-box">
        <legend>Tamaños (opcional)</legend>
        <p className="rm-hint">
          Si el plato tiene tamaños, cada uno lleva su precio. Ej.: Mediano
          6.50, Grande 7.75.
        </p>
        {sizes.map((s, i) => (
          <div key={i} className="rm-row">
            <input
              aria-label="Tamaño"
              value={s.name}
              onChange={e =>
                setSizes(
                  sizes.map((x, xi) =>
                    xi === i ? { ...x, name: e.target.value } : x
                  )
                )
              }
              placeholder="Mediano"
              maxLength={30}
            />
            <input
              aria-label="Precio"
              value={s.price}
              onChange={e =>
                setSizes(
                  sizes.map((x, xi) =>
                    xi === i ? { ...x, price: e.target.value } : x
                  )
                )
              }
              inputMode="decimal"
              placeholder="6.50"
            />
            <button
              type="button"
              className="btn btn-outline rm-danger"
              aria-label="Quitar tamaño"
              onClick={() => setSizes(sizes.filter((_, xi) => xi !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sizes.length < 5 && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSizes([...sizes, { name: "", price: "" }])}
          >
            <Plus size={14} aria-hidden="true" /> Agregar tamaño
          </button>
        )}
      </fieldset>

      <fieldset className="rm-box">
        <legend>Opciones: combos, quitar y extras</legend>
        {groups.map((g, gi) => (
          <div key={gi} className="rm-group">
            <div className="rm-row">
              <input
                aria-label="Nombre del grupo"
                value={g.name}
                onChange={e => setGroup(gi, { name: e.target.value })}
                placeholder="Acompañante"
                maxLength={40}
              />
              <select
                aria-label="Tipo"
                value={g.kind}
                onChange={e =>
                  setGroup(gi, { kind: e.target.value as OptionGroupKind })
                }
              >
                {optionGroupKinds.map(k => (
                  <option key={k} value={k}>
                    {optionGroupKindLabels[k]}
                  </option>
                ))}
              </select>
              <label>
                mín{" "}
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={g.min}
                  onChange={e => setGroup(gi, { min: e.target.value })}
                />
              </label>
              <label>
                máx{" "}
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={g.max}
                  onChange={e => setGroup(gi, { max: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="btn btn-outline rm-danger"
                aria-label="Quitar grupo"
                onClick={() => setGroups(groups.filter((_, x) => x !== gi))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            {g.options.map((o, oi) => (
              <div key={oi} className="rm-row rm-row--option">
                <input
                  aria-label="Opción"
                  value={o.name}
                  onChange={e =>
                    setGroup(gi, {
                      options: g.options.map((x, xi) =>
                        xi === oi ? { ...x, name: e.target.value } : x
                      ),
                    })
                  }
                  placeholder="Papas fritas"
                  maxLength={50}
                />
                {g.kind !== "remove" && (
                  <input
                    aria-label="Precio adicional"
                    value={o.price}
                    onChange={e =>
                      setGroup(gi, {
                        options: g.options.map((x, xi) =>
                          xi === oi ? { ...x, price: e.target.value } : x
                        ),
                      })
                    }
                    inputMode="decimal"
                    placeholder="+0.00"
                  />
                )}
                <button
                  type="button"
                  className="btn btn-outline rm-danger"
                  aria-label="Quitar opción"
                  onClick={() =>
                    setGroup(gi, {
                      options: g.options.filter((_, xi) => xi !== oi),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setGroup(gi, {
                  options: [...g.options, { name: "", price: "0" }],
                })
              }
            >
              <Plus size={14} aria-hidden="true" /> Agregar opción
            </button>
          </div>
        ))}
        {groups.length < 8 && (
          <div className="rm-presets">
            <span>Agregar:</span>
            {groupPresets.map(p => (
              <button
                key={p.label}
                type="button"
                className="btn btn-outline"
                onClick={() => setGroups([...groups, structuredClone(p.group)])}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setGroups([
                  ...groups,
                  {
                    name: "",
                    kind: "choice",
                    min: "0",
                    max: "1",
                    options: [{ name: "", price: "0" }],
                  },
                ])
              }
            >
              Grupo vacío
            </button>
          </div>
        )}
      </fieldset>

      <div className="rm-actions">
        <button
          className="btn btn-gold"
          type="submit"
          disabled={save.isPending}
        >
          {save.isPending ? "Guardando…" : "Guardar plato"}
        </button>
        <button type="button" className="btn btn-outline" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
