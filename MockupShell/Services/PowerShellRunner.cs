using System.Diagnostics;
using System.IO;
using System.Text;

namespace MockupShell.Services;

internal sealed class PowerShellRunner
{
    private readonly string _powerShellPath;

    public PowerShellRunner()
    {
        _powerShellPath = Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe");
    }

    public async Task<PowerShellResult> RunAsync(string workingDirectory, string arguments, CancellationToken cancellationToken = default)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _powerShellPath,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.Start();
        var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        stdout.Append(await outputTask);
        stderr.Append(await errorTask);

        return new PowerShellResult(process.ExitCode, stdout.ToString(), stderr.ToString());
    }

    public Process StartStreaming(
        string workingDirectory,
        string arguments,
        Action<string> onOutput,
        Action<string> onError)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _powerShellPath,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
            {
                onOutput(args.Data);
            }
        };
        process.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
            {
                onError(args.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    public void StartElevated(string workingDirectory, string arguments)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = _powerShellPath,
            WorkingDirectory = workingDirectory,
            Arguments = arguments,
            UseShellExecute = true,
            Verb = "runas"
        });
    }
}

internal sealed record PowerShellResult(int ExitCode, string StandardOutput, string StandardError);