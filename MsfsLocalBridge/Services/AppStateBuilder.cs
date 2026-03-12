using System.Net;
using MsfsLocalBridge.Models;

namespace MsfsLocalBridge.Services;

internal sealed class AppStateBuilder
{
    public AppState Build(DiagnosticsResult diagnostics, string diagnosticsJson, BridgeSessionService session, PrerequisiteStatus prerequisites)
    {
        var lanCheck = FindCheck(diagnostics, "network.lan_ipv4");
        var firewallBridgeCheck = FindCheck(diagnostics, "network.firewall_private_39000");
        var firewallWssCheck = FindCheck(diagnostics, "network.firewall_private_39002");
        var portBridgeCheck = FindCheck(diagnostics, "network.port_39000");
        var portWssCheck = FindCheck(diagnostics, "network.port_39002");
        var pfxCheck = FindCheck(diagnostics, "network.wss_pfx");
        var certCheck = FindCheck(diagnostics, "network.wss_cert");
        var keyCheck = FindCheck(diagnostics, "network.wss_key");
        var rootCaCheck = FindCheck(diagnostics, "network.root_ca");

        var hostIp = ExtractLanIp(lanCheck?.Message) ?? "Not available";
        var secureStreamUrl = hostIp == "Not available" ? "Not available" : $"wss://{hostIp}:39002/stream";
        var bootstrapUrl = hostIp == "Not available" ? "Not available" : $"http://{hostIp}:39000/bootstrap";
        var connectUrl = secureStreamUrl == "Not available"
            ? "Not available"
            : $"https://anobservatory.com/?msfsBridgeUrl={WebUtility.UrlEncode(secureStreamUrl)}";

        var hasCertificateMaterial = pfxCheck?.Status == "pass" || (certCheck?.Status == "pass" && keyCheck?.Status == "pass");
        var secureModeReady = hasCertificateMaterial && rootCaCheck?.Status == "pass";
        var firewallReady = firewallBridgeCheck?.Status == "pass" && firewallWssCheck?.Status == "pass";
        var portsAvailable = portBridgeCheck?.Status == "pass" && portWssCheck?.Status == "pass";
        var hasRequiredHostRuntime = prerequisites.HasRequiredDotNetRuntimes && prerequisites.HasVcRedist;
        var bridgeStartReady = hasRequiredHostRuntime && secureModeReady && firewallReady;
        var hasBootstrapAddress = bootstrapUrl != "Not available";
        var listenerSetupReady = bridgeStartReady && session.IsRunning && hasBootstrapAddress;
        var issues = new List<string>();
        var startFailure = session.LastFailureReason;
        var hasStartFailure = !string.IsNullOrWhiteSpace(startFailure);

        if (hasStartFailure)
        {
            issues.Add(startFailure!);
        }

        if (!prerequisites.HasRequiredDotNetRuntimes)
        {
            issues.Add(prerequisites.DotNetRuntimeStatus);
        }

        if (!prerequisites.HasVcRedist)
        {
            issues.Add(prerequisites.VcRedistStatus);
        }

        var prioritizedChecks = diagnostics.Checks
            .Where(check => check.Status != "pass")
            .OrderBy(check => PriorityFor(check.Id))
            .ThenBy(check => check.Id, StringComparer.OrdinalIgnoreCase)
            .Select(check => check.Message);
        issues.AddRange(prioritizedChecks);

        var blockerCount = (prerequisites.HasRequiredDotNetRuntimes ? 0 : 1)
            + (prerequisites.HasVcRedist ? 0 : 1)
            + (secureModeReady ? 0 : 1)
            + (firewallReady ? 0 : 1);

        var bootstrapStatus = BuildBootstrapStatus(hasRequiredHostRuntime, secureModeReady, firewallReady, session.IsRunning, hasBootstrapAddress);
        var startBridgeState = session.IsRunning ? "Running" : bridgeStartReady ? "Action" : "Locked";
        var startBridgeNote = BuildStartBridgeNote(hasRequiredHostRuntime, secureModeReady, firewallReady, session.IsRunning, bootstrapUrl, hasStartFailure, startFailure);
        var listenerSetupNote = BuildListenerSetupNote(hasRequiredHostRuntime, secureModeReady, firewallReady, session.IsRunning, hasBootstrapAddress);

        var bridgeStatus = session.IsRunning
            ? "Running"
            : hasStartFailure
                ? "Start failed"
                : bridgeStartReady
                    ? "Ready to start"
                    : "Setup needed";

        var bridgeControlText = session.IsRunning
            ? "Running"
            : hasStartFailure
                ? "Failed"
                : bridgeStartReady
                    ? "Ready"
                    : "Setup needed";

        var primaryActionText = session.IsRunning
            ? "Bridge Running"
            : hasStartFailure
                ? "Retry Start"
                : bridgeStartReady
                    ? "Start Bridge"
                    : "Finish Setup";

        var simConnectStatus = session.IsRunning
            ? "Waiting for flight"
            : hasStartFailure
                ? "Bridge failed"
                : bridgeStartReady
                    ? "Waiting for bridge"
                    : "Finish setup";

        return new AppState
        {
            BlockerText = blockerCount == 1 ? "1 blocker" : $"{blockerCount} blockers",
            SecureModeText = secureModeReady ? "Secure mode ready" : "Secure mode required",
            DotNetStatus = prerequisites.DotNetRuntimeStatus,
            SimConnectStatus = simConnectStatus,
            BridgeStatus = bridgeStatus,
            BootstrapStatus = bootstrapStatus,
            BridgeControlText = bridgeControlText,
            PrimaryActionText = primaryActionText,
            HostIp = hostIp,
            SecureStream = secureStreamUrl == "Not available" ? "Not available" : "39002 /stream",
            LastIssue = issues.FirstOrDefault() ?? "No issues",
            ConnectUrl = connectUrl,
            BootstrapUrl = bootstrapUrl,
            RuntimeLog = string.IsNullOrWhiteSpace(session.RuntimeLog) ? diagnosticsJson : session.RuntimeLog,
            DotNetStepText = prerequisites.HasRequiredDotNetRuntimes ? "Installed" : "Action",
            DotNetButtonText = prerequisites.HasRequiredDotNetRuntimes ? "Installed" : "Open .NET Download",
            DotNetCurrentNote = prerequisites.DotNetRuntimeStatus,
            VcRedistStepText = prerequisites.HasVcRedist ? "Installed" : "Action",
            VcRedistButtonText = prerequisites.HasVcRedist ? "Installed" : "Install VC++ Runtime",
            VcRedistCurrentNote = prerequisites.HasVcRedist ? prerequisites.VcRedistStatus : "not installed on this PC.",
            SecureModeStepText = secureModeReady ? "Ready" : (hasRequiredHostRuntime ? "Action" : "Locked"),
            FirewallStepText = firewallReady ? "Ready" : (hasRequiredHostRuntime && secureModeReady ? "Action" : "Locked"),
            StartBridgeStepText = startBridgeState,
            StartBridgeButtonText = session.IsRunning ? "Bridge Running" : "Start Bridge",
            StartBridgeCurrentNote = startBridgeNote,
            ListenerSetupState = listenerSetupReady ? "Ready" : bootstrapStatus,
            ListenerSetupNote = listenerSetupNote,
            CanStartBridge = !session.IsRunning && bridgeStartReady,
            CanStopBridge = session.IsRunning,
            CanRestartBridge = session.IsRunning,
            CanInstallDotNet = !prerequisites.HasRequiredDotNetRuntimes,
            CanInstallVcRedist = !prerequisites.HasVcRedist,
            CanSetupSecureMode = hasRequiredHostRuntime,
            CanOpenFirewallRules = hasRequiredHostRuntime && secureModeReady,
            CanUseListenerSetup = listenerSetupReady
        };
    }

