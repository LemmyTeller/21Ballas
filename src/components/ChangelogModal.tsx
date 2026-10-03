import { CHANGELOG, VERSION } from '../changelog'
import { Modal } from './Modal'
import { Button } from './ui'

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Journal des versions" onClose={onClose}>
      <div className="max-h-[60svh] space-y-5 overflow-y-auto pr-1">
        {CHANGELOG.map((entree) => (
          <section key={entree.version}>
            <h3 className="flex items-baseline gap-2 font-semibold text-zinc-100">
              v{entree.version}
              {entree.version === VERSION && (
                <span className="rounded-full bg-purple-700 px-2 py-0.5 text-xs font-medium text-white">Actuelle</span>
              )}
              <span className="ml-auto text-xs font-normal text-zinc-500">
                {new Date(entree.date).toLocaleDateString('fr-FR')}
              </span>
            </h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {entree.changements.map((changement) => (
                <li key={changement}>{changement}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </Modal>
  )
}
