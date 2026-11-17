import { useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { importSummary, type ImportedResume } from "@shared/cvImport";

/**
 * «¿Ya tienes tu CV en PDF?»: lo leemos y llenamos el formulario. La persona
 * revisa, corrige y guarda; el PDF no se guarda.
 */
export function CvImport({ onImport }: { onImport: (resume: ImportedResume) => void }) {
  const [reading, setReading] = useState(false);
  async function read(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Elige tu CV en PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El PDF debe pesar como máximo 5 MB");
      return;
    }
    setReading(true);
    try {
      const r = await fetch("/api/resume/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/pdf", "x-cz-request": "1" },
        body: file,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No pudimos leer este PDF");
      const resume = (data.resume ?? {}) as ImportedResume;
      const found = importSummary(resume);
      if (!found.length) {
        toast.error("No encontramos datos en este PDF. Llena el CV a mano.");
        return;
      }
      onImport(resume);
      toast.success(`Listo: tomamos ${found.join(", ")}.`, {
        description: "Revisa cada parte, corrige lo que haga falta y pulsa «Guardar CV».",
        duration: 9000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos leer este PDF");
    } finally {
      setReading(false);
    }
  }
  return (
    <section className="cv-import no-print" aria-labelledby="cv-import-title">
      <span className="cv-import-icon" aria-hidden="true">
        <FileUp size={22} />
      </span>
      <div>
        <h2 id="cv-import-title">¿Ya tienes tu CV en PDF?</h2>
        <p>
          Súbelo y llenamos el formulario por ti. Después revisas, corriges y
          guardas. No guardamos el PDF.
        </p>
      </div>
      <label className="btn btn-gold">
        {reading ? "Leyendo tu CV…" : "Subir mi CV en PDF"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          hidden
          disabled={reading}
          onChange={e => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
