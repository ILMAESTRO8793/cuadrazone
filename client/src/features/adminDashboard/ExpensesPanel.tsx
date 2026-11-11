import { useState } from "react";
import { toast } from "sonner";
import {
  expenseCategories,
  expenseCategoryLabels,
  panamaDateKey,
  type ExpenseCategory,
} from "@shared/finance";
import { trpc } from "@/lib/trpc";
import { SERIES, dayLabel, money } from "./format";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Ocurrió un error";

export function ExpensesPanel({
  enabled,
  year,
}: {
  enabled: boolean;
  year: number;
}) {
  const utils = trpc.useUtils();
  const list = trpc.adminDashboard.expenses.useQuery({ year }, { enabled });
  const add = trpc.adminDashboard.addExpense.useMutation();
  const remove = trpc.adminDashboard.deleteExpense.useMutation();
  const [form, setForm] = useState({
    category: "publicidad" as ExpenseCategory,
    description: "",
    amount: "",
    spentOn: panamaDateKey(new Date()),
  });

  const rows = list.data ?? [];
  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  const byCategory = expenseCategories
    .map(c => ({
      c,
      cents: rows
        .filter(r => r.category === c)
        .reduce((a, r) => a + r.amountCents, 0),
    }))
    .filter(x => x.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const max = byCategory[0]?.cents || 1;

  async function refresh() {
    await Promise.all([
      utils.adminDashboard.expenses.invalidate(),
      utils.adminDashboard.overview.invalidate(),
    ]);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(/[,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0)
      return toast.error("Escribe un monto mayor que cero");
    try {
      await add.mutateAsync({
        category: form.category,
        description: form.description,
        amountCents: Math.round(amount * 100),
        spentOn: form.spentOn,
      });
      setForm(f => ({ ...f, description: "", amount: "" }));
      await refresh();
      toast.success("Gasto agregado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function del(id: number) {
    if (!confirm("¿Eliminar este gasto? No se puede deshacer.")) return;
    try {
      await remove.mutateAsync({ id });
      await refresh();
      toast.success("Gasto eliminado");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div className="czd-grid">
      <section className="czd-panel" aria-labelledby="czd-exp-new">
        <h2 id="czd-exp-new">Agregar gasto</h2>
        <form className="czd-form" onSubmit={submit}>
          <label>
            Tipo de gasto
            <select
              value={form.category}
              onChange={e =>
                setForm({
                  ...form,
                  category: e.target.value as ExpenseCategory,
                })
              }
            >
              {expenseCategories.map(c => (
                <option key={c} value={c}>
                  {expenseCategoryLabels[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
              minLength={2}
              maxLength={200}
              placeholder="Ej.: Anuncios en Instagram, noviembre"
            />
          </label>
          <div className="czd-form-row">
            <label>
              Monto (US$)
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                required
                placeholder="25.00"
              />
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={form.spentOn}
                onChange={e => setForm({ ...form, spentOn: e.target.value })}
                required
              />
            </label>
          </div>
          <button
            className="czd-primary"
            type="submit"
            disabled={add.isPending}
          >
            {add.isPending ? "Guardando…" : "Agregar gasto"}
          </button>
        </form>
      </section>

      <section className="czd-panel" aria-labelledby="czd-exp-cat">
        <h2 id="czd-exp-cat">Gastos de {year} por tipo</h2>
        <p className="czd-muted">
          Total del año: <b>{money(total)}</b>
        </p>
        {byCategory.length === 0 ? (
          <p className="czd-empty">
            Agrega tu primer gasto para ver en qué se va el dinero.
          </p>
        ) : (
          <ul className="czd-rank">
            {byCategory.map(x => (
              <li key={x.c}>
                <div>
                  <strong>{expenseCategoryLabels[x.c]}</strong>
                  <span>
                    {Math.round((x.cents / (total || 1)) * 100)} % del total
                  </span>
                </div>
                <div className="czd-rank-bar">
                  <span
                    style={{
                      width: `${(x.cents / max) * 100}%`,
                      background: SERIES.gastos,
                    }}
                  />
                </div>
                <b>{money(x.cents)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="czd-panel czd-panel--wide"
        aria-labelledby="czd-exp-list"
      >
        <h2 id="czd-exp-list">Todos los gastos de {year}</h2>
        {list.isLoading && <p role="status">Cargando gastos…</p>}
        {rows.length > 0 && (
          <div className="czd-table-wrap">
            <table className="czd-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th className="num">Monto</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{dayLabel(r.spentOn)}</td>
                    <td>{expenseCategoryLabels[r.category] ?? r.category}</td>
                    <td>{r.description}</td>
                    <td className="num">
                      <b>{money(r.amountCents)}</b>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="czd-danger"
                        disabled={remove.isPending}
                        onClick={() => void del(r.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