    private static string BuildBootstrapStatus(bool hasRequiredHostRuntime, bool secureModeReady, bool firewallReady, bool bridgeRunning, bool hasBootstrapAddress)
    {
        if (!hasRequiredHostRuntime)
        {
            return "Install runtimes";
        }

        if (!secureModeReady)
        {
            return "Secure mode first";
        }

        if (!firewallReady)
        {
            return "Firewall first";
        }

        if (!bridgeRunning)
        {
            return "Start bridge first";
        }

        if (!hasBootstrapAddress)
        {
            return "LAN IP needed";
        }

        return "Ready";
    }

    private static string BuildStartBridgeNote(bool hasRequiredHostRuntime, bool secureModeReady, bool firewallReady, bool bridgeRunning, string bootstrapUrl, bool hasStartFailure, string? startFailure)
    {
        if (bridgeRunning)
        {
            return bootstrapUrl == "Not available"
                ? "Bridge is running, but the host LAN address is not available yet."
                : $"Bridge is running. Listener setup is available from {bootstrapUrl}.";
        }

        if (hasStartFailure)
        {
            return startFailure ?? "Bridge startup failed.";
        }

        if (!hasRequiredHostRuntime)
        {
            return "Install .NET and VC++ on this host PC first.";
        }

        if (!secureModeReady)
        {
            return "Generate secure mode certificates on this host PC before starting the bridge.";
        }

        if (!firewallReady)
        {
            return "Open firewall rules as Administrator on this host PC before starting the bridge.";
        }

        return "Start the bridge to serve the bootstrap page and listener setup scripts.";
    }

