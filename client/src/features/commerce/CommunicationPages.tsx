import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Bell, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AuthGate } from "@/features/membership/AuthGate";
import { CommerceNav } from "./BuyerPages";
import { RequestError } from "./PublicCatalogPages";
function date(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toLocaleString(
    "es-PA"
  );
}
function MessagesContent() {
  const search = new URLSearchParams(useSearch());
  const rawOrder = Number(search.get("pedido"));
  const orderId =
    Number.isSafeInteger(rawOrder) && rawOrder > 0 ? rawOrder : undefined;
  const fromLink = Number(search.get("conversacion"));
  const [selected, setSelected] = useState(
    Number.isSafeInteger(fromLink) && fromLink > 0 ? fromLink : undefined
  );
  const [body, setBody] = useState("");
  const threads = trpc.commerce.conversations.useQuery({});
  const messages = trpc.commerce.messages.useQuery(
    { conversationId: selected ?? 1 },
    { enabled: Boolean(selected) }
  );
  const utils = trpc.useUtils();
  const send = trpc.commerce.sendMessage.useMutation({
    onSuccess: result => {
      setSelected(result.conversationId);
      setBody("");
      utils.commerce.conversations.invalidate();
      utils.commerce.messages.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  useEffect(() => {
    if (!selected && !orderId && threads.data?.[0])
      setSelected(threads.data[0].id);
  }, [threads.data, selected, orderId]);
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">COMUNICACIÓN PRIVADA</p>
      <h1>Conversemos con confianza</h1>
      <p>
        Solo comprador y vendedor del pedido pueden entrar a la conversación.
        Nunca compartas contraseñas, tarjetas ni documentos de identidad.
      </p>
      {threads.error && (
        <RequestError
          message={threads.error.message}
          retry={() => threads.refetch()}
        />
      )}
      <div className="live-messages">
        <aside className="live-panel">
          <h2>
            <MessageSquare size={22} /> Conversaciones
          </h2>
          {threads.isLoading && <p role="status">Cargando…</p>}
          {threads.data?.map(t => (
            <button
              key={t.id}
              className={`live-thread ${selected === t.id ? "is-active" : ""}`}
              onClick={() => setSelected(t.id)}
            >
              <strong>{t.storeName}</strong>
              <small>Pedido #{t.orderId ?? "—"}</small>
            </button>
          ))}
          {!threads.isLoading &&
            !threads.error &&
            threads.data?.length === 0 && (
              <p>
                Aún no hay conversaciones. Abre un pedido y elige escribir a la
                otra parte.
              </p>
            )}
          <Link href="/pedidos" className="btn btn-outline">
            Ver mis pedidos
          </Link>
        </aside>
        <section className="live-panel">
          <div className="live-panel-heading">
            <h2>
              {orderId && !selected
                ? `Nuevo mensaje · pedido #${orderId}`
                : "Mensajes"}
            </h2>
            <button
              className="live-icon-button"
              aria-label="Actualizar mensajes"
              onClick={() => {
                threads.refetch();
                if (selected) messages.refetch();
              }}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {messages.error && (
            <RequestError
              message={messages.error.message}
              retry={() => messages.refetch()}
            />
          )}
          <div className="live-message-list" aria-live="polite">
            {messages.data?.map(m => (
              <article
                className={`live-message ${m.isMine ? "is-mine" : ""}`}
                key={m.id}
              >
                <p>{m.body}</p>
                <small>
                  {m.isMine ? "Tú" : "La otra parte"} · {date(m.createdAt)}
                </small>
              </article>
            ))}
            {!selected && !orderId && (
              <p>Selecciona una conversación o inicia una desde un pedido.</p>
            )}
          </div>
          {(selected || orderId) && (
            <form
              onSubmit={e => {
                e.preventDefault();
                send.mutate({
                  ...(selected ? { conversationId: selected } : { orderId }),
                  body: body.trim(),
                });
              }}
            >
              <label>
                Tu mensaje
                <textarea
                  maxLength={4000}
                  required
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={4}
                />
              </label>
              <button
                className="btn btn-gold"
                disabled={send.isPending || !body.trim()}
              >
                {send.isPending ? "Enviando…" : "Enviar mensaje"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
export function MessagesPage() {
  return (
    <AuthGate>
      <MessagesContent />
    </AuthGate>
  );
}
function NotificationsContent() {
  const notices = trpc.commerce.notifications.useQuery({});
  const mark = trpc.commerce.readNotification.useMutation({
    onSuccess: () => notices.refetch(),
    onError: e => toast.error(e.message),
  });
  return (
    <div className="live-page container">
      <CommerceNav />
      <p className="eyebrow">ACTIVIDAD INTERNA</p>
      <h1>Lo importante, en un solo lugar</h1>
      <p>
        Notificaciones guardadas en tu cuenta. Correo y SMS externos continúan
        pendientes.
      </p>
      {notices.error ? (
        <RequestError
          message={notices.error.message}
          retry={() => notices.refetch()}
        />
      ) : !notices.data ? (
        <p role="status">Cargando notificaciones…</p>
      ) : !notices.data.length ? (
        <div className="live-empty">
          <Bell size={38} />
          <h2>Todo al día</h2>
          <p>
            Aquí aparecerán los pedidos, mensajes y preguntas que te
            correspondan.
          </p>
        </div>
      ) : (
        <div className="live-notifications">
          {notices.data.map(n => (
            <article
              className={`live-panel ${n.read ? "is-read" : ""}`}
              key={n.id}
            >
              <small>
                {date(n.createdAt)} · {n.read ? "Leída" : "Nueva"}
              </small>
              <h2>{n.body}</h2>
              <div className="live-actions">
                {n.link &&
                  /^\/(pedidos|mensajes|articulo)(\/|\?|$)/.test(n.link) && (
                    <Link className="btn btn-outline" href={n.link}>
                      Ver actividad
                    </Link>
                  )}
                {!n.read && (
                  <button
                    className="btn btn-gold"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ id: n.id })}
                  >
                    Marcar leída
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export function NotificationsPage() {
  return (
    <AuthGate>
      <NotificationsContent />
    </AuthGate>
  );
}
