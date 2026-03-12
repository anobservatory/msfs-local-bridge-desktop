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

function setTextAll(ids, value) {
  for (const id of ids) {
    setText(id, value);
  }
}

function setDisabled(id, disabled) {
  const element = document.getElementById(id);
  if (element) {
    element.disabled = disabled;
  }
}

function setDisabledAll(ids, disabled) {
  for (const id of ids) {
    setDisabled(id, disabled);
  }
}

function applyState(state) {
  setText('blocker-pill', state.blockerText);
  setText('secure-mode-pill', state.secureModeText);
  setText('status-dotnet', state.dotNetStatus);
  setTextAll(['status-simconnect', 'simconnect-detail'], state.simConnectStatus);
  setText('status-bridge', state.bridgeStatus);
  setText('status-bootstrap', state.bootstrapStatus);
  setText('bridge-control-pill', state.bridgeControlText);
  setText('host-ip', state.hostIp);
  setText('secure-stream', state.secureStream);
  setText('last-issue', state.lastIssue);
  setText('secure-connect-url', state.connectUrl);
  setTextAll(['dotnet-step-state', 'dotnet-step-state-copy'], state.dotNetStepText);
  setText('dotnet-current-note', state.dotNetCurrentNote);
  setText('install-dotnet-button', state.dotNetButtonText);
  setTextAll(['vcredist-step-state', 'vcredist-step-state-copy'], state.vcRedistStepText);
  setText('vcredist-current-note', state.vcRedistCurrentNote);
  setText('install-vcredist-button', state.vcRedistButtonText);
  setTextAll(['secure-mode-state', 'secure-mode-state-copy'], state.secureModeStepText);
  setTextAll(['firewall-state', 'firewall-state-copy'], state.firewallStepText);
  setTextAll(['start-bridge-step-state', 'start-bridge-step-state-copy'], state.startBridgeStepText);
  setText('setup-start-bridge-button', state.startBridgeButtonText);
  setText('start-bridge-current-note', state.startBridgeCurrentNote);
  setTextAll(['listener-readiness-pill', 'listener-readiness-pill-copy'], state.listenerSetupState);
  setText('listener-setup-note', state.listenerSetupNote);
  setText('listener-handoff-note', state.listenerSetupNote);
  setText('runtime-log', state.runtimeLog);

  setDisabled('start-bridge-button', !state.canStartBridge);
  setDisabled('setup-start-bridge-button', !state.canStartBridge);
  setDisabled('stop-bridge-button', !state.canStopBridge);
  setDisabled('restart-bridge-button', !state.canRestartBridge);
  setDisabled('install-dotnet-button', !state.canInstallDotNet);
  setDisabled('install-vcredist-button', !state.canInstallVcRedist);
  setDisabled('setup-secure-mode-button', !state.canSetupSecureMode);
  setDisabled('open-firewall-rules-button', !state.canOpenFirewallRules);
  setDisabledAll(['copy-link-button'], !state.canUseListenerSetup);
  setDisabledAll(['copy-bootstrap-url-button'], !state.canUseListenerSetup);
  setDisabledAll(['copy-mac-setup-button', 'copy-mac-setup-button-copy'], !state.canUseListenerSetup);
  setDisabledAll(['open-bootstrap-page-button', 'open-bootstrap-page-button-copy'], !state.canUseListenerSetup);
  setDisabledAll(['copy-windows-setup-button', 'copy-windows-setup-button-copy'], !state.canUseListenerSetup);
  setDisabledAll(['open-mobile-guide-button', 'open-mobile-guide-button-copy'], !state.canUseListenerSetup);
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