    private static string BuildListenerSetupNote(bool hasRequiredHostRuntime, bool secureModeReady, bool firewallReady, bool bridgeRunning, bool hasBootstrapAddress)
    {
        if (!hasRequiredHostRuntime)
        {
            return "Install .NET and VC++ on the host PC first.";
        }

        if (!secureModeReady)
        {
            return "On the host PC, finish Secure Mode before onboarding listener devices.";
        }

        if (!firewallReady)
        {
            return "On the host PC, open firewall rules as Administrator before onboarding listener devices.";
        }

        if (!bridgeRunning)
        {
            return "Start the bridge on the host PC before using any Mac, Windows, or mobile setup commands.";
        }

        if (!hasBootstrapAddress)
        {
            return "The host LAN address could not be detected yet, so listener bootstrap is unavailable.";
        }

        return "Host is ready. On Windows listeners, open Administrator PowerShell before running the copied setup command.";
    }

    private static int PriorityFor(string id)
    {
        if (id.StartsWith("network.port_", StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (id.StartsWith("runtime.", StringComparison.OrdinalIgnoreCase) || id.StartsWith("dependency.", StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        if (id.StartsWith("network.wss_", StringComparison.OrdinalIgnoreCase) || id.StartsWith("network.root_ca", StringComparison.OrdinalIgnoreCase))
        {
            return 2;
        }

        if (id.StartsWith("network.firewall_", StringComparison.OrdinalIgnoreCase))
        {
            return 3;
        }

        return 4;
    }

    private static DiagnosticsCheck? FindCheck(DiagnosticsResult diagnostics, string id)
    {
        return diagnostics.Checks.FirstOrDefault(check => string.Equals(check.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    private static string? ExtractLanIp(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        var marker = "detected: ";
        var markerIndex = message.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0)
        {
            return null;
        }

        var start = markerIndex + marker.Length;
        var end = message.IndexOf(" (", start, StringComparison.Ordinal);
        if (end < 0)
        {
            end = message.Length;
        }

        var candidates = message[start..end]
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var candidate in candidates)
        {
            var normalized = candidate.Trim().TrimEnd('.', ';', ':', ')', ']');
            if (IPAddress.TryParse(normalized, out _))
            {
                return normalized;
            }
        }

        return null;
    }
}

