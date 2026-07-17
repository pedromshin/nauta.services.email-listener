Set-Location "C:\Users\pc\Desktop\nauta.services.email-listener"
while ($true) {
  # `yes y` equivalent: keep answering the enable prompt, and restart if the link ever drops.
  cmd /c "echo y| claude remote-control --name polytoken-travel >> .planning\night-run\remote-control.log 2>&1"
  Start-Sleep -Seconds 20
}
