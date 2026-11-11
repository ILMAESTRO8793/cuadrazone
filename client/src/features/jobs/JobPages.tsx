import { SectionShowcase } from "@/components/marketplace/SectionShowcase";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BriefcaseBusiness, CalendarClock, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { provinceOptions } from "@shared/marketplace";
import {
  applicationStatusLabels,
  applicationStatuses,
  areaLabels,
  availabilities,
  availabilityLabels,
  jobAreas,
  jobModalities,
  jobStatusLabels,
  jobTypeLabels,
  jobTypes,
  languageLevels,
  levelLabels,
  modalityLabels,
  salaryLabel,
  salaryPeriodLabels,
  salaryPeriods,
  todayPanama,
  type ApplicationStatus,
  type JobDTO,
  type OwnJobDTO,
  type ResumeDTO,
  type SaveResumeInput,
} from "@shared/jobs";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { AuthGate } from "@/features/membership/AuthGate";
import { Input } from "@/components/ui/input";
import "../realEstate/realEstate.css";
import "./jobs.css";
import FilterDrawer, { countActiveFilters } from "@/components/marketplace/FilterDrawer";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error");
const dateEs = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });
const centsFrom = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
function normalizePhone(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 8 ? `+507${d}` : d.length === 11 && d.startsWith("507") ? `+${d}` : v.trim();
}

function JobsHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="re-hero">
      <div>
        <p className="eyebrow">BUSCAR EMPLEO</p>
        <h1>{title}</h1>
        <p className="re-muted">{subtitle}</p>
      </div>
      <div className="jobs-actions">
        <Link href="/empleos/mi-cv" className="btn btn-outline">Mi CV</Link>
        <Link href="/empleos/mis-postulaciones" className="btn btn-outline">Mis postulaciones</Link>
        <Link href="/empleos/mis-vacantes" className="btn btn-gold">Publicar empleo</Link>
      </div>
    </div>
  );
}

function JobCard({ j }: { j: JobDTO }) {
  return (
    <Link href={`/empleos/${j.slug}`} className={`job-card ${j.featured ? "job-card--featured" : ""}`}>
      <div className="job-card-top">
        <span className="job-icon" aria-hidden="true"><BriefcaseBusiness size={22} /></span>
        <div>
          <h3>{j.title}</h3>
          <p className="re-muted">{j.company}</p>
        </div>
        {j.featured && <span className="job-featured"><Star size={12} /> Destacada</span>}
      </div>
      <div className="job-tags">
        <span>{areaLabels[j.area]}</span>
        <span>{jobTypeLabels[j.jobType]}</span>
        <span>{modalityLabels[j.modality]}</span>
      </div>
      <div className="job-card-bottom">
        <strong>{salaryLabel(j)}</strong>
        <span className="re-where"><MapPin size={14} /> {j.district}, {j.province}</span>
        <span className="re-muted re-small"><CalendarClock size={13} /> Cierra el {dateEs(j.closesOn)}</span>
      </div>
    </Link>
  );
}

// ───────────── Búsqueda ─────────────

