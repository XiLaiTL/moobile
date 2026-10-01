# probe_cwd.ps1 —— list processes whose current working directory is under a given path.
# Used to find who keeps a directory locked against rename on Windows.
param([string]$Filter = 'interest', [switch]$Pids)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PebCwd {
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int size, out IntPtr read);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr h);
  [DllImport("ntdll.dll")]
  public static extern int NtQueryInformationProcess(IntPtr h, int cls, byte[] info, int len, out int ret);
  public static string Cwd(int pid) {
    IntPtr h = OpenProcess(0x0410, false, pid); // QUERY_INFORMATION | VM_READ
    if (h == IntPtr.Zero) return null;
    try {
      byte[] pbi = new byte[48];
      int ret;
      if (NtQueryInformationProcess(h, 0, pbi, pbi.Length, out ret) != 0) return null;
      long peb = BitConverter.ToInt64(pbi, 8);
      byte[] buf = new byte[8];
      IntPtr got;
      if (!ReadProcessMemory(h, (IntPtr)(peb + 0x20), buf, 8, out got)) return null;
      long pp = BitConverter.ToInt64(buf, 0);
      byte[] cur = new byte[16];
      if (!ReadProcessMemory(h, (IntPtr)(pp + 0x38), cur, 16, out got)) return null;
      int len = BitConverter.ToUInt16(cur, 0);
      long strbuf = BitConverter.ToInt64(cur, 8);
      if (len <= 0 || len > 4096) return null;
      byte[] sb = new byte[len];
      if (!ReadProcessMemory(h, (IntPtr)strbuf, sb, len, out got)) return null;
      return Encoding.Unicode.GetString(sb);
    } finally { CloseHandle(h); }
  }
}
"@

$found = Get-CimInstance Win32_Process | ForEach-Object {
  $c = [PebCwd]::Cwd($_.ProcessId)
  if ($c -and $c -like "*$Filter*") {
    [PSCustomObject]@{ PID = $_.ProcessId; Name = $_.Name; Cwd = $c }
  }
}

if ($Pids) { $found | ForEach-Object { $_.PID } } else { $found | Format-Table -AutoSize -Wrap }
