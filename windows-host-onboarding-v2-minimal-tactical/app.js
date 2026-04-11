const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
const previewButtons = Array.from(document.querySelectorAll("[data-preview-state]"));
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

  if (state.secureModeStepText !== "Ready") {
    return {
      action: "setup-secure-mode",
      label: "Set Up Secure Mode",
      title: "Finish secure mode",
      copy: "Generate and trust the local WSS certificate materials before starting the bridge.",
      tone: "Secure mode first"
    };
  }

  if (state.firewallStepText !== "Ready") {
    return {
      action: "open-firewall-rules",
      label: "Open Firewall Rules",
      title: "Open the required firewall rules",
      copy: "Listener devices stay blocked until the host PC allows the bridge ports through Windows Firewall.",
      tone: "Firewall first"
    };
  }

  if (state.canStartBridge) {
    return {
      action: "start-bridge",
      label: state.startBridgeButtonText || "Start Bridge",
      title: "Start the bridge",
      copy: state.listenerSetupNote,
      tone: "Ready to start"
    };
  }

  if (state.canUseListenerSetup) {
    return {
      action: "copy-link",
      label: "Copy Connect Link",
      title: "Onboard listener devices",
      copy: state.listenerSetupNote,
      tone: "Bridge running"
    };
  }

  if (state.canStopBridge) {
    return {
      action: "restart-bridge",
      label: "Restart Bridge",
      title: "Bridge is running",
      copy: state.listenerSetupNote,
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

function applyState(state) {
  const recommendation = getRecommendedAction(state);

  setText("bridge-state-chip", state.bridgeControlText);
  setText("blocker-chip", state.blockerText);
  setText("secure-chip", state.secureModeText);
  setText("focus-title", recommendation.title);
  setText("focus-copy", recommendation.copy);
  setText("focus-state", recommendation.tone);
  setText("bridge-status", state.bridgeStatus);
  setText("listener-state-inline", state.listenerSetupState);
  setText("secure-mode-inline", state.secureModeText);
  setText("last-issue-inline", state.lastIssue);
  setText("dotnet-step-state", state.dotNetStepText);
  setText("dotnet-current-note", state.dotNetCurrentNote);
  setText("vcredist-step-state", state.vcRedistStepText);
  setText("vcredist-current-note", state.vcRedistCurrentNote);
  setText("secure-mode-state", state.secureModeStepText);
  setText("firewall-state", state.firewallStepText);
  setText("start-bridge-step-state", state.startBridgeStepText);
  setText("start-bridge-current-note", state.startBridgeCurrentNote);
  setText("host-readiness-chip", state.blockerText);
  setText("host-ip", state.hostIp);
  setText("secure-stream", state.secureStream);
  setText("bridge-state-detail", state.bridgeStatus);
  setText("secure-mode-detail", state.secureModeText);
  setText("listener-access-detail", state.listenerSetupState);
  setText("last-issue", state.lastIssue);
  setText("listener-readiness-pill", state.listenerSetupState);
  setText("secure-connect-url", state.connectUrl);
  setText("bootstrap-url", state.bootstrapUrl);
  setText("runtime-log", state.runtimeLog);

  focusActionButton.dataset.action = recommendation.action;
  focusActionButton.textContent = recommendation.label;

  setActionButtonText("install-dotnet-button", state.dotNetButtonText);
  setActionButtonText("install-vcredist-button", state.vcRedistButtonText);
  setActionButtonText("start-bridge-button", state.startBridgeButtonText);

  setDisabled("focus-action-button", isRecommendedActionDisabled(recommendation.action, state));
  setDisabled("install-dotnet-button", !state.canInstallDotNet);
  setDisabled("install-vcredist-button", !state.canInstallVcRedist);
  setDisabled("setup-secure-mode-button", !state.canSetupSecureMode);
  setDisabled("open-firewall-rules-button", !state.canOpenFirewallRules);
  setDisabled("start-bridge-button", !state.canStartBridge);
  setDisabled("stop-bridge-button", !state.canStopBridge);
  setDisabled("restart-bridge-button", !state.canRestartBridge);
  setDisabled("copy-link-button", !state.canUseListenerSetup);
  setDisabled("copy-windows-setup-button", !state.canUseListenerSetup);
  setDisabled("copy-mac-setup-button", !state.canUseListenerSetup);
  setDisabled("open-bootstrap-page-button", !state.canUseListenerSetup);
  setDisabled("open-mobile-guide-button", !state.canUseListenerSetup);

  listenerPanel.dataset.ready = String(Boolean(state.canUseListenerSetup));

  const toneIds = [
    "bridge-state-chip",
    "blocker-chip",
    "secure-chip",
    "focus-state",
    "dotnet-step-state",
    "vcredist-step-state",
    "secure-mode-state",
    "firewall-state",
    "start-bridge-step-state",
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
    case "setup-secure-mode":
      return !state.canSetupSecureMode;
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
    blockerText: "3 blockers",
    secureModeText: "Secure mode required",
    dotNetStatus: "Missing desktop + ASP.NET runtimes",
    simConnectStatus: "Finish setup",
    bridgeStatus: "Setup needed",
    bootstrapStatus: "Install runtimes",
    bridgeControlText: "Setup needed",
    primaryActionText: "Finish Setup",
    hostIp: "192.168.0.24",
    secureStream: "39002 /stream",
    lastIssue: "Missing required .NET runtimes.",
    connectUrl: "Not available",
    bootstrapUrl: "http://192.168.0.24:39000/bootstrap",
    runtimeLog: "[09:05:12] prerequisite-check: .NET runtimes x64 not found\n[09:05:13] prerequisite-check: VC++ runtime found",
    dotNetStepText: "Action",
    dotNetButtonText: "Install .NET Runtime",
    dotNetCurrentNote: "Desktop Runtime + ASP.NET Core Runtime are missing on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    secureModeStepText: "Locked",
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
    canSetupSecureMode: false,
    canOpenFirewallRules: false,
    canUseListenerSetup: false
  },
  "ready-to-start": {
    blockerText: "0 blockers",
    secureModeText: "Secure mode ready",
    dotNetStatus: "Installed",
    simConnectStatus: "Waiting for bridge",
    bridgeStatus: "Ready to start",
    bootstrapStatus: "Start bridge first",
    bridgeControlText: "Ready",
    primaryActionText: "Start Bridge",
    hostIp: "192.168.0.24",
    secureStream: "39002 /stream",
    lastIssue: "No issues",
    connectUrl: "https://anobservatory.com/?msfsBridgeUrl=wss%3A%2F%2F192.168.0.24%3A39002%2Fstream",
    bootstrapUrl: "http://192.168.0.24:39000/bootstrap",
    runtimeLog: "[09:08:41] prerequisite-check: all host requirements satisfied\n[09:08:42] secure-mode: certificate material present",
    dotNetStepText: "Installed",
    dotNetButtonText: "Installed",
    dotNetCurrentNote: "Required .NET runtimes are installed on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    secureModeStepText: "Ready",
    firewallStepText: "Ready",
    startBridgeStepText: "Action",
    startBridgeButtonText: "Start Bridge",
    startBridgeCurrentNote: "Start the bridge to serve the bootstrap page and listener setup scripts.",
    listenerSetupState: "Start bridge first",
    listenerSetupNote: "Start the bridge on the host PC before using any Mac, Windows, or mobile setup commands.",
    canStartBridge: true,
    canStopBridge: false,
    canRestartBridge: false,
    canInstallDotNet: false,
    canInstallVcRedist: false,
    canSetupSecureMode: true,
    canOpenFirewallRules: true,
    canUseListenerSetup: false
  },
  running: {
    blockerText: "0 blockers",
    secureModeText: "Secure mode ready",
    dotNetStatus: "Installed",
    simConnectStatus: "Waiting for flight",
    bridgeStatus: "Running",
    bootstrapStatus: "Ready",
    bridgeControlText: "Running",
    primaryActionText: "Bridge Running",
    hostIp: "192.168.0.24",
    secureStream: "39002 /stream",
    lastIssue: "No issues",
    connectUrl: "https://anobservatory.com/?msfsBridgeUrl=wss%3A%2F%2F192.168.0.24%3A39002%2Fstream",
    bootstrapUrl: "http://192.168.0.24:39000/bootstrap",
    runtimeLog: "[09:12:04] bridge-start: host bootstrap page online\n[09:12:05] secure-stream: listening on wss://192.168.0.24:39002/stream",
    dotNetStepText: "Installed",
    dotNetButtonText: "Installed",
    dotNetCurrentNote: "Required .NET runtimes are installed on this PC.",
    vcRedistStepText: "Installed",
    vcRedistButtonText: "Installed",
    vcRedistCurrentNote: "VC++ runtime is already installed.",
    secureModeStepText: "Ready",
    firewallStepText: "Ready",
    startBridgeStepText: "Running",
    startBridgeButtonText: "Bridge Running",
    startBridgeCurrentNote: "Bridge is running. Listener setup is available from http://192.168.0.24:39000/bootstrap.",
    listenerSetupState: "Ready",
    listenerSetupNote: "On Windows listeners, open Administrator PowerShell before running the copied setup command.",
    canStartBridge: false,
    canStopBridge: true,
    canRestartBridge: true,
    canInstallDotNet: false,
    canInstallVcRedist: false,
    canSetupSecureMode: true,
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

    if (payload.type === "notification" && payload.message) {
      console.log(payload.message);
    }
  });

  postHostMessage({ type: "ready" });
} else {
  previewSwitcher.hidden = false;
  applyState(previewStates["setup-needed"]);
}
