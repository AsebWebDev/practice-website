import { z } from 'zod';

// Zod would otherwise probe whether it may compile code at runtime, which
// the Content-Security-Policy forbids and reports as a violation. This has
// to run before any schema is created, so import this module first.
z.config({ jitless: true });
