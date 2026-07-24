// Required for any React island to hydrate/mount: coreVite() only injects
// the island bootstrap (@withl5e/l5e/island/runtime) into this global entry
// when the file exists, regardless of whether the app has anything else to
// put here.

// Set once for the whole app, instead of per-element wiring on every
// tooltip trigger — every tooltip fetch now infers its locale prefix from
// <html lang> + the current URL automatically.
import { configureTooltip } from '@withl5e/l5e/tooltip';

configureTooltip('auto-locale');
