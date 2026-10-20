import { z } from "zod";

/** Lista suministrada por el operador: 11 categorías y 96 especialidades. */
export const businessCategories = [
  {
    id: "viajes-y-turismo",
    label: "Viajes y turismo",
    specialties: [
      {
        id: "viajes-y-turismo-01",
        label: "Agencias de viajes",
      },
      {
        id: "viajes-y-turismo-02",
        label: "Viajes a Tierra Santa",
      },
      {
        id: "viajes-y-turismo-03",
        label: "Excursiones y turismo local",
      },
      {
        id: "viajes-y-turismo-04",
        label: "Hospedaje y alquiler de casas de playa o montaña",
      },
    ],
  },
  {
    id: "cuidado-familiar",
    label: "Cuidado familiar",
    specialties: [
      {
        id: "cuidado-familiar-01",
        label: "Niñeras",
      },
      {
        id: "cuidado-familiar-02",
        label: "Cuidado de adultos mayores",
      },
      {
        id: "cuidado-familiar-03",
        label: "Asistencia para personas con discapacidad",
      },
      {
        id: "cuidado-familiar-04",
        label: "Servicio doméstico",
      },
    ],
  },
  {
    id: "tramites-y-oficina",
    label: "Trámites y oficina",
    specialties: [
      {
        id: "tramites-y-oficina-01",
        label: "Gestoría de trámites (permisos, Registro Público, municipio)",
      },
      {
        id: "tramites-y-oficina-02",
        label: "Impresión, copias y encuadernación",
      },
      {
        id: "tramites-y-oficina-03",
        label: "Rotulación y letreros",
      },
      {
        id: "tramites-y-oficina-04",
        label: "Sellos y placas",
      },
      {
        id: "tramites-y-oficina-05",
        label: "Servicio de secretaría y asistentes virtuales",
      },
      {
        id: "tramites-y-oficina-06",
        label: "Notaría y autenticaciones",
      },
    ],
  },
  {
    id: "tecnologia-y-digital",
    label: "Tecnología y digital",
    specialties: [
      {
        id: "tecnologia-y-digital-01",
        label: "Reparación de celulares y computadoras",
      },
      {
        id: "tecnologia-y-digital-02",
        label: "Desarrollo de páginas web y apps",
      },
      {
        id: "tecnologia-y-digital-03",
        label: "Diseño gráfico",
      },
      {
        id: "tecnologia-y-digital-04",
        label: "Manejo de redes sociales",
      },
      {
        id: "tecnologia-y-digital-05",
        label: "Marketing digital y publicidad",
      },
      {
        id: "tecnologia-y-digital-06",
        label: "Edición de video",
      },
      {
        id: "tecnologia-y-digital-07",
        label: "Soporte técnico e instalación de redes",
      },
      {
        id: "tecnologia-y-digital-08",
        label: "Automatización de negocios",
      },
    ],
  },
  {
    id: "eventos",
    label: "Eventos",
    specialties: [
      {
        id: "eventos-01",
        label: "Organización de bodas, quinceañeros, cumpleaños y aniversarios",
      },
      {
        id: "eventos-02",
        label: "Decoración de eventos",
      },
      {
        id: "eventos-03",
        label: "Alquiler de sillas, mesas, carpas y mantelería",
      },
      {
        id: "eventos-04",
        label: "Alquiler de sonido, luces y tarima",
      },
      {
        id: "eventos-05",
        label: "Catering y banquetes",
      },
      {
        id: "eventos-06",
        label: "Repostería y pasteles",
      },
      {
        id: "eventos-07",
        label: "Fotografía y video",
      },
      {
        id: "eventos-08",
        label: "Maestros de ceremonia",
      },
      {
        id: "eventos-09",
        label: "Inflables y entretenimiento infantil",
      },
      {
        id: "eventos-10",
        label: "Salones y locales para eventos",
      },
      {
        id: "eventos-11",
        label: "Invitaciones y recuerdos personalizados",
      },
    ],
  },
  {
    id: "vehiculos-y-transporte",
    label: "Vehículos y transporte",
    specialties: [
      {
        id: "vehiculos-y-transporte-01",
        label: "Mecánica automotriz",
      },
      {
        id: "vehiculos-y-transporte-02",
        label: "Chapistería y pintura",
      },
      {
        id: "vehiculos-y-transporte-03",
        label: "Lavado y detallado de autos",
      },
      {
        id: "vehiculos-y-transporte-04",
        label: "Taxi y transporte privado",
      },
      {
        id: "vehiculos-y-transporte-05",
        label: "Transporte para iglesias, excursiones y eventos",
      },
      {
        id: "vehiculos-y-transporte-06",
        label: "Mensajería y entregas (delivery)",
      },
      {
        id: "vehiculos-y-transporte-07",
        label: "Grúas y auxilio vial",
      },
      {
        id: "vehiculos-y-transporte-08",
        label: "Escuelas de manejo",
      },
      {
        id: "vehiculos-y-transporte-09",
        label: "Trámites vehiculares (revisado, placa)",
      },
    ],
  },
  {
    id: "hogar-y-construccion",
    label: "Hogar y construcción",
    specialties: [
      {
        id: "hogar-y-construccion-01",
        label: "Construcción y remodelación",
      },
      {
        id: "hogar-y-construccion-02",
        label: "Plomería, electricidad y soldadura",
      },
      {
        id: "hogar-y-construccion-03",
        label: "Aire acondicionado y refrigeración",
      },
      {
        id: "hogar-y-construccion-04",
        label: "Pintura, albañilería y techos",
      },
      {
        id: "hogar-y-construccion-05",
        label: "Carpintería y ebanistería",
      },
      {
        id: "hogar-y-construccion-06",
        label: "Instalación de pisos, cerámica y gypsum",
      },
      {
        id: "hogar-y-construccion-07",
        label: "Jardinería y paisajismo",
      },
      {
        id: "hogar-y-construccion-08",
        label: "Fumigación y control de plagas",
      },
      {
        id: "hogar-y-construccion-09",
        label: "Limpieza de casas y oficinas",
      },
      {
        id: "hogar-y-construccion-10",
        label: "Mudanzas",
      },
      {
        id: "hogar-y-construccion-11",
        label: "Cerrajería",
      },
      {
        id: "hogar-y-construccion-12",
        label: "Reparación de electrodomésticos",
      },
      {
        id: "hogar-y-construccion-13",
        label: "Instalación de cámaras y alarmas",
      },
      {
        id: "hogar-y-construccion-14",
        label: "Paneles solares",
      },
    ],
  },
  {
    id: "educacion",
    label: "Educación",
    specialties: [
      {
        id: "educacion-01",
        label: "Tutorías escolares (matemáticas, ciencias, lectura)",
      },
      {
        id: "educacion-02",
        label: "Clases de idiomas (inglés, francés, portugués)",
      },
      {
        id: "educacion-03",
        label: "Preparación para exámenes de admisión",
      },
      {
        id: "educacion-04",
        label: "Escuelas, colegios y guarderías cristianas",
      },
      {
        id: "educacion-05",
        label: "Cursos técnicos y de oficios",
      },
      {
        id: "educacion-06",
        label: "Clases de computación y tecnología",
      },
      {
        id: "educacion-07",
        label: "Educación especial y terapia de lenguaje",
      },
      {
        id: "educacion-08",
        label: "Homeschooling y materiales educativos",
      },
    ],
  },
  {
    id: "salud-y-bienestar",
    label: "Salud y bienestar",
    specialties: [
      {
        id: "salud-y-bienestar-01",
        label: "Médicos generales y especialistas",
      },
      {
        id: "salud-y-bienestar-02",
        label: "Odontología",
      },
      {
        id: "salud-y-bienestar-03",
        label: "Psicología y terapia con enfoque cristiano",
      },
      {
        id: "salud-y-bienestar-04",
        label: "Nutrición",
      },
      {
        id: "salud-y-bienestar-05",
        label: "Fisioterapia y rehabilitación",
      },
      {
        id: "salud-y-bienestar-06",
        label: "Enfermería y cuidado de adultos mayores a domicilio",
      },
      {
        id: "salud-y-bienestar-07",
        label: "Entrenadores personales y clases de ejercicio",
      },
      {
        id: "salud-y-bienestar-08",
        label: "Masajes terapéuticos",
      },
      {
        id: "salud-y-bienestar-09",
        label: "Óptica y exámenes de la vista",
      },
      {
        id: "salud-y-bienestar-10",
        label: "Farmacias y laboratorios clínicos",
      },
    ],
  },
  {
    id: "profesionales",
    label: "Profesionales",
    specialties: [
      {
        id: "profesionales-01",
        label:
          "Abogados: familia, laboral, comercial, migratorio, notarial, sucesiones",
      },
      {
        id: "profesionales-02",
        label: "Contabilidad, declaraciones de renta y auditoría",
      },
      {
        id: "profesionales-03",
        label: "Asesoría financiera y planificación de presupuestos",
      },
      {
        id: "profesionales-04",
        label: "Corredores de seguros y bienes raíces",
      },
      {
        id: "profesionales-05",
        label: "Arquitectura, ingeniería y planos",
      },
      {
        id: "profesionales-06",
        label: "Avalúos y topografía",
      },
      {
        id: "profesionales-07",
        label: "Recursos humanos y reclutamiento",
      },
      {
        id: "profesionales-08",
        label: "Consultoría de negocios y emprendimiento",
      },
      {
        id: "profesionales-09",
        label: "Traducción de documentos",
      },
    ],
  },
  {
    id: "servicios-cristianos-y-ministeriales",
    label: "Servicios cristianos y ministeriales",
    specialties: [
      {
        id: "servicios-cristianos-y-ministeriales-01",
        label: "Consejería pastoral, matrimonial y familiar",
      },
      {
        id: "servicios-cristianos-y-ministeriales-02",
        label: "Capellanía para hospitales, empresas y eventos",
      },
      {
        id: "servicios-cristianos-y-ministeriales-03",
        label: "Predicadores, conferencistas y ministros invitados",
      },
      {
        id: "servicios-cristianos-y-ministeriales-04",
        label: "Clases bíblicas, discipulado y teología en línea",
      },
      {
        id: "servicios-cristianos-y-ministeriales-05",
        label:
          "Música para cultos, bodas y eventos (salmistas, coros, bandas, músicos)",
      },
      {
        id: "servicios-cristianos-y-ministeriales-06",
        label: "Producción musical y grabación de alabanzas",
      },
      {
        id: "servicios-cristianos-y-ministeriales-07",
        label: "Clases de música (piano, guitarra, batería, canto)",
      },
      {
        id: "servicios-cristianos-y-ministeriales-08",
        label: "Danza y artes escénicas cristianas",
      },
      {
        id: "servicios-cristianos-y-ministeriales-09",
        label: "Sonido, iluminación y transmisión en vivo para iglesias",
      },
      {
        id: "servicios-cristianos-y-ministeriales-10",
        label: "Diseño de logos, flyers y redes sociales para iglesias",
      },
      {
        id: "servicios-cristianos-y-ministeriales-11",
        label: "Páginas web y apps para iglesias y ministerios",
      },
      {
        id: "servicios-cristianos-y-ministeriales-12",
        label: "Organización de campañas, retiros y campamentos",
      },
      {
        id: "servicios-cristianos-y-ministeriales-13",
        label: "Traducción e interpretación para predicaciones",
      },
    ],
  },
] as const;

