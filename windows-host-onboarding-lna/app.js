const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
const previewButtons = Array.from(document.querySelectorAll("[data-preview-state]"));
const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const previewSwitcher = document.getElementById("preview-switcher");
const focusActionButton = document.getElementById("focus-action-button");
const listenerPanel = document.getElementById("listener-panel");
const openDiagnosticsButton = document.getElementById("open-diagnostics-button");
const closeDiagnosticsButton = document.getElementById("close-diagnostics-button");
const diagnosticsDrawer = document.getElementById("diagnostics-drawer");
const drawerScrim = document.getElementById("drawer-scrim");

for (const button of actionButtons) {
  button.addEventListener("click", () => {
    postHostMessage({
      type: "action",
      action: button.dataset.action
    });
  });
}

for (const button of previewButtons) {
  button.addEventListener("click", () => {
    const state = previewStates[button.dataset.previewState];
    if (!state) {
      return;
    }

    for (const peer of previewButtons) {
      peer.classList.toggle("active", peer === button);
    }

    applyState(state);
  });
}

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tabTarget);
  });
}

openDiagnosticsButton?.addEventListener("click", openDiagnosticsDrawer);
closeDiagnosticsButton?.addEventListener("click", closeDiagnosticsDrawer);
drawerScrim?.addEventListener("click", closeDiagnosticsDrawer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDiagnosticsDrawer();
  }
});

function postHostMessage(payload) {
  if (!window.chrome?.webview) {
    return;
  }

  window.chrome.webview.postMessage(payload);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setDisabled(id, disabled) {
  const element = document.getElementById(id);
  if (element) {
    element.disabled = disabled;
  }
}

function setActionButtonText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function openDiagnosticsDrawer() {
  document.body.classList.add("drawer-open");
  diagnosticsDrawer?.setAttribute("aria-hidden", "false");
  if (drawerScrim) {
    drawerScrim.hidden = false;
  }
}

function closeDiagnosticsDrawer() {
  document.body.classList.remove("drawer-open");
  diagnosticsDrawer?.setAttribute("aria-hidden", "true");
  if (drawerScrim) {
    drawerScrim.hidden = true;
  }
}

function applyWindowState(maximized) {
  document.body.classList.toggle("window-maximized", Boolean(maximized));
}

function applyStateTone(element, value) {
  if (!element) {
    return;
  }

  element.classList.remove("state-active", "state-positive", "state-caution", "state-critical", "chip-warn");

  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("0 blocker")) {
    element.classList.add("state-positive");
    return;
  }

  if (normalized.includes("blocker")) {
    element.classList.add("state-caution");
    return;
  }

  if (normalized.includes("ready") || normalized.includes("running") || normalized.includes("installed")) {
    element.classList.add("state-positive");
    return;
  }

  if (
    normalized.includes("required") ||
    normalized.includes("first") ||
    normalized.includes("needed") ||
    normalized.includes("action") ||
    normalized.includes("locked") ||
    normalized.includes("setup")
  ) {
    element.classList.add("state-caution");
    return;
  }

  if (normalized.includes("failed") || normalized.includes("error")) {
    element.classList.add("state-critical");
    return;
  }

  element.classList.add("state-active");
}

