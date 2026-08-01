# Auto-start Fast Agent OS with Windows Task Scheduler

## 1. Pull latest scripts

```powershell
cd C:\Users\Christian\fast-agentic-ai
git pull
```

## 2. Create the task

1. Open **Task Scheduler**.
2. **Create Task…** (not Basic Task).
3. **General**: Name `Fast Agent OS` · **Run only when user is logged on**.
4. **Triggers** → New → **At log on** · Delay **30 seconds** · OK.
5. **Actions** → New → Start a program:
   - Program: `C:\Users\Christian\fast-agentic-ai\start-agent-os.bat`
   - Start in: `C:\Users\Christian\fast-agentic-ai`
6. **Conditions**: uncheck “only on AC power”.
7. **Settings**: Allow on demand · Do not start a new instance if running.
8. OK.

## 3. Test

Right-click task → **Run**. Browser should open http://localhost:3000.

## Optional minimized launch

- Program: `wscript.exe`
- Arguments: `"C:\Users\Christian\fast-agentic-ai\start-agent-os-hidden.vbs"`
- Start in: `C:\Users\Christian\fast-agentic-ai`
