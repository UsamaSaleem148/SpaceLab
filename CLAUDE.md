# SpaceLab Development Rules

## Project
Build a visually polished satellite tracker, followed by an asteroid monitor.

## Engineering
- Use TypeScript with strict type checking.
- Keep orbital calculations separate from UI and rendering.
- Use CesiumJS for the globe and geographic visualization.
- Use satellite.js for satellite orbital propagation.
- Consult Context7 for current library documentation when implementing unfamiliar APIs.
- Do not add dependencies without a clear reason.
- Do not add a backend or database until required.

## Visual quality
- Follow `design-system/MASTER.md` (page overrides in `design-system/pages/`). It may be changed when the product needs it.
- Use a dark space theme with realistic Earth imagery.
- Keep the interface clean and readable.
- Avoid generic admin-dashboard styling.
- Test at desktop and mobile viewport sizes.
- Verify visual changes in a real browser.

## Quality checks
- Run the build after significant changes.
- Write unit tests for orbital calculations.
- Check browser console errors and failed network requests.
- Fix errors before declaring a task complete.
- Never claim a test passed unless it was actually run.

## Workflow
- Implement one milestone at a time.
- Inspect existing code before editing.
- Explain important architectural decisions briefly.
- Report changed files, tests run, and remaining issues.
