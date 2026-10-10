$ErrorActionPreference='Stop'
$runtime=$PSScriptRoot
$node='D:\nvm\nodejs\node.exe'
$services=@(@{Port=13000;Script='start-backend.cjs';Log='backend'},@{Port=14173;Script='serve-recovered.cjs';Log='web'})
foreach($service in $services){
  $script=Join-Path $runtime $service.Script
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue)
  if($listeners.Count){
    foreach($listener in $listeners){
      $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      if(-not $process.CommandLine.Contains($script)){throw "Port $($service.Port) belongs to another process; nothing stopped."}
    }
    continue
  }
  Start-Process -FilePath $node -ArgumentList $script -WorkingDirectory $runtime -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime ($service.Log+'.log')) -RedirectStandardError (Join-Path $runtime ($service.Log+'.err.log')) | Out-Null
}
Write-Output '恢复版：http://127.0.0.1:14173/'
Write-Output '在新浏览器上下文载入已核实的历史212案例：http://127.0.0.1:14173/_recovery-import-historical-212'
