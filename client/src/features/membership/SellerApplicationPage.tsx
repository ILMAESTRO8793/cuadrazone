import { businessSelectionsInput } from "@shared/businessCategories";
import { getSellerPlan, sellerPlanLabel } from "@shared/pricing";
import { AuthGate } from "@/features/membership/AuthGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { authFetch } from "@/lib/authFetch";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { DocumentViewer } from "@/features/membership/DocumentViewer";
import { BusinessCategoryPicker } from "@/features/membership/BusinessCategoryPicker";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LoaderCircle,
  Save,
  Send,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  MAX_DOCUMENT_BYTES,
  CONSENT_VERSION,
  FAITH_CONFESSION,
  REVIEW_RESPONSE_MESSAGE,
  applicationInput,
  provinceOptions,
  statusLabels,
  type ApplicationInput,
  type ApplicationSnapshot,
  type DocumentSnapshot,
} from "@shared/membership";

const emptyApplication: ApplicationInput = {
  businessType: "individual",
  businessName: "",
  businessCategories: [],
  identificationType: "cedula",
  identificationNumber: "",
  documentExpiry: "",
  province: "",
  city: "",
  denominationId: null,
  churchName: "",
  pastorName: "",
  residenceConfirmed: false,
  faithAccepted: false,
  conductAccepted: false,
  privacyAccepted: false,
};
const acceptedMime = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function errorText(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    if (issues?.[0]?.message) return issues[0].message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
const applicationKeys = Object.keys(
  emptyApplication
) as (keyof ApplicationInput)[];
function applicationValues(
  source: ApplicationInput | ApplicationSnapshot
): ApplicationInput {
  return Object.fromEntries(
    applicationKeys.map(key => [key, source[key]])
  ) as ApplicationInput;
}
function isEditable(status: string | undefined) {
  return !status || status === "draft" || status === "rejected";
}
function formatBytes(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MiB`;
}

function SellerApplicationContent() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const membership = trpc.membership.me.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const denominations = trpc.membership.denominations.list.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const saveApplication = trpc.membership.application.save.useMutation();
  const submitApplication = trpc.membership.application.submit.useMutation();
  const [form, setForm] = useState<ApplicationInput>(emptyApplication);
  const initialized = useRef(false);
  const [editingRevision, setEditingRevision] = useState<number>();
  const [uploading, setUploading] = useState<"identity" | "pastoral" | null>(
    null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const snapshot = membership.data;
  const app = snapshot?.application;
  const profile = snapshot?.profile;
  const documents = snapshot?.documents ?? [];
  const editable = isEditable(app?.status);

  useEffect(() => {
    if (initialized.current || membership.isLoading || !membership.data) return;
    initialized.current = true;
    if (app) {
      setEditingRevision(app.revision);
      setForm({
        businessType: app.businessType,
        businessName: app.businessName,
        businessCategories: app.businessCategories,
        identificationType: app.identificationType,
        identificationNumber: app.identificationNumber,
        documentExpiry: app.documentExpiry,
        province: app.province,
        city: app.city,
        denominationId: app.denominationId,
        churchName: app.churchName,
        pastorName: app.pastorName,
        residenceConfirmed: app.residenceConfirmed,
        faithAccepted:
          app.consentVersion === CONSENT_VERSION && app.faithAccepted,
        conductAccepted:
          app.consentVersion === CONSENT_VERSION && app.conductAccepted,
        privacyAccepted:
          app.consentVersion === CONSENT_VERSION && app.privacyAccepted,
      });
    }
  }, [app, membership.isLoading]);

  const setField = <K extends keyof ApplicationInput>(
    key: K,
    value: ApplicationInput[K]
  ) => setForm(previous => ({ ...previous, [key]: value }));
  const denominationName = useMemo(
    () =>
      denominations.data?.find(item => item.id === form.denominationId)?.name,
    [denominations.data, form.denominationId]
  );
  const documentByKind = (kind: "identity" | "pastoral") =>
    documents.find(document => document.kind === kind);
  const parsedForm = applicationInput.safeParse(form);
  const parsedCategories = businessSelectionsInput.safeParse(
    form.businessCategories
  );
  const hasUnsavedChanges = Boolean(
    app &&
      (!parsedForm.success ||
        JSON.stringify(applicationValues(form)) !==
          JSON.stringify(applicationValues(app)))
  );
  const validResidence =
    form.residenceConfirmed &&
    (form.identificationType !== "residencia" || Boolean(form.documentExpiry));
  const completeForSubmit = Boolean(
    app &&
      editable &&
      parsedForm.success &&
      parsedForm.data.businessCategories.length > 0 &&
      !hasUnsavedChanges &&
      profile?.emailVerifiedAt &&
      /^\+507\d{8}$/.test(profile.phone) &&
      documentByKind("identity") &&
      form.churchName.trim().length >= 2 &&
      form.pastorName.trim().length >= 2 &&
      form.residenceConfirmed &&
      form.faithAccepted &&
      form.conductAccepted &&
      form.privacyAccepted &&
      form.identificationNumber.trim().length >= 4 &&
      form.province &&
      form.city &&
      validResidence &&
      (form.businessType !== "company" || form.businessName.trim().length > 0)
  );

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const values = applicationInput.parse(form);
      const saved = await saveApplication.mutateAsync({
        ...values,
        revision: editingRevision,
        consentVersion: CONSENT_VERSION,
      });
      setEditingRevision(saved.revision);
      setForm(values);
      await utils.membership.me.invalidate();
      toast.success("Borrador guardado");
    } catch (error) {
      toast.error("No se pudo guardar el borrador", {
        description: errorText(error, "Completa los campos requeridos."),
      });
    }
  };

  const uploadDocument = async (
    kind: "identity" | "pastoral",
    file: File | undefined
  ) => {
    if (!file) return;
    if (!app || !editable || !form.privacyAccepted || !app.privacyAccepted) {
      toast.error("Primero guarda una solicitud editable y acepta privacidad");
      return;
    }
    if (!acceptedMime.has(file.type)) {
      toast.error("Formato no permitido", {
        description: "Solo PDF, PNG, JPEG o WEBP.",
      });
      return;
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      toast.error("Tamaño no permitido", {
        description: "El archivo debe pesar como máximo 5 MiB.",
      });
      return;
    }
    setUploadError(null);
    setUploading(kind);
    try {
      const response = await authFetch(`/api/verification/documents/${kind}`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "X-CZ-Filename": encodeURIComponent(file.name),
        },
      });
      if (!response.ok) {
        let message = "No se pudo cargar el documento";
        try {
          const body = (await response.json()) as { error?: string };
          message = body.error || message;
        } catch {
          /* plain HTTP error */
        }
        if (response.status === 401 || response.status === 403)
          message = "No tienes permiso para cargar este documento.";
        throw new Error(message);
      }
      (await response.json()) as DocumentSnapshot;
      const fresh = await utils.membership.me.fetch();
      if (
        fresh.application &&
        app &&
        JSON.stringify(applicationValues(fresh.application)) ===
          JSON.stringify(applicationValues(app))
      )
        setEditingRevision(fresh.application.revision);
      await utils.membership.me.invalidate();
      toast.success(
        kind === "identity"
          ? "Documento de identidad guardado"
          : "Carta pastoral guardada"
      );
    } catch (error) {
      const message = errorText(error, "No se pudo cargar el documento.");
      setUploadError(message);
      toast.error("Carga no completada", { description: message });
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!app || !completeForSubmit) return;
    try {
      await submitApplication.mutateAsync({ revision: app.revision });
      await utils.membership.me.invalidate();
      toast.success("Solicitud enviada", {
        description: REVIEW_RESPONSE_MESSAGE,
        duration: 12000,
      });
    } catch (error) {
      toast.error("No se pudo enviar la solicitud", {
        description: errorText(
          error,
          "La solicitud cambió o aún no cumple los requisitos."
        ),
      });
    }
  };

  if (membership.isLoading || denominations.isLoading)
    return (
      <div className="member-page">
        <div className="member-card member-loading-card">
          <LoaderCircle className="member-spin" size={25} /> Cargando la
          solicitud…
        </div>
      </div>
    );
  if (membership.error || denominations.error || !snapshot)
    return (
      <div className="member-page">
        <div className="member-card member-error-card" role="alert">
          <h1>No pudimos cargar la solicitud</h1>
          <p>
            {errorText(
              membership.error || denominations.error,
              "Inténtalo de nuevo."
            )}
          </p>
          <button
            className="member-button member-button--gold"
            type="button"
            onClick={() =>
              void Promise.all([membership.refetch(), denominations.refetch()])
            }
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  return (
    <div className="member-page">
      <div className="member-page-heading">
        <div>
          <p className="member-eyebrow">VENDE EN CUADRAZONE</p>
          <h1>Solicitud de vendedor</h1>
          <p>
            Completa tu solicitud real. La tienda no se activa aquí y el pago de
            del plan elegido ({sellerPlanLabel(snapshot.planSelection?.planId ?? "normal")}/mes) queda para una etapa
            posterior.
          </p>
        </div>
        <Link
          className="member-button member-button--outline"
          href="/mi-cuenta"
        >
          Volver a mi cuenta
        </Link>
      </div>

      {app && (
        <div
          className={`member-notice member-notice--${app.status === "rejected" ? "warning" : "info"}`}
          role="status"
        >
          <strong>{statusLabels[app.status]}</strong> · Revisión: versión{" "}
          {app.revision}. Consentimiento: {app.consentVersion}.
          {app.status === "pending" && (
            <span> {REVIEW_RESPONSE_MESSAGE} La solicitud queda bloqueada mientras la revisamos.</span>
          )}
          {app.status === "approved" &&
            " Tu tienda se activó con 3 meses gratis. Revisa los detalles en Mi tienda."}
          {app.status === "rejected" && app.reviewReason && (
            <span> Motivo: {app.reviewReason}</span>
          )}
        </div>
      )}
      {!profile && (
        <div className="member-notice member-notice--warning">
          Guarda primero tu perfil de contacto en{" "}
          <Link className="member-inline-link" href="/mi-cuenta">
            Mi cuenta
          </Link>
          . No repetimos correo ni teléfono en este formulario.
        </div>
      )}

      <section className="member-card"><h2>Plan de tu negocio</h2><p>{snapshot.planSelection ? `${getSellerPlan(snapshot.planSelection.planId).name} · ${sellerPlanLabel(snapshot.planSelection.planId)}/mes, preferencia guardada.` : `Normal ${sellerPlanLabel("normal")}/mes o Mayor Visibilidad ${sellerPlanLabel("mayor_visibilidad")}/mes. No hay una selección guardada.`}</p><p>Elegir plan no verifica ni activa tu tienda. Los cobros siguen pendientes.</p><Link className="btn btn-outline" href="/vendedor/plan" target="_blank" rel="noopener noreferrer">Elegir plan en otra pestaña sin perder el formulario</Link></section>

      <form
        className={`member-card member-application-form ${!editable ? "member-card--locked" : ""}`}
        onSubmit={saveDraft}
      >
        <fieldset disabled={!editable}>
          <legend className="member-section-title">
            Datos de la actividad
          </legend>
          <div className="member-form-grid">
            <label className="member-field">
              <span>Tipo de actividad</span>
              <select
                value={form.businessType}
                onChange={event =>
                  setField(
                    "businessType",
                    event.target.value as ApplicationInput["businessType"]
                  )
                }
              >
                <option value="individual">Persona individual</option>
                <option value="company">Empresa</option>
              </select>
            </label>
            <label className="member-field">
              <span>
                Nombre comercial{" "}
                {form.businessType === "company" && <b>(obligatorio)</b>}
              </span>
              <Input
                value={form.businessName}
                onChange={event => setField("businessName", event.target.value)}
                required={form.businessType === "company"}
                maxLength={160}
                placeholder="Nombre de la empresa"
              />
            </label>
            <label className="member-field">
              <span>Tipo de identificación</span>
              <select
                value={form.identificationType}
                onChange={event =>
                  setField(
                    "identificationType",
                    event.target.value as ApplicationInput["identificationType"]
                  )
                }
              >
                <option value="cedula">Cédula</option>
                <option value="residencia">Carné de residencia</option>
              </select>
            </label>
            <label className="member-field">
              <span>Número de identificación</span>
              <Input
                value={form.identificationNumber}
                onChange={event =>
                  setField("identificationNumber", event.target.value)
                }
                required
                minLength={4}
                maxLength={40}
              />
            </label>
            <label className="member-field">
              <span>
                Vencimiento del carné{" "}
                {form.identificationType === "residencia" ? (
                  <b>(obligatorio)</b>
                ) : (
                  "(si aplica)"
                )}
              </span>
              <Input
                type="date"
                value={form.documentExpiry}
                onChange={event =>
                  setField("documentExpiry", event.target.value)
                }
                required={form.identificationType === "residencia"}
              />
            </label>
            <label className="member-field">
              <span>Provincia</span>
              <select
                value={form.province}
                onChange={event => setField("province", event.target.value)}
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
            <label className="member-field">
              <span>Ciudad</span>
              <Input
                value={form.city}
                onChange={event => setField("city", event.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <p className="member-muted member-field--wide">
              <strong>Tu iglesia.</strong> CuadraZone es para vendedores
              cristianos evangélicos. Indica la iglesia a la que perteneces y el
              nombre de tu pastor; el equipo de CuadraZone revisa cada solicitud
              antes de aprobarla.
            </p>
            <label className="member-field">
              <span>Denominación (opcional)</span>
              <select
                value={form.denominationId ?? ""}
                onChange={event =>
                  setField("denominationId", event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Prefiero no indicarla</option>
                {denominations.data?.map(denomination => (
                  <option key={denomination.id} value={denomination.id}>
                    {denomination.name}
                  </option>
                ))}
              </select>
              {denominationName && (
                <small>{denominationName} · lista activa del servidor</small>
              )}
            </label>
            <label className="member-field">
              <span>Iglesia evangélica a la que perteneces</span>
              <Input
                value={form.churchName}
                onChange={event => setField("churchName", event.target.value)}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="member-field">
              <span>Nombre de tu pastor</span>
              <Input
                value={form.pastorName}
                onChange={event => setField("pastorName", event.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          </div>
          <div className="member-business-classification">
            <div className="member-field-heading">
              <span className="member-field-title">
                Clasificación del negocio <b>(obligatoria)</b>
              </span>
              <small>
                Elige una o más categorías y, si quieres, sus especialidades
                para que tu tienda aparezca en búsquedas.
              </small>
            </div>
            <BusinessCategoryPicker
              value={form.businessCategories}
              onChange={businessCategories =>
                setField("businessCategories", businessCategories)
              }
              disabled={!editable}
              idPrefix="seller-business-category"
            />
            {!parsedCategories.success && (
              <p className="member-form-error" role="alert">
                {errorText(
                  parsedCategories.error,
                  "Selecciona al menos una categoría para tu negocio"
                )}
              </p>
            )}
          </div>
        </fieldset>

        <section className="member-contact-snapshot">
          <h2>Contacto que se enviará a revisión</h2>
          {profile ? (
            <div className="member-contact-grid">
              <div>
                <strong>Correo</strong>
                <span>{profile.email}</span>
                <em
                  className={`member-status ${profile.emailVerifiedAt ? "member-status--ok" : "member-status--pending"}`}
                >
                  {profile.emailVerifiedAt ? "Verificado" : "Pendiente"}
                </em>
              </div>
              <div>
                <strong>Teléfono</strong>
                <span>{profile.phone || "No guardado"}</span>
                <em
                  className={`member-status ${profile.phoneVerifiedAt ? "member-status--ok" : "member-status--pending"}`}
                >
                  {profile.phoneVerifiedAt ? "Verificado" : "Pendiente"}
                </em>
              </div>
            </div>
          ) : (
            <p>
              Sin perfil guardado.{" "}
              <Link className="member-inline-link" href="/mi-cuenta">
                Completar perfil
              </Link>
            </p>
          )}
          <p className="member-muted">
            El correo se verifica con tu cuenta de Google desde{" "}
            <Link className="member-inline-link" href="/mi-cuenta">Mi cuenta</Link>.
            El teléfono lo confirma el equipo de CuadraZone por llamada o
            WhatsApp durante la revisión; puedes enviar la solicitud con el
            teléfono pendiente.
          </p>
        </section>

        <fieldset disabled={!editable}>
          <legend className="member-section-title">Consentimientos</legend>
          <div className="member-check-list">
            <label>
              <input
                type="checkbox"
                checked={form.residenceConfirmed}
                onChange={event =>
                  setField("residenceConfirmed", event.target.checked)
                }
              />{" "}
              Confirmo que resido en Panamá.
            </label>
            <label className="member-confession">
              <input
                type="checkbox"
                checked={form.faithAccepted}
                onChange={event =>
                  setField("faithAccepted", event.target.checked)
                }
              />{" "}
              <strong>Confesión de fe:</strong> {FAITH_CONFESSION}{" "}
              <Link href="/legal/fe" target="_blank" rel="noopener noreferrer">
                Ver la declaración de fe
              </Link>
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.conductAccepted}
                onChange={event =>
                  setField("conductAccepted", event.target.checked)
                }
              />{" "}
              Acepto el código de conducta ·{" "}
              <Link
                href="/legal/conducta"
                target="_blank"
                rel="noopener noreferrer"
              >
                borrador {CONSENT_VERSION}
              </Link>
              .
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.privacyAccepted}
                onChange={event =>
                  setField("privacyAccepted", event.target.checked)
                }
              />{" "}
              Acepto privacidad y tratamiento de datos ·{" "}
              <Link
                href="/legal/privacidad"
                target="_blank"
                rel="noopener noreferrer"
              >
                borrador {CONSENT_VERSION}
              </Link>
              .
            </label>
          </div>
          <p className="member-legal-note" id="legal-fe">
            <strong>Documentos legales:</strong> la conducta y la privacidad
            son borradores pendientes de revisión jurídica. Aceptarlos no
            aprueba la solicitud: cada una la revisa personalmente el equipo de
            CuadraZone.{" "}
            <span id="legal-conduct">Conducta</span> y{" "}
            <span id="legal-privacy">privacidad</span> usan la misma versión
            publicada arriba.
          </p>
        </fieldset>

        <div className="member-form-actions">
          <button
            className="member-button member-button--gold"
            type="submit"
            disabled={!profile || !editable || saveApplication.isPending}
          >
            <Save size={16} />{" "}
            {saveApplication.isPending ? "Guardando…" : "Guardar borrador"}
          </button>
        </div>
      </form>

      <section
        className={`member-card ${!app || !editable || !form.privacyAccepted || !app.privacyAccepted ? "member-card--muted" : ""}`}
      >
        <div className="member-card-heading">
          <div>
            <p className="member-eyebrow">DOCUMENTOS PRIVADOS</p>
            <h2>Documento de identidad</h2>
          </div>
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        <p className="member-muted">
          Carga raw privada (PDF, PNG, JPEG o WEBP, máximo 5 MiB). El servidor
          valida MIME, firma binaria, permisos y privacidad.
        </p>
        {!app && (
          <p className="member-notice member-notice--warning">
            Guarda el borrador antes de cargar documentos.
          </p>
        )}
        {app && editable && (!form.privacyAccepted || !app.privacyAccepted) && (
          <p className="member-notice member-notice--warning">
            Acepta y guarda privacidad antes de cargar documentos.
          </p>
        )}
        {uploadError && (
          <p className="member-notice member-notice--error" role="alert">
            {uploadError}
          </p>
        )}
        <div className="member-document-grid">
          {(["identity", "pastoral"] as const).map(kind => {
            const document = documentByKind(kind);
            const label =
              kind === "identity" ? "Documento de identidad (obligatorio)" : "Carta pastoral (opcional)";
            return (
              <div className="member-document-card" key={kind}>
                <div>
                  <h3>{label}</h3>
                  {document ? (
                    <p>
                      <strong>{document.fileName}</strong>
                      <br />
                      {document.mimeType} · {formatBytes(document.size)}
                    </p>
                  ) : (
                    <p className="member-muted">Todavía no cargado.</p>
                  )}
                </div>
                {document && <DocumentViewer document={document} />}
                <label className="member-button member-button--outline member-upload-label">
                  <UploadCloud size={16} />{" "}
                  {uploading === kind
                    ? "Cargando…"
                    : document
                      ? "Reemplazar"
                      : "Seleccionar archivo"}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    hidden
                    disabled={
                      !app ||
                      !editable ||
                      !form.privacyAccepted ||
                      !app.privacyAccepted ||
                      uploading !== null
                    }
                    onChange={event => {
                      void uploadDocument(kind, event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="member-card member-submit-card">
        <div>
          <p className="member-eyebrow">ENVÍO</p>
          <h2>Enviar a revisión</h2>
          <p className="member-muted">
            El servidor volverá a comprobar perfil, contactos, consentimientos,
            vigencia y documentos usando la revisión más reciente.
          </p>
        </div>
        <button
          className="member-button member-button--gold"
          type="button"
          onClick={() => void submit()}
          disabled={!completeForSubmit || submitApplication.isPending}
        >
          <Send size={16} />{" "}
          {submitApplication.isPending ? "Enviando…" : "Enviar solicitud"}
        </button>
        {hasUnsavedChanges && (
          <p className="member-notice member-notice--warning">
            Guarda los cambios del formulario antes de enviarlo.
          </p>
        )}
        {!completeForSubmit && editable && (
          <div className="member-notice member-notice--warning">
            <p>Para enviarla falta:</p>
            <ul>
              {!profile?.emailVerifiedAt && <li>Verificar tu correo con tu cuenta de Google (en Mi cuenta).</li>}
              {!/^\+507\d{8}$/.test(profile?.phone ?? "") && <li>Guardar un teléfono de Panamá (+507 y 8 dígitos) en Mi cuenta.</li>}
              {!documentByKind("identity") && <li>Cargar tu documento de identidad.</li>}
              {(form.churchName.trim().length < 2 || form.pastorName.trim().length < 2) && <li>Indicar tu iglesia evangélica y el nombre de tu pastor.</li>}
              {!form.faithAccepted && <li>Aceptar la confesión de fe.</li>}
              {!(form.residenceConfirmed && form.conductAccepted && form.privacyAccepted) && <li>Aceptar residencia, conducta y privacidad.</li>}
              {hasUnsavedChanges && <li>Guardar los cambios del formulario.</li>}
              {(!parsedForm.success || parsedForm.data.businessCategories.length === 0) && <li>Completar los datos obligatorios de negocio, identificación, iglesia y categoría.</li>}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export function SellerApplicationPage() {
  return (
    <AuthGate>
      <SellerApplicationContent />
    </AuthGate>
  );
}
