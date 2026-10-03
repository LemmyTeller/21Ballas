import { useEffect, useRef, type ReactNode } from 'react'

// Fenêtre modale : à monter uniquement quand elle doit être ouverte. Échap et le fond la ferment.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-0 text-zinc-200 backdrop:bg-black/70"
    >
      <div className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
