# Windows Host Onboarding v2

Location: `windows-host-onboarding-v2-minimal-tactical`

## Intent

This mockup explores a `minimal but tactical` direction for the MSFS bridge host
console.

It keeps the calm operational tone from `anobservatory`, but reduces the visual
weight and information duplication from `windows-host-onboarding-v1`.

## What Changed

- no top-level tabs
- one recommended next action at the top
- one compact host checklist
- one compact host status panel
- listener onboarding stays secondary until the host is actually ready
- diagnostics stay available, but behind a lower-emphasis panel

## Integration Note

This mockup listens for the same WebView message shape as the current host
console. To try it in the desktop shell, point `BridgeWorkspace.HostConsoleRoot`
at this folder instead of `windows-host-onboarding-v1`.

When opened directly in a browser, the mockup exposes three local preview
states:

1. Setup needed
2. Ready to start
3. Running
