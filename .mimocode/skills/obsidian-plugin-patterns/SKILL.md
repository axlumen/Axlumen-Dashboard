---
name: obsidian-plugin-patterns
description: Use when adding new widgets, services, or features to the GullDock Obsidian plugin. Encodes the project's lifecycle patterns, file conventions, and architectural decisions so future sessions build consistent code.
---

# GullDock Plugin Patterns

## Project Overview

GullDock v3.0 — Obsidian plugin, TypeScript strict, esbuild bundled. Entry: `src/main.ts`.

## Widget Pattern

All widgets live in `src/widgets/<name>.ts` and export a factory function:

```ts
export function create<Name>Panel(
  app: App,
  createSection: (title: string, color: string, subtitle: string) => HTMLElement,
): Promise<{ section: HTMLElement; handle: WidgetHandle }> | { section: HTMLElement; handle: WidgetHandle }
```

Key conventions:
- `createSection()` is provided by the view — always use it, never create raw DOM for sections
- Return `{ section, handle }` — the view adds `handle` to `CompositeDisposable` for cleanup
- `WidgetHandle` is `{ dispose(): void; refresh(): void }`
- Use `el()`, `div()`, `esc()` from `src/utils/dom.ts` for DOM creation
- Track timers in a `Set<number>` and clear them on dispose
- Register event listeners via a `regEvent()` helper that auto-removes on dispose
- Use `atomicWrite` / `safeRead` from `src/utils/atomicWrite.ts` for vault file I/O
- Use `getWriteLock` from `src/utils/WriteLock.ts` for concurrent access protection

## Service Pattern

Services live in `src/services/<Name>.ts`. Registered as lazy singletons in `main.ts`:

```ts
private _myService: MyService | null = null;
get myService(): MyService {
  if (!this._myService) this._myService = new MyService(this.app);
  return this._myService;
}
```

Lifecycle:
- Constructor receives `App` (and optionally a save callback)
- No explicit init — lazy construction on first access
- `dispose()` or `stopAll()` called from `onunload()` in main.ts

## Agent Pattern

Agent code lives in `src/agent/`:
- `AgentRunner` — CLI queue wrapper, singleton via plugin
- `RoutingEngine` — command routing, depends on AgentRunner
- `WorkflowRegistry` — markdown workflow templates from `dashboard/workflows/`

## File Conventions

- Types: `src/types.ts`
- Constants: `src/constants.ts`
- Utils: `src/utils/` — dom, animation, debounce, dialog, LocalStore, atomicWrite, WriteLock
- Settings panel: `src/settings.ts` — uses Obsidian `PluginSettingTab` API

## Build & Deploy

- `npm run dev` — watch mode
- `npm run build` — production esbuild
- `npm run deploy` — build + copy to vault
- Or use the deploy tool: `.mimocode/tools/deploy.ts`
