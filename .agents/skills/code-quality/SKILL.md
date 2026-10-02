---
name: code-quality
description: Apply Typio component, TypeScript, and maintainability conventions when writing or reviewing application code.
---

# Code Quality

This file owns coding conventions, not review procedures or validation commands. Apply them to the requested change without an unrelated rewrite. Follow repository instructions and consult the installed Next.js documentation for framework-dependent decisions.

## Components

- One production React component per source file, including private and compound subcomponents. Do not define components inside another component or disguise extracted UI blocks as JSX-returning helpers.
- Use descriptive PascalCase names and matching files, such as `TypingStats.tsx`. Preserve framework-required filenames such as `page.tsx` and `layout.tsx`; their permitted non-component exports are allowed.
- Props types, constants, and small non-component helpers may remain with their component. Ordinary conditional JSX and list rendering do not require extraction. Test mocks and fixtures do not each require a component file.
- Split by responsibility, not arbitrary line limits. Keep pages focused on composition and route concerns; separate substantial business logic from rendering.
- Follow existing folder conventions. Keep feature-specific components near their feature and genuinely shared UI in `src/components/`. Do not create speculative folder hierarchies.

## Maintainability

- Preserve strict TypeScript. Use explicit domain and props types; narrow external data at its boundary. Avoid unjustified `any`, casts, non-null assertions, or suppression comments.
- Use clear names, cohesive functions, and comments explaining intent or constraints. Remove code made obsolete by the change.
- Keep state with its owner and derive values instead of duplicating state. Extract hooks for distinct stateful responsibilities, not merely to add files.
- Avoid circular dependencies, growing catch-all utility modules, unnecessary dependencies, and abstractions for hypothetical needs.
- Keep rendering free of side effects; clean up timers, listeners, and subscriptions. Respect server/client boundaries and keep secrets server-side.
- Use stable keys, semantic controls, labels, keyboard access, and relevant loading/error states. Optimize demonstrated bottlenecks rather than adding memoization everywhere.
- Keep business logic independently testable. Never weaken type or lint rules to hide defects.

For review findings use [code-review](../code-review/SKILL.md); for validation use [QA](../qa/SKILL.md). Read those only when performing that task. These conventions are agent instructions, not installed ESLint or CI enforcement.