function getRecommendedAction(state) {
  if (state.canInstallDotNet) {
    return {
      action: "install-dotnet",
      label: state.dotNetButtonText || "Install .NET Runtime",
      title: "Install .NET on the host",
      copy: state.startBridgeCurrentNote,
      tone: "Setup needed"
    };
  }

  if (state.canInstallVcRedist) {
    return {
      action: "install-vcredist",
      label: state.vcRedistButtonText || "Install VC++ Runtime",
      title: "Install the VC++ runtime",
      copy: "Native bridge components depend on the Visual C++ redistributable on this host PC.",
      tone: "Setup needed"
    };
  }

  if (state.firewallStepText !== "Ready") {
    return {
      action: "open-firewall-rules",
      label: "Open Firewall Rule",
      title: "Open local bridge access",
      copy: "Allow inbound TCP 39000 so AO can reach the bridge from this network.",
      tone: "Firewall first"
    };
  }

  if (state.canStartBridge) {
    return {
      action: "start-bridge",
      label: state.startBridgeButtonText || "Start Bridge",
      title: "Start the bridge",
      copy: "Start the local stream before opening AO in the browser.",
      tone: "Ready to start"
    };
  }

  if (state.canUseListenerSetup) {
    return {
      action: "copy-link",
      label: "Copy AO Link",
      title: "Open AO",
      copy: "Open AO with the local bridge URL, then allow the browser local network prompt.",
      tone: "Bridge running"
    };
  }

  if (state.canStopBridge) {
    return {
      action: "restart-bridge",
      label: "Restart Bridge",
      title: "Bridge is running",
      copy: "AO can connect once the browser is allowed to access the local network.",
      tone: "Running"
    };
  }

  return {
    action: "copy-diagnostics",
    label: "Copy Diagnostics",
    title: "Review host diagnostics",
    copy: state.startBridgeCurrentNote || state.listenerSetupNote || "Diagnostics are available for support.",
    tone: "Review needed"
  };
}

function activateTab(target) {
  if (!target) {
    return;
  }

  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.tabTarget === target);
  }

  for (const panel of tabPanels) {
    const active = panel.dataset.tabPanel === target;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
}

function lnaConnectionText(state) {
  if (state.canInstallDotNet || state.canInstallVcRedist) {
    return "Host setup needed";
  }

  if (state.canUseListenerSetup || state.bridgeStatus === "Running") {
    return "Browser permission";
  }

  if (state.firewallStepText !== "Ready") {
    return "Firewall 39000 needed";
  }

  return "Local WS mode";
}

function localBridgeUrl(state) {
  if (state.localBridgeUrl) {
    return state.localBridgeUrl;
  }

  if (state.hostIp && state.hostIp !== "Not available") {
    return `ws://${state.hostIp}:39000/stream`;
  }

  return "Not available";
}

function applyState(state) {
  const recommendation = getRecommendedAction(state);
  const connectionText = lnaConnectionText(state);
  const bridgeUrl = localBridgeUrl(state);
  const bridgeRunning = Boolean(state.canStopBridge || state.canRestartBridge || state.bridgeStatus === "Running");

  setText("bridge-state-chip", state.bridgeControlText);
  setText("blocker-chip", state.blockerText);
  setText("secure-chip", connectionText);
  setText("focus-title", recommendation.title);
  setText("focus-copy", recommendation.copy);
  setText("focus-state", recommendation.tone);
  setText("bridge-status", state.bridgeStatus);
  setText("listener-state-inline", state.listenerSetupState);
  setText("secure-mode-inline", connectionText);
  setText("last-issue-inline", state.lastIssue);
  setText("dotnet-step-state", state.dotNetStepText);
  setText("dotnet-current-note", state.dotNetCurrentNote);
  setText("vcredist-step-state", state.vcRedistStepText);
  setText("vcredist-current-note", state.vcRedistCurrentNote);
  setText("firewall-state", state.firewallStepText);
  setText("start-bridge-step-state", state.startBridgeStepText);
  setText("start-bridge-current-note", state.startBridgeCurrentNote);
  setText("open-ao-step-state", state.canUseListenerSetup ? "Action" : "Locked");
  setText("open-ao-current-note", state.canUseListenerSetup
    ? "Copy the AO link, open it in Chrome or Edge, then allow local network access."
    : "Start the bridge before opening AO.");
  setText("host-readiness-chip", state.blockerText);
  setText("host-ip", state.hostIp);
  setText("secure-stream", state.secureStream);
  setText("bridge-state-detail", state.bridgeStatus);
  setText("secure-mode-detail", connectionText);
  setText("listener-access-detail", state.listenerSetupState);
  setText("last-issue", state.lastIssue);
  setText("listener-readiness-pill", state.listenerSetupState);
  setText("secure-connect-url", state.connectUrl);
  setText("bootstrap-url", bridgeUrl);
  setText("runtime-log", state.runtimeLog);

  focusActionButton.dataset.action = recommendation.action;
  focusActionButton.textContent = recommendation.label;

  setActionButtonText("install-dotnet-button", state.dotNetButtonText);
  setActionButtonText("install-vcredist-button", state.vcRedistButtonText);
  setActionButtonText("start-bridge-button", state.startBridgeButtonText);

  setDisabled("focus-action-button", isRecommendedActionDisabled(recommendation.action, state));
  setDisabled("install-dotnet-button", !state.canInstallDotNet);
  setDisabled("install-vcredist-button", !state.canInstallVcRedist);
  setDisabled("open-firewall-rules-button", !state.canOpenFirewallRules);
  setDisabled("start-bridge-button", !state.canStartBridge);
  setDisabled("open-ao-button", !state.canUseListenerSetup);
  setDisabled("stop-bridge-button", !state.canStopBridge);
  setDisabled("restart-bridge-button", !state.canRestartBridge);
  setDisabled("copy-link-button", !state.canUseListenerSetup);
  setDisabled("open-bootstrap-page-button", !state.canUseListenerSetup);

  listenerPanel.dataset.ready = String(Boolean(state.canUseListenerSetup));
  document.body.classList.toggle("bridge-running", bridgeRunning);

  const toneIds = [
    "bridge-state-chip",
    "blocker-chip",
    "secure-chip",
    "focus-state",
    "dotnet-step-state",
    "vcredist-step-state",
    "firewall-state",
    "start-bridge-step-state",
    "open-ao-step-state",
    "host-readiness-chip",
    "listener-readiness-pill"
  ];

  for (const id of toneIds) {
    applyStateTone(document.getElementById(id), document.getElementById(id)?.textContent);
  }
}

