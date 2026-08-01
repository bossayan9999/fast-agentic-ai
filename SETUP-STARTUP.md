# Auto-start Fast Agent OS on Windows login

## Option A – Startup folder (easiest)

1. Press `Win + R`, type:
   ```
   shell:startup
   ```
   and press Enter.

2. Copy a **shortcut** to `start-agent-os.bat` into that folder:
   - Right-click `start-agent-os.bat` in your project folder  
     `C:\\Users\\Christian\\fast-agentic-ai\\start-agent-os.bat`
   - **Create shortcut**
   - Move the shortcut into the Startup folder that opened

3. Sign out and sign back in (or restart).  
   A terminal will open, the server will start, and the browser will open to **http://localhost:3000**.

## Option B – Task Scheduler (runs minimized)

1. Open **Task Scheduler** → Create Basic Task  
2. Name: `Fast Agent OS`  
3. Trigger: **When I log on**  
4. Action: **Start a program**  
5. Program:  
   `C:\\Users\\Christian\\fast-agentic-ai\\start-agent-os.bat`  
6. Finish.

## Manual start (anytime)

Double-click:

```
C:\\Users\\Christian\\fast-agentic-ai\\start-agent-os.bat
```

## Notes

- Keep the terminal window open while you use the app.
- API key is set in the app **Settings** panel (saved in the browser).
