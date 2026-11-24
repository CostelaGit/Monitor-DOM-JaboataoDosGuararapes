param(
  [string]$TaskName = "MonitorDOM-Jaboatao-Sync"
)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Tarefa '$TaskName' removida com sucesso." -ForegroundColor Yellow
} else {
  Write-Host "Tarefa '$TaskName' não encontrada no Agendador de Tarefas."
}
