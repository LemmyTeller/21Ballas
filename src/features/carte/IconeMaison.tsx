// Maison noire au contour blanc : le symbole des points de type « Adresse », sur la carte comme dans les listes.
// Le tracé est partagé avec le marqueur de la carte, construit hors React (voir Carte.tsx).
export const TRACE_MAISON = 'M12 3 L22 11.5 L19 11.5 L19 21 L14.5 21 L14.5 15 L9.5 15 L9.5 21 L5 21 L5 11.5 L2 11.5 Z'

export function IconeMaison({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={TRACE_MAISON} fill="#0a0a0a" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
