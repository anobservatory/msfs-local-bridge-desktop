const mockState = {
  blockerText: "0 blockers",
  secureModeText: "Secure mode ready",
  dotNetStatus: "Installed",
  dotNetNote: "Desktop 10.0.4 and ASP.NET Core 10.0.3",
  bridgeStatus: "Running",
  bridgeNote: "Bundled payload active on this packaged build",
  bootstrapStatus: "Ready",
  listenerNote: "Bootstrap commands are available",
  secureStream: "39002 /stream",
  hostIpNote: "Host IP 172.30.1.16",
  hostIp: "172.30.1.16",
  lastIssue: "Worker warning only",
  runtimeLog: `[22:14:03] bridge: payload source = bundled
[22:14:03] runtime: Desktop 10.0.4 and ASP.NET Core 10.0.3 detected
[22:14:04] secure-mode: certificates detected and trusted
[22:14:04] firewall: managed rules present for TCP 39000 and 39002
[22:14:05] bridge: listening on ws://0.0.0.0:39000/stream
[22:14:05] bridge: listening on wss://ao.home.arpa:39002/stream
[22:14:05] bootstrap: listener setup available at http://172.30.1.16:39000/bootstrap
[22:14:08] listener: Windows setup must run from Administrator PowerShell`
};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function applyMockState() {
  setText("blocker-pill", mockState.blockerText);
  setText("secure-mode-pill", mockState.secureModeText);
  setText("status-dotnet", mockState.dotNetStatus);
  setText("dotnet-note", mockState.dotNetNote);
  setText("status-bridge", mockState.bridgeStatus);
  setText("bridge-note", mockState.bridgeNote);
  setText("status-bootstrap", mockState.bootstrapStatus);
  setText("listener-note", mockState.listenerNote);
  setText("secure-stream", mockState.secureStream);
  setText("host-ip-note", mockState.hostIpNote);
  setText("host-ip-main", mockState.hostIp);
  setText("host-last-issue", mockState.lastIssue);
  setText("runtime-log", mockState.runtimeLog);
}

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const panels = Array.from(document.querySelectorAll(".panel-view"));

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    const target = button.dataset.panel;

    for (const candidate of tabButtons) {
      candidate.classList.toggle("active", candidate === button);
    }

    for (const panel of panels) {
      panel.classList.toggle("active", panel.dataset.panel === target);
    }
  });
}

applyMockState();
