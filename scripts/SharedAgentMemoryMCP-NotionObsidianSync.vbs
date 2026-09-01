Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Dev\shared-agent-memory-mcp"
nodeExe = "C:\Program Files\FlyEnv-Data\env\node\node.exe"
cliFile = "C:\Dev\shared-agent-memory-mcp\dist\cli.js"
command = Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & cliFile & Chr(34) & " watch --interval 300"
shell.Run command, 0, False
