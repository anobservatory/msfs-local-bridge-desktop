using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using MsfsLocalBridge.Models;
using MsfsLocalBridge.Services;

namespace MsfsLocalBridge;

public partial class MainWindow : Window
{
    private const int WmGetMinMaxInfoMessage = 0x0024;
    private const int WmNcLButtonDownMessage = 0x00A1;
    private const int HtCaption = 0x0002;
    private const uint MonitorDefaultToNearest = 0x00000002;

    private readonly BridgeWorkspace _workspace = new();
    private readonly PowerShellRunner _powerShellRunner = new();
    private readonly BridgeSessionService _sessionService;
    private readonly BridgeDiagnosticsService _diagnosticsService;
    private readonly PrerequisiteInstallerService _prerequisiteInstaller = new();
    private readonly AppStateBuilder _stateBuilder = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly DispatcherTimer _refreshTimer;
    private string _lastDiagnosticsJson = string.Empty;
    private AppState _currentState = new();

    public MainWindow()
    {
        InitializeComponent();
        _sessionService = new BridgeSessionService(_workspace, _powerShellRunner);
        _diagnosticsService = new BridgeDiagnosticsService(_workspace, _powerShellRunner);
        _refreshTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(5)
        };
        _refreshTimer.Tick += async (_, _) => await PublishStateAsync();
        Loaded += OnLoaded;
        SourceInitialized += OnSourceInitialized;
        Closing += OnClosing;
        StateChanged += OnWindowStateChanged;
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        if (PresentationSource.FromVisual(this) is HwndSource source)
        {
            source.AddHook(WindowProc);
        }
    }

    private IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WmGetMinMaxInfoMessage)
        {
            ApplyMaximizedSize(hwnd, lParam);
            handled = true;
        }

        return IntPtr.Zero;
    }

    private static void ApplyMaximizedSize(IntPtr hwnd, IntPtr lParam)
    {
        var monitor = MonitorFromWindow(hwnd, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero)
        {
            return;
        }

        var monitorInfo = new MonitorInfo();
        monitorInfo.Size = Marshal.SizeOf<MonitorInfo>();
        if (!GetMonitorInfo(monitor, ref monitorInfo))
        {
            return;
        }

        var workArea = monitorInfo.WorkArea;
        var monitorArea = monitorInfo.MonitorArea;
        var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);

        minMaxInfo.MaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
        minMaxInfo.MaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
        minMaxInfo.MaxSize.X = Math.Abs(workArea.Right - workArea.Left);
        minMaxInfo.MaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);

        Marshal.StructureToPtr(minMaxInfo, lParam, true);
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _refreshTimer.Stop();

        try
        {
            _sessionService.StopAsync().GetAwaiter().GetResult();
        }
        catch
        {
            // Best-effort cleanup during window shutdown.
        }
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (!File.Exists(_workspace.HostConsoleIndexPath))
        {
            MessageBox.Show(
                $"Host console file not found:\n{_workspace.HostConsoleIndexPath}",
                "MSFS Local Bridge",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Close();
            return;
        }

        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MSFS Local Bridge",
            "WebView2");
        Directory.CreateDirectory(userDataFolder);

        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
        await AppBrowser.EnsureCoreWebView2Async(environment);
        AppBrowser.DefaultBackgroundColor = System.Drawing.Color.FromArgb(7, 16, 26);
        AppBrowser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        AppBrowser.CoreWebView2.Settings.AreDevToolsEnabled = true;
        AppBrowser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        AppBrowser.NavigationCompleted += async (_, _) =>
        {
            await PublishStateAsync();
            await PostWindowStateAsync();
        };
        AppBrowser.Source = new Uri(_workspace.HostConsoleIndexPath);
        _refreshTimer.Start();
    }

    private async void OnWindowStateChanged(object? sender, EventArgs e)
    {
        await PostWindowStateAsync();
    }

    private void BeginWindowDrag()
    {
        try
        {
            var handle = new WindowInteropHelper(this).Handle;
            if (handle == IntPtr.Zero)
            {
                return;
            }

            ReleaseCapture();
            SendMessage(handle, WmNcLButtonDownMessage, (IntPtr)HtCaption, IntPtr.Zero);
        }
        catch
        {
            // Best-effort dragging for the custom web title bar.
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        var envelope = JsonSerializer.Deserialize<WebMessageEnvelope>(e.WebMessageAsJson, _jsonOptions);
        if (envelope is null)
        {
            return;
        }

        if (string.Equals(envelope.Type, "ready", StringComparison.OrdinalIgnoreCase))
        {
            await PublishStateAsync();
            await PostWindowStateAsync();
            return;
        }

        if (!string.Equals(envelope.Type, "action", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            await HandleActionAsync(envelope.Action);
        }
        catch (Exception ex)
        {
            await PostNotificationAsync($"Action failed: {ex.Message}");
            await PublishStateAsync();
        }
    }

    private async Task HandleActionAsync(string? action)
    {
        switch (action)
        {
            case "minimize-window":
                WindowState = WindowState.Minimized;
                return;
            case "toggle-maximize-window":
                ToggleWindowState();
                return;
            case "close-window":
                Close();
                return;
            case "drag-window":
                BeginWindowDrag();
                return;
            case "start-bridge":
                await _sessionService.StartAsync();
                break;
            case "stop-bridge":
                await _sessionService.StopAsync();
                break;
            case "restart-bridge":
                await _sessionService.RestartAsync();
                break;
            case "copy-link":
                Clipboard.SetText(_currentState.ConnectUrl);
                await PostNotificationAsync("Copied secure connect URL.");
                break;
            case "copy-bootstrap-url":
                Clipboard.SetText(_currentState.BootstrapUrl);
                await PostNotificationAsync("Copied bootstrap URL.");
                break;
            case "copy-diagnostics":
                Clipboard.SetText(_lastDiagnosticsJson);
                await PostNotificationAsync("Copied diagnostics JSON.");
                break;
            case "copy-log":
                Clipboard.SetText(_sessionService.RuntimeLog);
                await PostNotificationAsync("Copied runtime log.");
                break;
            case "clear-log":
                _sessionService.ClearLog();
                break;
            case "copy-mac-setup":
                Clipboard.SetText($"curl -fsSL {_currentState.BootstrapUrl}/listener/mac.sh | bash");
                await PostNotificationAsync("Copied Mac bootstrap command.");
                break;
            case "copy-windows-setup":
                Clipboard.SetText($"powershell -ExecutionPolicy Bypass -Command \"iwr '{_currentState.BootstrapUrl}/listener/windows.ps1' -UseBasicParsing | iex\"");
                await PostNotificationAsync("Copied Windows bootstrap command.");
                break;
            case "open-bootstrap-page":
                OpenExternal(_currentState.BootstrapUrl);
                break;
            case "open-mobile-guide":
                OpenExternal(_currentState.BootstrapUrl);
                break;
            case "install-dotnet":
                await PostNotificationAsync(await _prerequisiteInstaller.InstallDotNetDesktopRuntimeAsync());
                break;
            case "install-vcredist":
                await PostNotificationAsync(await _prerequisiteInstaller.InstallVcRedistAsync());
                break;
            case "setup-secure-mode":
                await RunScriptAndNotifyAsync(_workspace.CertSetupScriptPath, "Secure mode setup completed.");
                break;
            case "open-firewall-rules":
                _powerShellRunner.StartElevated(
                    _workspace.BridgeRepoRoot,
                    $"-ExecutionPolicy Bypass -Command \"& '{_workspace.RepairScriptPath}' -Action OpenFirewall39000 -Port 39000; & '{_workspace.RepairScriptPath}' -Action OpenFirewall39002 -Port 39002\"");
                await PostNotificationAsync("Requested elevated firewall rule update.");
                break;
        }

        await PublishStateAsync();
    }

    private void ToggleWindowState()
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private async Task RunScriptAndNotifyAsync(string scriptPath, string successMessage)
    {
        var result = await _powerShellRunner.RunAsync(
            _workspace.BridgeRepoRoot,
            $"-ExecutionPolicy Bypass -File \"{scriptPath}\"",
            CancellationToken.None);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(result.StandardError) ? result.StandardOutput : result.StandardError);
        }

        await PostNotificationAsync(successMessage);
    }

    private async Task PublishStateAsync()
    {
        if (AppBrowser.CoreWebView2 is null)
        {
            return;
        }

        try
        {
            var (diagnostics, diagnosticsJson) = await _diagnosticsService.GetAsync();
            var prerequisites = _prerequisiteInstaller.DetectStatus();
            _lastDiagnosticsJson = diagnosticsJson;
            _currentState = _stateBuilder.Build(diagnostics, diagnosticsJson, _sessionService, prerequisites);
        }
        catch (Exception ex)
        {
            _currentState = new AppState
            {
                BlockerText = "Diagnostics error",
                SecureModeText = "Diagnostics unavailable",
                DotNetStatus = "Unknown",
                SimConnectStatus = "Unknown",
                BridgeStatus = _sessionService.IsRunning ? "Running" : "Stopped",
                BootstrapStatus = "Unavailable",
                BridgeControlText = _sessionService.IsRunning ? "Running" : "Stopped",
                PrimaryActionText = "Unavailable",
                RuntimeLog = ex.Message,
                LastIssue = ex.Message,
                CanStartBridge = false,
                CanStopBridge = _sessionService.IsRunning,
                CanRestartBridge = _sessionService.IsRunning,
                CanSetupSecureMode = false,
                CanOpenFirewallRules = false
            };
        }

        var payload = JsonSerializer.Serialize(new { type = "state", state = _currentState }, _jsonOptions);
        AppBrowser.CoreWebView2.PostWebMessageAsJson(payload);
    }

    private async Task PostNotificationAsync(string message)
    {
        if (AppBrowser.CoreWebView2 is null)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new { type = "notification", message }, _jsonOptions);
        AppBrowser.CoreWebView2.PostWebMessageAsJson(payload);
        await Task.CompletedTask;
    }

    private async Task PostWindowStateAsync()
    {
        if (AppBrowser.CoreWebView2 is null)
        {
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            type = "window-state",
            maximized = WindowState == WindowState.Maximized
        }, _jsonOptions);
        AppBrowser.CoreWebView2.PostWebMessageAsJson(payload);
        await Task.CompletedTask;
    }

    private static void OpenExternal(string target)
    {
        if (string.IsNullOrWhiteSpace(target) || target == "Not available")
        {
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = target,
            UseShellExecute = true
        });
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MonitorInfo lpmi);

    [StructLayout(LayoutKind.Sequential)]
    private struct PointInt
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MinMaxInfo
    {
        public PointInt Reserved;
        public PointInt MaxSize;
        public PointInt MaxPosition;
        public PointInt MinTrackSize;
        public PointInt MaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorRectangle
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MonitorInfo
    {
        public int Size;
        public MonitorRectangle MonitorArea;
        public MonitorRectangle WorkArea;
        public uint Flags;
    }
}

internal sealed class WebMessageEnvelope
{
    public string Type { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
}
