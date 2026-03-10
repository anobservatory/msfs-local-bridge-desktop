const tabs = Array.from(document.querySelectorAll('.tab-btn'));
const panels = Array.from(document.querySelectorAll('.tab-panel'));
const actionButtons = Array.from(document.querySelectorAll('[data-action]'));

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    for (const button of tabs) {
      button.classList.toggle('active', button === tab);
    }

    for (const panel of panels) {
      panel.classList.toggle('active', panel.dataset.panel === target);
    }
  });
}

for (const button of actionButtons) {
  button.addEventListener('click', () => {
    postHostMessage({
      type: 'action',
      action: button.dataset.action
    });
  });
}

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

function applyState(state) {
  setText('blocker-pill', state.blockerText);
  setText('secure-mode-pill', state.secureModeText);
  setText('status-dotnet', state.dotNetStatus);
  setText('status-simconnect', state.simConnectStatus);
  setText('status-bridge', state.bridgeStatus);
  setText('status-bootstrap', state.bootstrapStatus);
  setText('bridge-control-pill', state.bridgeControlText);
  setText('primary-action-label', state.primaryActionText);
  setText('host-ip', state.hostIp);
  setText('secure-stream', state.secureStream);
  setText('last-issue', state.lastIssue);
  setText('secure-connect-url', state.connectUrl);
  setText('dotnet-step-state', state.dotNetStepText);
  setText('dotnet-current-note', state.dotNetCurrentNote);
  setText('install-dotnet-button', state.dotNetButtonText);
  setText('vcredist-step-state', state.vcRedistStepText);
  setText('vcredist-current-note', state.vcRedistCurrentNote);
  setText('install-vcredist-button', state.vcRedistButtonText);
  setText('secure-mode-state', state.secureModeStepText);
  setText('firewall-state', state.firewallStepText);
  setText('runtime-log', state.runtimeLog);

  setDisabled('start-bridge-button', !state.canStartBridge);
  setDisabled('stop-bridge-button', !state.canStopBridge);
  setDisabled('restart-bridge-button', !state.canRestartBridge);
  setDisabled('install-dotnet-button', !state.canInstallDotNet);
  setDisabled('install-vcredist-button', !state.canInstallVcRedist);
  setDisabled('setup-secure-mode-button', !state.canSetupSecureMode);
  setDisabled('open-firewall-rules-button', !state.canOpenFirewallRules);
}

if (window.chrome?.webview) {
  window.chrome.webview.addEventListener('message', (event) => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') {
      return;
    }

    if (payload.type === 'state') {
      applyState(payload.state);
      return;
    }

    if (payload.type === 'notification' && payload.message) {
      console.log(payload.message);
    }
  });

  postHostMessage({ type: 'ready' });
}