function isRecommendedActionDisabled(action, state) {
  switch (action) {
    case "install-dotnet":
      return !state.canInstallDotNet;
    case "install-vcredist":
      return !state.canInstallVcRedist;
    case "open-firewall-rules":
      return !state.canOpenFirewallRules;
    case "start-bridge":
      return !state.canStartBridge;
    case "copy-link":
      return !state.canUseListenerSetup;
    case "restart-bridge":
      return !state.canRestartBridge;
    default:
      return false;
  }
}

const previewStates = {
  "setup-needed": {
    blockerText: "2 blockers",
    secureModeText: "Local WS mode",
    dotNetStatus: "Missing desktop + ASP.NET runtimes",
    simConnectStatus: "Finish setup",
    bridgeStatus: "Setup needed",
    bootstrapStatus: "Install runtimes",
    bridgeControlText: "Setup needed",
    primaryActionText: "Finish Setup",
    hostIp: "192.168.0.24",
    secureStream: "39000 /stream",
    lastIssue: "Missing required .NET runtimes.",
    connectUrl: "Not available",
    localBridgeUrl: "ws://192.168.0.24:39000/stream",
    bootstrapUrl: "ws://192.168.0.24:39000/stream",
    runtimeLog: "[09:05:12] prerequisite-check: .NET runtimes x64 not found\n[09:05:13] prerequisite-check: VC++ runtime found",
    dotNetStepText: "Action",
    dotNetButtonText: "Install .NET Runtime",
    dotNetCurrentNote: "Desktop Runtime + ASP.NET Core Runtime are missing on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    firewallStepText: "Locked",
    startBridgeStepText: "Locked",
    startBridgeButtonText: "Start Bridge",
    startBridgeCurrentNote: "Install .NET and VC++ on this host PC first.",
    listenerSetupState: "Install runtimes",
    listenerSetupNote: "Install .NET and VC++ on the host PC first.",
    canStartBridge: false,
    canStopBridge: false,
    canRestartBridge: false,
    canInstallDotNet: true,
    canInstallVcRedist: false,
    canOpenFirewallRules: false,
    canUseListenerSetup: false
  },
  "ready-to-start": {
    blockerText: "0 blockers",
    secureModeText: "Browser permission",
    dotNetStatus: "Installed",
    simConnectStatus: "Waiting for bridge",
    bridgeStatus: "Ready to start",
    bootstrapStatus: "Start bridge first",
    bridgeControlText: "Ready",
    primaryActionText: "Start Bridge",
    hostIp: "192.168.0.24",
    secureStream: "39000 /stream",
    lastIssue: "No issues",
    connectUrl: "https://anobservatory.com/?msfsBridgeUrl=ws%3A%2F%2F192.168.0.24%3A39000%2Fstream",
    localBridgeUrl: "ws://192.168.0.24:39000/stream",
    bootstrapUrl: "ws://192.168.0.24:39000/stream",
    runtimeLog: "[09:08:41] prerequisite-check: all host requirements satisfied\n[09:08:42] firewall-check: TCP 39000 allowed",
    dotNetStepText: "Installed",
    dotNetButtonText: "Installed",
    dotNetCurrentNote: "Required .NET runtimes are installed on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    firewallStepText: "Ready",
    startBridgeStepText: "Action",
    startBridgeButtonText: "Start Bridge",
    startBridgeCurrentNote: "Start the bridge before opening AO.",
    listenerSetupState: "Start bridge first",
    listenerSetupNote: "Start the bridge on the host PC before opening AO.",
    canStartBridge: true,
    canStopBridge: false,
    canRestartBridge: false,
    canInstallDotNet: false,
    canInstallVcRedist: false,
    canOpenFirewallRules: true,
    canUseListenerSetup: false
  },
  running: {
    blockerText: "0 blockers",
    secureModeText: "Browser permission",
    dotNetStatus: "Installed",
    simConnectStatus: "Waiting for flight",
    bridgeStatus: "Running",
    bootstrapStatus: "Ready",
    bridgeControlText: "Running",
    primaryActionText: "Bridge Running",
    hostIp: "192.168.0.24",
    secureStream: "39000 /stream",
    lastIssue: "No issues",
    connectUrl: "https://anobservatory.com/?msfsBridgeUrl=ws%3A%2F%2F192.168.0.24%3A39000%2Fstream",
    localBridgeUrl: "ws://192.168.0.24:39000/stream",
    bootstrapUrl: "ws://192.168.0.24:39000/stream",
    runtimeLog: "[09:12:04] bridge-start: local stream online\n[09:12:05] local-stream: listening on ws://192.168.0.24:39000/stream",
    dotNetStepText: "Installed",
    dotNetButtonText: "Installed",
    dotNetCurrentNote: "Required .NET runtimes are installed on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    firewallStepText: "Ready",
    startBridgeStepText: "Running",
    startBridgeButtonText: "Bridge Running",
    startBridgeCurrentNote: "Bridge is running. Open AO and allow browser local network access.",
    listenerSetupState: "Ready",
    listenerSetupNote: "Open AO with this link, then allow the browser local network prompt.",
    canStartBridge: false,
    canStopBridge: true,
    canRestartBridge: true,
    canInstallDotNet: false,
    canInstallVcRedist: false,
    canOpenFirewallRules: true,
    canUseListenerSetup: true
  }
};

if (window.chrome?.webview) {
  document.body.classList.add("embedded-host");

  window.chrome.webview.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.type === "state") {
      applyState(payload.state);
      return;
    }

    if (payload.type === "window-state") {
      applyWindowState(payload.maximized);
      return;
    }

    if (payload.type === "notification" && payload.message) {
      console.log(payload.message);
    }
  });

  postHostMessage({ type: "ready" });
} else {
  previewSwitcher.hidden = false;
  const query = new URLSearchParams(window.location.search);
  const previewKey = query.get("preview") || "setup-needed";
  activateTab(query.get("tab") || "setup");
  const previewState = previewStates[previewKey] || previewStates["setup-needed"];
  for (const button of previewButtons) {
    button.classList.toggle("active", button.dataset.previewState === previewKey);
  }
  applyState(previewState);
}
