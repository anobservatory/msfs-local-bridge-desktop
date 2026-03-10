using System.IO;

namespace MockupShell.Services;

internal sealed class BridgeWorkspace
{
    public string MockupRoot { get; }
    public string MockupIndexPath { get; }
    public string BridgeRepoRoot { get; }
    public string BridgeScriptPath { get; }
    public string DiagnosticsScriptPath { get; }
    public string CertSetupScriptPath { get; }
    public string RepairScriptPath { get; }

    public BridgeWorkspace()
    {
        MockupRoot = Path.Combine(AppContext.BaseDirectory, "windows-host-onboarding-v1");
        MockupIndexPath = Path.Combine(MockupRoot, "index.html");
        BridgeRepoRoot = ResolveBundledBridgeRoot()
            ?? ResolveBridgeRepoRoot()
            ?? throw new DirectoryNotFoundException("Could not find bridge payload.");
        BridgeScriptPath = Path.Combine(BridgeRepoRoot, "run-bridge.ps1");
        DiagnosticsScriptPath = Path.Combine(BridgeRepoRoot, "diagnostics-v0.ps1");
        CertSetupScriptPath = Path.Combine(BridgeRepoRoot, "setup-wss-cert-v0.ps1");
        RepairScriptPath = Path.Combine(BridgeRepoRoot, "repair-elevated-v0.ps1");
    }

    private static string? ResolveBundledBridgeRoot()
    {
        var candidate = Path.Combine(AppContext.BaseDirectory, "bridge");
        return HasBridgePayload(candidate) ? candidate : null;
    }

    private static string? ResolveBridgeRepoRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "msfs-local-bridge");
            if (HasBridgePayload(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        return null;
    }

    private static bool HasBridgePayload(string candidate)
    {
        return Directory.Exists(candidate)
            && File.Exists(Path.Combine(candidate, "run-bridge.ps1"))
            && File.Exists(Path.Combine(candidate, "diagnostics-v0.ps1"));
    }
}
