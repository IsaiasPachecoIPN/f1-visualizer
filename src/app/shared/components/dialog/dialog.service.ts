// Minimal stub service to satisfy existing dialog component imports.
// The full dialog service implementation was absent from the repository.
// For the current responsive drawer usage we don't instantiate dialogs dynamically.
// This service can be expanded later with open/close APIs.
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ZardDialogService {}
