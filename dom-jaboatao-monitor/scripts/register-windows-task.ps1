<#
.SYNOPSIS
  Registra uma tarefa agendada no Windows para sincronizar o DOM de Jaboatão automaticamente
  às 08:00, 12:00, 16:00 e 20:00 todos os dias (capturando edições ordinárias e extras/suplementares).
#>
param(
  [string]$TaskName = "MonitorDOM-Jaboatao-Sync"
)

$ErrorActionPreference = "Stop"
$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$NpmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source

$Action = New-ScheduledTaskAction `
  -Execute $NpmCmd `
  -Argument "run sync -- --pages=1 --limit=10" `
  -WorkingDirectory $ProjectDir

$Triggers = @(
  (New-ScheduledTaskTrigger -Daily -At "08:00"),
  (New-ScheduledTaskTrigger -Daily -At "12:00"),
  (New-ScheduledTaskTrigger -Daily -At "16:00"),
  (New-ScheduledTaskTrigger -Daily -At "20:00")
)

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Triggers `
  -Settings $Settings `
  -Description "Sincronização automática do Diário Oficial do Município de Jaboatão dos Guararapes (08h, 12h, 16h e 20h)." `
  -Force | Out-Null

Write-Host "Tarefa '$TaskName' registrada com sucesso no Agendador de Tarefas do Windows!" -ForegroundColor Green
Write-Host "Horários: 08:00, 12:00, 16:00 e 20:00 | Diretório: $ProjectDir"
