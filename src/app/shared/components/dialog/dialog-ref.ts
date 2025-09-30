// Minimal dialog reference abstraction placeholder.
export class ZardDialogRef<T = unknown> {
  constructor(public readonly id: string) {}
  close(_result?: T) {}
}
