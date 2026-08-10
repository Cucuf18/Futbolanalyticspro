$t1=[datetime]::Now
Invoke-RestMethod http://localhost:3001/api/standings/PL | Out-Null
$d1=([datetime]::Now-$t1).TotalMilliseconds

$t2=[datetime]::Now
$h = Invoke-RestMethod http://localhost:3001/api/h2h/57/65
$d2=([datetime]::Now-$t2).TotalMilliseconds

$t3=[datetime]::Now
$p = Invoke-RestMethod http://localhost:3001/api/predict/57/65
$d3=([datetime]::Now-$t3).TotalMilliseconds

Write-Host "Standings: $([int]$d1)ms | H2H: $([int]$d2)ms | Predict: $([int]$d3)ms"
Write-Host "H2H matches: $($h.data.matches.Count) | homeWin: $($p.data.prediction.probabilities.homeWin)%"
