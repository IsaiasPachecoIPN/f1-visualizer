// Basic variant function returning baseline classes (tailwind-like) used by dialog.component.
// Adjust as needed for theming.
export function dialogVariants() {
  return [
    'relative','flex','flex-col','gap-4','bg-white','p-4','rounded-lg','shadow-lg','border','border-neutral-200','max-h-full','overflow-y-auto'
  ].join(' ');
}