export type BusinessCategory = (typeof businessCategories)[number];
export function getBusinessCategory(id: string) {
  return businessCategories.find(category => category.id === id);
}
export function getBusinessSpecialty(id: string) {
  for (const category of businessCategories) {
    const specialty = category.specialties.find(item => item.id === id);
    if (specialty) return { ...specialty, categoryId: category.id };
  }
  return undefined;
}
export function normalizeBusinessSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export const businessCategorySelection = z
  .object({
    categoryId: z
      .string()
      .max(100)
      .refine(
        id => Boolean(getBusinessCategory(id)),
        "Selecciona una categoría de negocio válida"
      ),
    specialtyIds: z.array(z.string().max(120)).max(96).default([]),
  })
  .strict()
  .superRefine((selection, context) => {
    const category = getBusinessCategory(selection.categoryId);
    const seen = new Set<string>();
    selection.specialtyIds.forEach((id, index) => {
      if (!category?.specialties.some(item => item.id === id))
        context.addIssue({
          code: "custom",
          path: ["specialtyIds", index],
          message: "La especialidad no pertenece a la categoría elegida",
        });
      if (seen.has(id))
        context.addIssue({
          code: "custom",
          path: ["specialtyIds", index],
          message: "No repitas una especialidad",
        });
      seen.add(id);
    });
  });
