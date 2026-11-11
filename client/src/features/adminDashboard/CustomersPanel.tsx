import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { dateLabel, int, money, waLink } from "./format";

const typeLabels = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  admin: "Administrador",
} as const;

export function CustomersPanel({ enabled }: { enabled: boolean }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);
  const q = trpc.adminDashboard.customers.useQuery(
    { search, page },
    { enabled, placeholderData: prev => prev }
  );
  const pages = q.data
    ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize))
    : 1;

  return (
    <section className="czd-panel" aria-labelledby="czd-customers">
      <div className="czd-panel-head">
        <div>
          <h2 id="czd-customers">Clientes</h2>
          <p>
            {q.data ? `${int(q.data.total)} personas registradas` : "Cargando…"}
            . Celular y correo salen del perfil; si no lo llenaron, del último
            pedido.
          </p>
        </div>
      </div>
      <div className="czd-filters">
        <input
          type="search"
          placeholder="Buscar por nombre, correo o celular"
          value={input}
          onChange={e => setInput(e.target.value)}
          aria-label="Buscar cliente"
        />
      </div>
      {q.data && q.data.customers.length === 0 && (
        <p className="czd-empty">Nadie coincide con «{search}».</p>
      )}
      <div className="czd-table-wrap">
        <table className="czd-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Celular</th>
              <th>Correo</th>
              <th>Tipo</th>
              <th className="num">Pedidos</th>
              <th className="num">Compró</th>
              <th>Último ingreso</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.customers.map(c => {
              const wa = waLink(c.phone);
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small className="czd-sub">
                      Desde {dateLabel(c.createdAt)}
                    </small>
                  </td>
                  <td>
                    {c.phone ? (
                      <span className="czd-contact czd-contact--row">
                        <a href={`tel:${c.phone}`}>{c.phone}</a>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="czd-wa"
                          >
                            WhatsApp
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="czd-muted">—</span>
                    )}
                  </td>
                  <td>
                    {c.email ? (
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    ) : (
                      <span className="czd-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`czd-type czd-type--${c.type}`}>
                      {typeLabels[c.type]}
                    </span>
                  </td>
                  <td className="num">{int(c.orders)}</td>
                  <td className="num">{money(c.spentCents)}</td>
                  <td>{dateLabel(c.lastSignedIn)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="czd-pager">
          <button
            type="button"
            className="czd-ghost"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {pages}
          </span>
          <button
            type="button"
            className="czd-ghost"
            disabled={page + 1 >= pages}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
