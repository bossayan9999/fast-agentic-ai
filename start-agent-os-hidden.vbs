' Launches Fast Agent OS console for Task Scheduler
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /k """ & scriptDir & "\start-agent-os.bat""", 1, False
