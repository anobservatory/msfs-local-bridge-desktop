using System.Diagnostics;
using System.Text;

namespace MockupShell.Services;

internal sealed class BridgeSessionService
{
    private readonly BridgeWorkspace _workspace;
    private readonly PowerShellRunner _runner;
    private readonly StringBuilder _runtimeLog = new();
    private readonly object _sync = new();
    private Process? _process;
    private string? _lastFailureReason;
    private int? _lastExitCode;

    public BridgeSessionService(BridgeWorkspace workspace, PowerShellRunner runner)
    {
        _workspace = workspace;
        _runner = runner;
    }

    public bool IsRunning => _process is { HasExited: false };

    public string? LastFailureReason
    {
        get
        {
            lock (_sync)
            {
                return _lastFailureReason;
            }
        }
    }

    public int? LastExitCode
    {
        get
        {
            lock (_sync)
            {
                return _lastExitCode;
            }
        }
    }

    public string RuntimeLog
    {
        get
        {
            lock (_sync)
            {
                return _runtimeLog.ToString();
            }
        }
    }

    public async Task StartAsync()
    {
        if (IsRunning)
        {
            return;
        }

        ResetFailureState();
        AppendLog("bridge: starting run-bridge.ps1");
        var arguments = $"-ExecutionPolicy Bypass -File \"{_workspace.BridgeScriptPath}\" -SkipLanHints";
        var process = _runner.StartStreaming(_workspace.BridgeRepoRoot, arguments, AppendLog, line => AppendLog($"ERROR: {line}"));
        process.Exited += (_, _) => OnProcessExited(process);
        _process = process;

        await Task.Delay(1500);
        if (process.HasExited)
        {
            _process = null;
            throw new InvalidOperationException(LastFailureReason ?? $"Bridge exited with code {process.ExitCode}.");
        }
    }

    public Task StopAsync()
    {
        if (!IsRunning || _process is null)
        {
            return Task.CompletedTask;
        }

        AppendLog("bridge: stopping process");
        _process.Kill(entireProcessTree: true);
        _process.Dispose();
        _process = null;
        return Task.CompletedTask;
    }

    public async Task RestartAsync()
    {
        await StopAsync();
        await StartAsync();
    }

    public void ClearLog()
    {
        lock (_sync)
        {
            _runtimeLog.Clear();
        }
    }

    private void OnProcessExited(Process process)
    {
        lock (_sync)
        {
            _lastExitCode = process.ExitCode;
            _lastFailureReason ??= BuildFailureReason(_runtimeLog.ToString(), process.ExitCode);
        }

        AppendLog($"bridge: exited with code {process.ExitCode}");
    }

    private void ResetFailureState()
    {
        lock (_sync)
        {
            _lastFailureReason = null;
            _lastExitCode = null;
        }
    }

    private void AppendLog(string line)
    {
        lock (_sync)
        {
            if (_runtimeLog.Length > 0)
            {
                _runtimeLog.AppendLine();
            }

            _runtimeLog.Append($"[{DateTime.Now:HH:mm:ss}] {line}");
            _lastFailureReason = DetectFailureReason(line) ?? _lastFailureReason;
        }
    }

    private static string? DetectFailureReason(string line)
    {
        if (line.Contains("address already in use", StringComparison.OrdinalIgnoreCase))
        {
            return "Port 39000 is already in use.";
        }

        if (line.Contains("Failed to bind to address", StringComparison.OrdinalIgnoreCase))
        {
            return "Bridge could not bind to the required port.";
        }

        if (line.Contains("WSS is required but certificate files are missing", StringComparison.OrdinalIgnoreCase))
        {
            return "Secure mode certificate files are missing.";
        }

        if (line.Contains("Unhandled exception", StringComparison.OrdinalIgnoreCase))
        {
            return "Bridge crashed during startup.";
        }

        return null;
    }

    private static string BuildFailureReason(string runtimeLog, int exitCode)
    {
        if (runtimeLog.Contains("address already in use", StringComparison.OrdinalIgnoreCase))
        {
            return "Port 39000 is already in use.";
        }

        if (runtimeLog.Contains("Failed to bind to address", StringComparison.OrdinalIgnoreCase))
        {
            return "Bridge could not bind to the required port.";
        }

        return $"Bridge exited with code {exitCode}.";
    }
}