export function JobListPage() {
  const [f, setF] = useState({ area: "", jobType: "", modality: "", province: "", minSalary: "", q: "" });
  const [page, setPage] = useState(1);
  const set = (k: keyof typeof f, v: string) => { setF(x => ({ ...x, [k]: v })); setPage(1); };
  const query = useMemo(() => {
    const out: Record<string, unknown> = { page };
    for (const k of ["area", "jobType", "modality", "province"] as const) if (f[k]) out[k] = f[k];
    if (centsFrom(f.minSalary)) out.minSalaryCents = centsFrom(f.minSalary);
    if (f.q.trim()) out.q = f.q.trim();
    return out as Parameters<typeof trpc.jobs.list.useQuery>[0];
  }, [f, page]);
  const list = trpc.jobs.list.useQuery(query);
  return (
    <div className="re-page container">
      <SectionShowcase section="empleos" />
      <JobsHeader title="Encuentra tu próximo empleo" subtitle="Vacantes de empresas y emprendedores en Panamá. Crea tu CV gratis y aplica con un clic." />
      <FilterDrawer active={countActiveFilters(f)}>
      <form className="re-filters" onSubmit={e => e.preventDefault()} aria-label="Filtros">
        <label>Área<select value={f.area} onChange={e => set("area", e.target.value)}><option value="">Todas</option>{jobAreas.map(a => <option key={a} value={a}>{areaLabels[a]}</option>)}</select></label>
        <label>Jornada<select value={f.jobType} onChange={e => set("jobType", e.target.value)}><option value="">Cualquiera</option>{jobTypes.map(a => <option key={a} value={a}>{jobTypeLabels[a]}</option>)}</select></label>
        <label>Modalidad<select value={f.modality} onChange={e => set("modality", e.target.value)}><option value="">Cualquiera</option>{jobModalities.map(a => <option key={a} value={a}>{modalityLabels[a]}</option>)}</select></label>
        <label>Provincia<select value={f.province} onChange={e => set("province", e.target.value)}><option value="">Todas</option>{provinceOptions.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Salario mínimo (US$)<Input inputMode="decimal" value={f.minSalary} onChange={e => set("minSalary", e.target.value)} placeholder="Ej.: 700" /></label>
        <label className="re-search filter-keep">Buscar<Input value={f.q} onChange={e => set("q", e.target.value)} placeholder="Cargo, empresa o palabra" /></label>
      </form>
      </FilterDrawer>
      {list.isLoading && <p role="status">Buscando vacantes…</p>}
      {list.error && <p className="member-error" role="alert">{list.error.message}</p>}
      {list.data && (
        <>
          <p className="re-muted">{list.data.total} {list.data.total === 1 ? "vacante" : "vacantes"}</p>
          {list.data.items.length === 0 ? (
            <div className="re-empty">
              <h2>No hay vacantes con esos filtros</h2>
              <p>Mientras tanto, prepara tu CV para aplicar en cuanto salga algo.</p>
              <Link href="/empleos/mi-cv" className="btn btn-gold">Crear mi CV</Link>
            </div>
          ) : (
            <div className="jobs-list">{list.data.items.map(j => <JobCard key={j.id} j={j} />)}</div>
          )}
          {list.data.total > list.data.pageSize && (
            <div className="re-pager">
              <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
              <span>Página {page} de {Math.ceil(list.data.total / list.data.pageSize)}</span>
              <button className="btn btn-outline" disabled={page * list.data.pageSize >= list.data.total} onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────────── Vacante ─────────────

export function JobDetailPage({ slug }: { slug: string }) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const detail = trpc.jobs.detail.useQuery({ slug }, { retry: false });
  const resume = trpc.jobs.myResume.useQuery(undefined, { enabled: Boolean(auth.user) });
  const apply = trpc.jobs.applyToJob.useMutation();
  const [message, setMessage] = useState("");
  if (detail.isLoading) return <div className="re-page container"><p role="status">Cargando…</p></div>;
  if (detail.error || !detail.data)
    return (
      <div className="re-page container re-empty">
        <h1>Esta vacante ya no está disponible</h1>
        <Link href="/empleos" className="btn btn-gold">Ver otras vacantes</Link>
      </div>
    );
  const { job: j, applied, isOwner } = detail.data;
  async function send() {
    try {
      await apply.mutateAsync({ jobId: j.id, message });
      await utils.jobs.detail.invalidate({ slug });
      toast.success("¡Postulación enviada! Te avisaremos por correo si te llaman a entrevista.");
    } catch (error) { toast.error(errorText(error)); }
  }
  return (
    <div className="re-page container">
      <nav className="re-crumbs" aria-label="Ruta"><Link href="/empleos">Empleos</Link> / <span>{j.title}</span></nav>
      <div className="re-detail">
        <div className="job-body">
          <h1>{j.title}</h1>
          <p className="job-company">{j.company}</p>
          <div className="job-tags">
            <span>{areaLabels[j.area]}</span><span>{jobTypeLabels[j.jobType]}</span><span>{modalityLabels[j.modality]}</span>
            {j.featured && <span className="job-tag-gold"><Star size={12} /> Destacada</span>}
          </div>
          <section className="re-section"><h2>Descripción del puesto</h2><p className="re-description">{j.description}</p></section>
          {j.requirements && <section className="re-section"><h2>Requisitos</h2><p className="re-description">{j.requirements}</p></section>}
          {j.benefits && <section className="re-section"><h2>Beneficios</h2><p className="re-description">{j.benefits}</p></section>}
        </div>
        <aside className="re-aside">
          <strong className="re-price">{salaryLabel(j)}</strong>
          <p className="re-where"><MapPin size={15} /> {j.district}, {j.province}</p>
          <p className="re-muted"><CalendarClock size={14} /> Recibe postulaciones hasta el {dateEs(j.closesOn)}</p>
          {isOwner ? (
            <Link href="/empleos/mis-vacantes" className="btn btn-outline">Es tu vacante: ver candidatos</Link>
          ) : !auth.user ? (
            <button className="btn btn-gold" onClick={startLogin}>Entra para aplicar</button>
          ) : applied ? (
            <div className="re-plan re-plan--ok"><p><strong>Ya aplicaste.</strong> Estado: {applicationStatusLabels[applied]}.</p></div>
          ) : !resume.data ? (
            <div className="re-plan"><p><strong>Para aplicar, primero crea tu CV.</strong> Es gratis y lo usas para todas las vacantes.</p><Link href="/empleos/mi-cv" className="btn btn-gold">Crear mi CV</Link></div>
          ) : (
            <div className="job-apply">
              <label>Mensaje para la empresa (opcional)
                <textarea rows={4} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Cuéntales por qué eres buena opción para el puesto." />
              </label>
              <button className="btn btn-gold" disabled={apply.isPending} onClick={() => void send()}>{apply.isPending ? "Enviando…" : "Aplicar con mi CV"}</button>
              <p className="re-muted re-small">La empresa verá tu CV, tu celular y tu correo. Nadie más.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ───────────── CV ─────────────

const emptyResume: SaveResumeInput = {
  fullName: "", headline: "", summary: "", phone: "", email: "", province: "Panamá", availability: "inmediata",
  experience: [], education: [], skills: [], languages: [],
};

export function ResumePage() {
  return <AuthGate><ResumeContent /></AuthGate>;
}

function ResumeContent() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const mine = trpc.jobs.myResume.useQuery();
  const save = trpc.jobs.saveResume.useMutation();
  const [cv, setCv] = useState<SaveResumeInput>(emptyResume);
  const [skillsText, setSkillsText] = useState("");
  useEffect(() => {
    if (mine.data) {
      const { updatedAt: _ignored, ...rest } = mine.data;
      setCv(rest);
      setSkillsText(rest.skills.join(", "));
    } else if (mine.isSuccess && auth.user) {
      setCv(c => ({ ...c, fullName: c.fullName || auth.user?.name || "", email: c.email || auth.user?.email || "" }));
    }
  }, [mine.data, mine.isSuccess, auth.user]);
  const set = <K extends keyof SaveResumeInput>(k: K, v: SaveResumeInput[K]) => setCv(c => ({ ...c, [k]: v }));
  const updateItem = <K extends "experience" | "education" | "languages">(k: K, i: number, patch: Partial<SaveResumeInput[K][number]>) =>
    setCv(c => ({ ...c, [k]: (c[k] as any[]).map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const removeItem = (k: "experience" | "education" | "languages", i: number) => setCv(c => ({ ...c, [k]: (c[k] as any[]).filter((_, idx) => idx !== i) }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        ...cv,
        phone: normalizePhone(cv.phone),
        skills: skillsText.split(",").map(s => s.trim()).filter(Boolean).slice(0, 30),
        experience: cv.experience.map(x => ({ ...x, end: x.current ? null : x.end || null })),
      });
      await utils.jobs.myResume.invalidate();
      toast.success("CV guardado");
    } catch (error) { toast.error(errorText(error)); }
  }

  return (
    <div className="re-page container">
      <div className="re-hero no-print">
        <div>
          <p className="eyebrow">BUSCAR EMPLEO</p>
          <h1>Mi CV</h1>
          <p className="re-muted">Créalo una vez y úsalo para aplicar a todas las vacantes. Solo lo ven las empresas a las que aplicas.</p>
        </div>
        <div className="jobs-actions">
          <Link href="/empleos" className="btn btn-outline">Ver vacantes</Link>
          {mine.data && <button className="btn btn-gold" onClick={() => window.print()}>Descargar PDF</button>}
        </div>
      </div>
      <div className="cv-layout">
        <form className="re-form no-print" onSubmit={submit}>
          <fieldset>
            <legend>Datos personales</legend>
            <div className="re-row">
              <label>Nombre completo<Input value={cv.fullName} onChange={e => set("fullName", e.target.value)} required maxLength={120} /></label>
              <label>Oficio o profesión<Input value={cv.headline} onChange={e => set("headline", e.target.value)} required maxLength={120} placeholder="Ej.: Cajera con experiencia, Técnico en refrigeración" /></label>
              <label>Celular<Input inputMode="tel" value={cv.phone} onChange={e => set("phone", e.target.value)} required placeholder="6123-4567" /></label>
              <label>Correo<Input type="email" value={cv.email} onChange={e => set("email", e.target.value)} maxLength={254} /></label>
              <label>Provincia<select value={cv.province} onChange={e => set("province", e.target.value as SaveResumeInput["province"])}>{provinceOptions.map(p => <option key={p}>{p}</option>)}</select></label>
              <label>Disponibilidad<select value={cv.availability} onChange={e => set("availability", e.target.value as SaveResumeInput["availability"])}>{availabilities.map(a => <option key={a} value={a}>{availabilityLabels[a]}</option>)}</select></label>
            </div>
            <label>Sobre mí<textarea rows={4} maxLength={1500} value={cv.summary} onChange={e => set("summary", e.target.value)} placeholder="En pocas líneas: quién eres, qué sabes hacer y qué buscas." /></label>
          </fieldset>
          <fieldset>
            <legend>Experiencia</legend>
            {cv.experience.map((x, i) => (
              <div className="cv-item" key={i}>
                <div className="re-row">
                  <label>Cargo<Input value={x.role} onChange={e => updateItem("experience", i, { role: e.target.value })} required /></label>
                  <label>Empresa<Input value={x.company} onChange={e => updateItem("experience", i, { company: e.target.value })} required /></label>
                  <label>Desde<Input type="month" value={x.start} onChange={e => updateItem("experience", i, { start: e.target.value })} required /></label>
                  {!x.current && <label>Hasta<Input type="month" value={x.end ?? ""} onChange={e => updateItem("experience", i, { end: e.target.value || null })} /></label>}
                </div>
                <label className="re-check-inline"><input type="checkbox" checked={x.current} onChange={e => updateItem("experience", i, { current: e.target.checked })} /> Trabajo aquí actualmente</label>
                <label>Qué hacías<textarea rows={2} maxLength={1000} value={x.description} onChange={e => updateItem("experience", i, { description: e.target.value })} /></label>
                <button type="button" className="re-back" onClick={() => removeItem("experience", i)}>Quitar</button>
              </div>
            ))}
            {cv.experience.length < 15 && <button type="button" className="btn btn-outline" onClick={() => set("experience", [...cv.experience, { company: "", role: "", start: "", end: null, current: false, description: "" }])}>+ Agregar experiencia</button>}
          </fieldset>
          <fieldset>
            <legend>Estudios</legend>
            {cv.education.map((x, i) => (
              <div className="cv-item" key={i}>
                <div className="re-row">
                  <label>Título o nivel<Input value={x.degree} onChange={e => updateItem("education", i, { degree: e.target.value })} required placeholder="Ej.: Bachiller en Comercio" /></label>
                  <label>Institución<Input value={x.institution} onChange={e => updateItem("education", i, { institution: e.target.value })} required /></label>
                  <label>Año<Input inputMode="numeric" value={x.year} onChange={e => updateItem("education", i, { year: e.target.value })} placeholder="2018" /></label>
                </div>
                <button type="button" className="re-back" onClick={() => removeItem("education", i)}>Quitar</button>
              </div>
            ))}
            {cv.education.length < 10 && <button type="button" className="btn btn-outline" onClick={() => set("education", [...cv.education, { institution: "", degree: "", year: "" }])}>+ Agregar estudio</button>}
          </fieldset>
          <fieldset>
            <legend>Habilidades e idiomas</legend>
            <label>Habilidades (sepáralas con comas)<Input value={skillsText} onChange={e => setSkillsText(e.target.value)} placeholder="Ej.: Excel, atención al cliente, licencia de conducir" /></label>
            {cv.languages.map((x, i) => (
              <div className="re-row" key={i}>
                <label>Idioma<Input value={x.language} onChange={e => updateItem("languages", i, { language: e.target.value })} required /></label>
                <label>Nivel<select value={x.level} onChange={e => updateItem("languages", i, { level: e.target.value as (typeof languageLevels)[number] })}>{languageLevels.map(l => <option key={l} value={l}>{levelLabels[l]}</option>)}</select></label>
                <button type="button" className="re-back" onClick={() => removeItem("languages", i)}>Quitar</button>
              </div>
            ))}
            {cv.languages.length < 8 && <button type="button" className="btn btn-outline" onClick={() => set("languages", [...cv.languages, { language: "", level: "intermedio" }])}>+ Agregar idioma</button>}
          </fieldset>
          <div className="re-form-actions"><button className="btn btn-gold" type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar CV"}</button></div>
        </form>
        <CvSheet cv={{ ...cv, skills: skillsText.split(",").map(s => s.trim()).filter(Boolean) }} />
      </div>
    </div>
  );
}

/** Hoja del CV: vista previa en pantalla y lo único que se imprime en el PDF. */
function CvSheet({ cv }: { cv: Omit<ResumeDTO, "updatedAt"> }) {
  const month = (ym: string | null) => (ym ? new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("es-PA", { month: "short", year: "numeric" }) : "");
  return (
    <article className="cv-sheet" aria-label="Vista previa del CV">
      <header>
        <h2>{cv.fullName || "Tu nombre"}</h2>
        <p className="cv-headline">{cv.headline || "Tu oficio o profesión"}</p>
        <p className="cv-contact">{[cv.phone, cv.email, cv.province, `Disponibilidad: ${availabilityLabels[cv.availability]}`].filter(Boolean).join(" · ")}</p>
      </header>
      {cv.summary && <section><h3>Sobre mí</h3><p>{cv.summary}</p></section>}
      {cv.experience.length > 0 && (
        <section>
          <h3>Experiencia</h3>
          {cv.experience.map((x, i) => (
            <div className="cv-entry" key={i}>
              <strong>{x.role}{x.company ? ` · ${x.company}` : ""}</strong>
              <span className="cv-dates">{month(x.start)} – {x.current ? "Actualidad" : month(x.end)}</span>
              {x.description && <p>{x.description}</p>}
            </div>
          ))}
        </section>
      )}
      {cv.education.length > 0 && (
        <section>
          <h3>Estudios</h3>
          {cv.education.map((x, i) => <div className="cv-entry" key={i}><strong>{x.degree}</strong> <span className="cv-dates">{x.institution}{x.year ? ` · ${x.year}` : ""}</span></div>)}
        </section>
      )}
      {cv.skills.length > 0 && <section><h3>Habilidades</h3><p>{cv.skills.join(" · ")}</p></section>}
      {cv.languages.length > 0 && <section><h3>Idiomas</h3><p>{cv.languages.map(l => `${l.language} (${levelLabels[l.level]})`).join(" · ")}</p></section>}
      <footer className="cv-footer">CV creado en CuadraZone</footer>
    </article>
  );
}

// ───────────── Mis postulaciones ─────────────

export function MyApplicationsPage() {
  return <AuthGate><MyApplicationsContent /></AuthGate>;
}
function MyApplicationsContent() {
  const list = trpc.jobs.myApplications.useQuery();
  return (
    <div className="re-page container">
      <JobsHeader title="Mis postulaciones" subtitle="El estado de cada vacante a la que aplicaste." />
      {list.isLoading && <p role="status">Cargando…</p>}
      {list.data && list.data.length === 0 && <div className="re-empty"><h2>Aún no has aplicado a ninguna vacante</h2><Link href="/empleos" className="btn btn-gold">Ver vacantes</Link></div>}
      <ul className="re-mine">
        {list.data?.map(a => (
          <li key={a.id} className="job-app-row">
            <div>
              <strong>{a.job.title}</strong>
              <span className="re-muted">{a.job.company} · {a.job.province} · aplicaste el {dateEs(a.appliedAt)}</span>
              <span className={`re-status job-status--${a.status}`}>{applicationStatusLabels[a.status]}</span>
            </div>
            {a.job.open && <Link className="btn btn-outline" href={`/empleos/${a.job.slug}`}>Ver vacante</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── Mis vacantes (empresa) ─────────────

type JobForm = {
  id?: number; expectedRevision?: number; title: string; company: string; area: string; jobType: string; modality: string;
  province: string; district: string; salaryNegotiable: boolean; salaryMin: string; salaryMax: string; salaryPeriod: string;
  description: string; requirements: string; benefits: string; closesOn: string;
};
const plusDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const emptyJob = (): JobForm => ({
  title: "", company: "", area: "ventas", jobType: "tiempo_completo", modality: "presencial", province: "Panamá", district: "",
  salaryNegotiable: false, salaryMin: "", salaryMax: "", salaryPeriod: "mes", description: "", requirements: "", benefits: "", closesOn: plusDays(30),
});
const jobFormFrom = (j: OwnJobDTO): JobForm => ({
  id: j.id, expectedRevision: j.revision, title: j.title, company: j.company, area: j.area, jobType: j.jobType, modality: j.modality,
  province: j.province, district: j.district, salaryNegotiable: j.salaryNegotiable, salaryMin: j.salaryMinCents ? String(j.salaryMinCents / 100) : "",
  salaryMax: j.salaryMaxCents ? String(j.salaryMaxCents / 100) : "", salaryPeriod: j.salaryPeriod, description: j.description,
  requirements: j.requirements, benefits: j.benefits, closesOn: j.closesOn,
});

export function MyJobsPage() {
  return <AuthGate><MyJobsContent /></AuthGate>;
}
function MyJobsContent() {
  const utils = trpc.useUtils();
  const mine = trpc.jobs.mine.useQuery();
  const save = trpc.jobs.save.useMutation();
  const setStatus = trpc.jobs.setStatus.useMutation();
  const remove = trpc.jobs.remove.useMutation();
  const [form, setForm] = useState<JobForm | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const set = <K extends keyof JobForm>(k: K, v: JobForm[K]) => setForm(x => (x ? { ...x, [k]: v } : x));
  const plan = mine.data?.plan;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      await save.mutateAsync({
        ...(form.id ? { id: form.id, expectedRevision: form.expectedRevision } : {}),
        title: form.title, company: form.company, area: form.area, jobType: form.jobType, modality: form.modality, province: form.province,
        district: form.district, salaryNegotiable: form.salaryNegotiable, salaryMinCents: centsFrom(form.salaryMin), salaryMaxCents: centsFrom(form.salaryMax),
        salaryPeriod: form.salaryPeriod, description: form.description, requirements: form.requirements, benefits: form.benefits, closesOn: form.closesOn,
      });
      await utils.jobs.mine.invalidate();
      setForm(null);
      toast.success("Vacante guardada. Publícala desde la lista.");
    } catch (error) { toast.error(errorText(error)); }
  }
  async function changeStatus(id: number, status: "published" | "paused" | "closed" | "draft") {
    try { await setStatus.mutateAsync({ id, status }); await utils.jobs.mine.invalidate(); toast.success(status === "published" ? "¡Vacante publicada!" : "Estado actualizado"); }
    catch (error) { toast.error(errorText(error)); }
  }

  if (viewing) return <Applicants jobId={viewing} onBack={() => { setViewing(null); void utils.jobs.mine.invalidate(); }} />;

  if (form)
    return (
      <div className="re-page container">
        <button className="re-back" onClick={() => setForm(null)}>← Mis vacantes</button>
        <h1>{form.id ? "Editar vacante" : "Nueva vacante"}</h1>
        <form className="re-form" onSubmit={submit}>
          <fieldset>
            <legend>El puesto</legend>
            <div className="re-row">
              <label>Cargo<Input value={form.title} onChange={e => set("title", e.target.value)} required maxLength={120} placeholder="Ej.: Vendedora de mostrador" /></label>
              <label>Empresa o tu nombre<Input value={form.company} onChange={e => set("company", e.target.value)} required maxLength={120} /></label>
              <label>Área<select value={form.area} onChange={e => set("area", e.target.value)}>{jobAreas.map(a => <option key={a} value={a}>{areaLabels[a]}</option>)}</select></label>
              <label>Jornada<select value={form.jobType} onChange={e => set("jobType", e.target.value)}>{jobTypes.map(a => <option key={a} value={a}>{jobTypeLabels[a]}</option>)}</select></label>
              <label>Modalidad<select value={form.modality} onChange={e => set("modality", e.target.value)}>{jobModalities.map(a => <option key={a} value={a}>{modalityLabels[a]}</option>)}</select></label>
              <label>Provincia<select value={form.province} onChange={e => set("province", e.target.value)}>{provinceOptions.map(p => <option key={p}>{p}</option>)}</select></label>
              <label>Distrito<Input value={form.district} onChange={e => set("district", e.target.value)} required /></label>
              <label>Recibir postulaciones hasta<Input type="date" min={todayPanama()} value={form.closesOn} onChange={e => set("closesOn", e.target.value)} required /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Salario</legend>
            <label className="re-check-inline"><input type="checkbox" checked={form.salaryNegotiable} onChange={e => set("salaryNegotiable", e.target.checked)} /> Salario a convenir</label>
            {!form.salaryNegotiable && (
              <div className="re-row">
                <label>Desde (US$)<Input inputMode="decimal" value={form.salaryMin} onChange={e => set("salaryMin", e.target.value)} required /></label>
                <label>Hasta (US$, opcional)<Input inputMode="decimal" value={form.salaryMax} onChange={e => set("salaryMax", e.target.value)} /></label>
                <label>Período<select value={form.salaryPeriod} onChange={e => set("salaryPeriod", e.target.value)}>{salaryPeriods.map(p => <option key={p} value={p}>{salaryPeriodLabels[p]}</option>)}</select></label>
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Detalles</legend>
            <label>Descripción del puesto<textarea rows={5} maxLength={5000} value={form.description} onChange={e => set("description", e.target.value)} required placeholder="Qué hará la persona, horario, lugar de trabajo…" /></label>
            <label>Requisitos<textarea rows={3} maxLength={3000} value={form.requirements} onChange={e => set("requirements", e.target.value)} placeholder="Experiencia, estudios, licencia, edad…" /></label>
            <label>Beneficios<textarea rows={3} maxLength={2000} value={form.benefits} onChange={e => set("benefits", e.target.value)} placeholder="Seguro social, décimo tercer mes, comisiones, transporte…" /></label>
          </fieldset>
          <div className="re-form-actions"><button className="btn btn-gold" type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar vacante"}</button></div>
        </form>
      </div>
    );

  return (
    <div className="re-page container">
      <div className="re-hero">
        <div><p className="eyebrow">BUSCAR EMPLEO</p><h1>Mis vacantes</h1></div>
        <button className="btn btn-gold" onClick={() => setForm(emptyJob())}>+ Nueva vacante</button>
      </div>
      {plan && (
        <div className={`re-plan ${plan.active ? "re-plan--ok" : ""}`}>
          {plan.active ? (
            <p><strong>Plan activo{plan.featured ? " · Mayor Visibilidad (tus vacantes salen destacadas)" : ""}</strong> hasta el {new Date(plan.endsAt!).toLocaleDateString("es-PA", { timeZone: "America/Panama" })}.</p>
          ) : (
            <p><strong>Para publicar vacantes necesitas un plan:</strong> Normal (US$19.99 al mes) o Mayor Visibilidad (US$39.99 al mes). El mismo plan te sirve para empleos, autos y bienes raíces. Paga por Yappy y escríbenos con el correo o celular de tu cuenta para activarlo.</p>
          )}
        </div>
      )}
      {mine.isLoading && <p role="status">Cargando…</p>}
      {mine.data && mine.data.jobs.length === 0 && <div className="re-empty"><h2>Aún no tienes vacantes</h2><p>Publica tu primera vacante y recibe CVs de candidatos en Panamá.</p></div>}
      <ul className="re-mine">
        {mine.data?.jobs.map(j => (
          <li key={j.id} className="job-app-row">
            <div>
              <strong>{j.title}</strong>
              <span className="re-muted">{j.company} · {salaryLabel(j)} · cierra el {dateEs(j.closesOn)}</span>
              <span className={`re-status re-status--${j.status}`}>{jobStatusLabels[j.status]}</span>
            </div>
            <div className="re-mine-actions">
              <button className="btn btn-gold" onClick={() => setViewing(j.id)}>Candidatos ({j.applicants}){j.newApplicants ? ` · ${j.newApplicants} nuevos` : ""}</button>
              <button className="btn btn-outline" onClick={() => setForm(jobFormFrom(j))}>Editar</button>
              {j.status !== "published" && <button className="btn btn-outline" onClick={() => void changeStatus(j.id, "published")}>Publicar</button>}
              {j.status === "published" && <Link className="btn btn-outline" href={`/empleos/${j.slug}`}>Ver</Link>}
              {j.status === "published" && <button className="btn btn-outline" onClick={() => void changeStatus(j.id, "closed")}>Cerrar vacante</button>}
              <button className="btn btn-outline" onClick={async () => { if (confirm("¿Borrar esta vacante y sus postulaciones?")) { await remove.mutateAsync({ id: j.id }); await utils.jobs.mine.invalidate(); } }}>Borrar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Applicants({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const data = trpc.jobs.applicants.useQuery({ id: jobId });
  const setStatus = trpc.jobs.setApplicationStatus.useMutation();
  const [open, setOpen] = useState<number | null>(null);
  async function change(id: number, status: ApplicationStatus) {
    try { await setStatus.mutateAsync({ id, status }); await utils.jobs.applicants.invalidate({ id: jobId }); }
    catch (error) { toast.error(errorText(error)); }
  }
  async function toggle(id: number, status: ApplicationStatus) {
    setOpen(open === id ? null : id);
    if (open !== id && status === "enviada") await change(id, "vista");
  }
  return (
    <div className="re-page container">
      <button className="re-back" onClick={onBack}>← Mis vacantes</button>
      <h1>Candidatos{data.data ? `: ${data.data.job.title}` : ""}</h1>
      {data.isLoading && <p role="status">Cargando…</p>}
      {data.data && data.data.applicants.length === 0 && <div className="re-empty"><h2>Todavía nadie ha aplicado</h2><p>Comparte el enlace de tu vacante para recibir más candidatos.</p></div>}
      <ul className="re-mine">
        {data.data?.applicants.map(a => {
          const digits = a.resume.phone.replace(/\D/g, "");
          return (
            <li key={a.id} className="job-applicant">
              <div className="job-applicant-head">
                <div>
                  <strong>{a.resume.fullName}</strong>
                  <span className="re-muted">{a.resume.headline} · {a.resume.province} · aplicó el {dateEs(a.appliedAt)}</span>
                </div>
                <select aria-label="Estado de la postulación" value={a.status} onChange={e => void change(a.id, e.target.value as ApplicationStatus)}>
                  {applicationStatuses.map(s => <option key={s} value={s}>{applicationStatusLabels[s]}</option>)}
                </select>
              </div>
              {a.message && <p className="job-message">«{a.message}»</p>}
              <div className="re-mine-actions">
                <button className="btn btn-outline" onClick={() => void toggle(a.id, a.status)}>{open === a.id ? "Ocultar CV" : "Ver CV"}</button>
                <a className="btn btn-gold" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className="btn btn-outline" href={`tel:${a.resume.phone}`}>Llamar</a>
                {a.resume.email && <a className="btn btn-outline" href={`mailto:${a.resume.email}`}>Correo</a>}
              </div>
              {open === a.id && <CvSheet cv={a.resume} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
