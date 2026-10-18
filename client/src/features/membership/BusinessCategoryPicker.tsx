import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Store } from "lucide-react";
import { Link } from "wouter";
import {
  businessCategories,
  type BusinessSelection,
} from "@shared/businessCategories";

type BusinessCategoryPickerProps = {
  value: BusinessSelection[];
  onChange: (value: BusinessSelection[]) => void;
  disabled?: boolean;
  idPrefix?: string;
};

function selectionFor(value: BusinessSelection[], categoryId: string) {
  return value.find(selection => selection.categoryId === categoryId);
}

export function BusinessCategoryPicker({
  value,
  onChange,
  disabled = false,
  idPrefix = "business-category",
}: BusinessCategoryPickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(value.map(selection => selection.categoryId)),
  );

  useEffect(() => {
    setExpanded(previous => {
      const next = new Set(previous);
      value.forEach(selection => next.add(selection.categoryId));
      return next;
    });
  }, [value]);

  const toggleCategory = (categoryId: string, checked: boolean) => {
    if (checked) {
      if (!selectionFor(value, categoryId)) {
        onChange([...value, { categoryId, specialtyIds: [] }]);
      }
      setExpanded(previous => new Set(previous).add(categoryId));
      return;
    }
    onChange(value.filter(selection => selection.categoryId !== categoryId));
  };

  const toggleSpecialty = (categoryId: string, specialtyId: string, checked: boolean) => {
    const current = selectionFor(value, categoryId);
    if (!current) return;
    const specialtyIds = checked
      ? [...new Set([...current.specialtyIds, specialtyId])]
      : current.specialtyIds.filter(id => id !== specialtyId);
    onChange(value.map(selection =>
      selection.categoryId === categoryId ? { ...selection, specialtyIds } : selection,
    ));
  };

  return (
    <div className="business-category-picker">
      <div className="business-category-picker__summary" aria-live="polite">
        <strong>{value.length} {value.length === 1 ? "categoría seleccionada" : "categorías seleccionadas"}</strong>
        <span> · {value.reduce((total, selection) => total + selection.specialtyIds.length, 0)} especialidades</span>
      </div>
      <div className="business-category-picker__grid">
        {businessCategories.map(category => {
          const selection = selectionFor(value, category.id);
          const isExpanded = expanded.has(category.id);
          const categoryCheckboxId = `${idPrefix}-${category.id}`;
          return (
            <article className={`business-category-card ${selection ? "is-selected" : ""}`} key={category.id}>
              <div className="business-category-card__heading">
                <label className="business-category-card__label" htmlFor={categoryCheckboxId}>
                  <input
                    id={categoryCheckboxId}
                    type="checkbox"
                    checked={Boolean(selection)}
                    disabled={disabled}
                    onChange={event => toggleCategory(category.id, event.target.checked)}
                  />
                  <span>
                    <strong>{category.label}</strong>
                    <small>{category.specialties.length} especialidades</small>
                  </span>
                </label>
                <button
                  className="business-category-card__toggle"
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`${idPrefix}-specialties-${category.id}`}
                  disabled={disabled}
                  onClick={() => setExpanded(previous => {
                    const next = new Set(previous);
                    if (next.has(category.id)) next.delete(category.id);
                    else next.add(category.id);
                    return next;
                  })}
                >
                  {isExpanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                  <span className="sr-only">{isExpanded ? "Ocultar" : "Mostrar"} especialidades de {category.label}</span>
                </button>
              </div>
              {isExpanded && (
                <div className="business-category-card__specialties" id={`${idPrefix}-specialties-${category.id}`}>
                  {selection ? (
                    category.specialties.map(specialty => {
                      const specialtyId = `${idPrefix}-${specialty.id}`;
                      return (
                        <label className="business-specialty-option" htmlFor={specialtyId} key={specialty.id}>
                          <input
                            id={specialtyId}
                            type="checkbox"
                            checked={selection.specialtyIds.includes(specialty.id)}
                            disabled={disabled}
                            onChange={event => toggleSpecialty(category.id, specialty.id, event.target.checked)}
                          />
                          <span>{specialty.label}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="business-category-card__hint">Selecciona esta categoría para marcar especialidades.</p>
                  )}
                  <Link className="business-category-card__link" href={`/tiendas?category=${encodeURIComponent(category.id)}`}>
                    <Store size={14} aria-hidden="true" /> Ver tiendas de esta categoría
                  </Link>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
