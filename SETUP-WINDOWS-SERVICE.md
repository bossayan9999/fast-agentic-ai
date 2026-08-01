# Windows Service Integration — Fast Agent OS

Run as a real **Windows Service** (starts at boot, background, no terminal).

## Comparison

| Method | Starts | Login needed | Terminal | Best for |
|--------|--------|--------------|----------|----------|
| **Task Scheduler** | At logon | Yes | Yes | Daily desktop + open browser |
| **Windows Service (NSSM)** | At boot | No | No (file logs) | Always-on background |
| **PM2 service** | At boot | No | No | Already using PM2 |

## Quick install (NSSM)

1. Download NSSM: https://nssm.cc/download → put `nssm.exe` in `C:\nssm\win64\` or `tools\nssm\`
2. Build:
   ```powershell
   cd C:\Users\Christian\fast-agentic-ai
   git pull
   npm install
   npm run build:next
   ```
3. **Admin** CMD:
   ```bat
   cd C:\Users\Christian\fast-agentic-ai
   scripts\service-install.bat
   ```

## Manage

| Action | Command |
|--------|--------|
| Start | `net start FastAgentOS` |
| Stop | `net stop FastAgentOS` |
| UI | `services.msc` → Fast Agent OS |
| Uninstall | `scripts\service-uninstall.bat` (Admin) |

URL: http://localhost:3000  
Logs: `logs\service-stdout.log`

Optional env key:
```bat
nssm set FastAgentOS AppEnvironmentExtra OPENROUTER_API_KEY=sk-or-v1-...
nssm restart FastAgentOS
```

Services do not open a browser; bookmark localhost:3000 or keep Task Scheduler for that.