export const businessSelectionsInput = z
  .array(businessCategorySelection)
  .min(1, "Escoge al menos una categoría para tu negocio")
  .max(businessCategories.length)
  .superRefine((selections, context) => {
    const seen = new Set<string>();
    selections.forEach((selection, index) => {
      if (seen.has(selection.categoryId))
        context.addIssue({
          code: "custom",
          path: [index, "categoryId"],
          message: "No repitas una categoría",
        });
      seen.add(selection.categoryId);
    });
  });
export type BusinessSelection = z.infer<typeof businessCategorySelection>;
/** Extrae sólo la clasificación pública: nunca se entrega el resto del expediente. */
export function readBusinessSelections(details: unknown): BusinessSelection[] {
  // MySQL 8 entrega las columnas JSON como objeto; MariaDB y otros, como texto.
  if (typeof details === "string") {
    try { details = JSON.parse(details); } catch { return []; }
  }
  if (!details || typeof details !== "object" || Array.isArray(details))
    return [];
  const values = (details as Record<string, unknown>).businessCategories;
  const parsed = businessSelectionsInput.safeParse(values);
  return parsed.success ? parsed.data : [];
}
export function businessSelectionLabels(
  selections: readonly BusinessSelection[]
) {
  return selections.map(selection => ({
    categoryId: selection.categoryId,
    category:
      getBusinessCategory(selection.categoryId)?.label ?? selection.categoryId,
    specialties: selection.specialtyIds.map(
      id => getBusinessSpecialty(id)?.label ?? id
    ),
  }));
}
export function matchingBusinessSelections(query: string): BusinessSelection[] {
  const term = normalizeBusinessSearch(query);
  if (!term) return [];
  return businessCategories.flatMap(category => {
    if (normalizeBusinessSearch(category.label).includes(term))
      return [{ categoryId: category.id, specialtyIds: [] }];
    const specialtyIds = category.specialties
      .filter(specialty =>
        normalizeBusinessSearch(specialty.label).includes(term)
      )
      .map(specialty => specialty.id);
    return specialtyIds.length
      ? [{ categoryId: category.id, specialtyIds }]
      : [];
  });
}
