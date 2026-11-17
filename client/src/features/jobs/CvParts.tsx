import { useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  MAX_SKILLS,
  jobUsd,
  languageLevels,
  levelLabels,
  skillGroups,
  suggestedLanguages,
} from "@shared/jobs";
import { monthlyCents, netSalary } from "@shared/netSalary";

/** Botones para marcar o desmarcar opciones con un clic. */
export function ToggleChips<T extends string>({
  options,
  labels,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T[];
  onChange: (next: T[]) => void;
  label: string;
}) {
  return (
    <div className="cv-chips" role="group" aria-label={label}>
      {options.map(option => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`cv-chip ${on ? "is-on" : ""}`}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter(v => v !== option) : [...value, option])
            }
          >
            {on && <Check size={14} aria-hidden="true" />}
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

/** Habilidades: se marcan con un clic, por grupos, y se pueden escribir otras. */
export function SkillPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [other, setOther] = useState("");
  const suggested = new Set(skillGroups.flatMap(g => g.skills));
  const custom = value.filter(s => !suggested.has(s));
  const full = value.length >= MAX_SKILLS;
  const toggle = (skill: string) => {
    if (value.includes(skill)) onChange(value.filter(s => s !== skill));
    else if (full) toast.error(`Puedes marcar hasta ${MAX_SKILLS} habilidades`);
    else onChange([...value, skill]);
  };
  const addOther = () => {
    const skill = other.trim().slice(0, 60);
    if (!skill) return;
    if (value.some(s => s.toLowerCase() === skill.toLowerCase())) {
      setOther("");
      return;
    }
    if (full) {
      toast.error(`Puedes marcar hasta ${MAX_SKILLS} habilidades`);
      return;
    }
    onChange([...value, skill]);
    setOther("");
  };
  return (
    <div className="cv-skills">
      <p className="re-muted re-small">
        Toca las que sabes hacer ({value.length} de {MAX_SKILLS}).
      </p>
      {skillGroups.map(group => (
        <div key={group.title} className="cv-skill-group">
          <span className="cv-skill-title">{group.title}</span>
          <div className="cv-chips" role="group" aria-label={group.title}>
            {group.skills.map(skill => {
              const on = value.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  className={`cv-chip ${on ? "is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(skill)}
                >
                  {on && <Check size={14} aria-hidden="true" />}
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="cv-skill-group">
        <span className="cv-skill-title">Otras habilidades</span>
        {custom.length > 0 && (
          <div className="cv-chips">
            {custom.map(skill => (
              <button
                key={skill}
                type="button"
                className="cv-chip is-on"
                aria-label={`Quitar ${skill}`}
                onClick={() => toggle(skill)}
              >
                {skill}
                <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <div className="cv-other">
          <Input
            value={other}
            maxLength={60}
            onChange={e => setOther(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
            placeholder="Escribe otra habilidad"
            aria-label="Otra habilidad"
          />
          <button type="button" className="btn btn-outline" onClick={addOther}>
            <Plus size={16} aria-hidden="true" /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

type LanguageEntry = { language: string; level: (typeof languageLevels)[number] };

/** Idiomas: se agregan con un clic y luego se elige el nivel de cada uno. */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: LanguageEntry[];
  onChange: (next: LanguageEntry[]) => void;
}) {
  const [other, setOther] = useState("");
  const has = (name: string) =>
    value.some(l => l.language.toLowerCase() === name.toLowerCase());
  const full = value.length >= 8;
  const add = (name: string) => {
    const language = name.trim().slice(0, 40);
    if (language.length < 2 || has(language)) return;
    if (full) {
      toast.error("Puedes agregar hasta 8 idiomas");
      return;
    }
    onChange([...value, { language, level: "intermedio" }]);
  };
  const toggle = (name: string) =>
    has(name)
      ? onChange(value.filter(l => l.language.toLowerCase() !== name.toLowerCase()))
      : add(name);
  return (
    <div className="cv-skills">
      <p className="re-muted re-small">Toca los idiomas que hablas y elige tu nivel.</p>
      <div className="cv-chips" role="group" aria-label="Idiomas">
        {suggestedLanguages.map(name => {
          const on = has(name);
          return (
            <button
              key={name}
              type="button"
              className={`cv-chip ${on ? "is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(name)}
            >
              {on && <Check size={14} aria-hidden="true" />}
              {name}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <ul className="cv-languages">
          {value.map((l, i) => (
            <li key={l.language}>
              <strong>{l.language}</strong>
              <select
                aria-label={`Nivel de ${l.language}`}
                value={l.level}
                onChange={e =>
                  onChange(
                    value.map((x, idx) =>
                      idx === i ? { ...x, level: e.target.value as LanguageEntry["level"] } : x
                    )
                  )
                }
              >
                {languageLevels.map(level => (
                  <option key={level} value={level}>{levelLabels[level]}</option>
                ))}
              </select>
              <button
                type="button"
                className="re-back"
                aria-label={`Quitar ${l.language}`}
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="cv-other">
        <Input
          value={other}
          maxLength={40}
          onChange={e => setOther(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(other);
              setOther("");
            }
          }}
          placeholder="Otro idioma"
          aria-label="Otro idioma"
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            add(other);
            setOther("");
          }}
        >
          <Plus size={16} aria-hidden="true" /> Agregar
        </button>
      </div>
    </div>
  );
}

/** Sube la foto del CV de quien tiene la sesión abierta. */
export async function uploadResumePhoto(file: File): Promise<string> {
  const r = await fetch("/api/resume/photo", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": file.type, "x-cz-request": "1" },
    body: file,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "No se pudo subir la foto");
  return data.url as string;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Foto de perfil del CV. Con el CV guardado se sube al momento; si todavía no
 * se ha guardado, la foto elegida se muestra y se sube al guardar el CV.
 */
export function ResumePhoto({
  photoUrl,
  saved,
  pendingUrl,
  onPick,
}: {
  photoUrl: string;
  saved: boolean;
  pendingUrl?: string;
  onPick: (file: File) => void;
}) {
  const utils = trpc.useUtils();
  const remove = trpc.jobs.removeResumePhoto.useMutation();
  const [uploading, setUploading] = useState(false);
  const shown = pendingUrl || photoUrl;
  async function choose(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error("La foto debe ser JPG, PNG o WEBP");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("La foto debe pesar como máximo 5 MB");
      return;
    }
    if (!saved) {
      onPick(file);
      return;
    }
    setUploading(true);
    try {
      await uploadResumePhoto(file);
      await utils.jobs.myResume.invalidate();
      toast.success("Foto agregada a tu CV");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="cv-photo-field">
      <label className="cv-photo-frame cv-photo-frame--pick" title="Elegir foto">
        {shown ? (
          <img src={shown} alt="Tu foto de perfil" />
        ) : (
          <span className="cv-photo-empty">
            <Camera size={26} aria-hidden="true" />
            Agregar
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={uploading}
          onChange={e => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <div>
        <strong>Foto de perfil</strong>
        <p className="re-muted re-small">
          Una foto de frente, con buena luz. Solo la ven las empresas donde
          aplicas. JPG, PNG o WEBP de hasta 5 MB.
        </p>
        <div className="cv-photo-actions">
          <label className="btn btn-gold">
            <Camera size={16} aria-hidden="true" />
            {uploading ? "Subiendo…" : shown ? "Cambiar foto" : "Agregar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={uploading}
              onChange={e => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {photoUrl && !pendingUrl && (
            <button
              type="button"
              className="re-back"
              onClick={async () => {
                await remove.mutateAsync();
                await utils.jobs.myResume.invalidate();
              }}
            >
              Quitar foto
            </button>
          )}
        </div>
        {pendingUrl && (
          <p className="cv-photo-note">
            Foto lista. Se sube cuando guardes tu CV.
          </p>
        )}
      </div>
    </div>
  );
}

/** Calculadora: cuánto llega al bolsillo después de CSS, Seguro Educativo e ISR. */
export function SalaryCalculator({
  initialCents,
  initialPeriod = "mes",
  compact = false,
}: {
  initialCents?: number | null;
  initialPeriod?: "mes" | "quincena";
  compact?: boolean;
}) {
  const [amount, setAmount] = useState(
    initialCents ? String(initialCents / 100) : ""
  );
  const [period, setPeriod] = useState<"mes" | "quincena">(initialPeriod);
  const value = Number(amount.replace(/[,\s]/g, ""));
  const gross =
    amount.trim() !== "" && Number.isFinite(value) && value > 0
      ? monthlyCents(Math.round(value * 100), period)
      : null;
  const r = gross ? netSalary(gross) : null;
  return (
    <section className={`salary-calc ${compact ? "salary-calc--compact" : ""}`} aria-labelledby="salary-calc-title">
      <h2 id="salary-calc-title">¿Cuánto me queda de salario?</h2>
      {!compact && (
        <p className="re-muted re-small">
          Escribe el salario bruto y te decimos cuánto recibes después de los
          descuentos de ley en Panamá.
        </p>
      )}
      <div className="salary-calc-inputs">
        <label>
          Salario bruto (US$)
          <Input
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Ej.: 1000"
          />
        </label>
        <label>
          Cada
          <select value={period} onChange={e => setPeriod(e.target.value as "mes" | "quincena")}>
            <option value="mes">Mes</option>
            <option value="quincena">Quincena</option>
          </select>
        </label>
      </div>
      {r && (
        <>
          <dl className="salary-calc-rows">
            <div><dt>Salario bruto al mes</dt><dd>{jobUsd(r.grossCents)}</dd></div>
            <div><dt>Seguro Social (9.75%)</dt><dd>− {jobUsd(r.cssCents)}</dd></div>
            <div><dt>Seguro Educativo (1.25%)</dt><dd>− {jobUsd(r.educationCents)}</dd></div>
            <div><dt>Impuesto sobre la renta</dt><dd>{r.incomeTaxCents ? `− ${jobUsd(r.incomeTaxCents)}` : "No pagas"}</dd></div>
            <div className="salary-calc-total"><dt>Te queda al mes</dt><dd>{jobUsd(r.netCents)}</dd></div>
            <div><dt>Cada quincena</dt><dd>{jobUsd(r.netQuincenaCents)}</dd></div>
          </dl>
        </>
      )}
      <p className="re-muted re-small">
        Cálculo aproximado. El impuesto sobre la renta se paga si ganas más de
        US$11,000 al año (contando el décimo tercer mes). Otros descuentos, como
        préstamos o pensiones, no están incluidos.
      </p>
    </section>
  );
}
