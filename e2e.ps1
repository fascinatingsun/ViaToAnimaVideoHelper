$an = Invoke-RestMethod -Uri 'http://localhost:4000/api/analyze' -Method Post -Body (@{ path = 'uploads/test-audio.txt' } | ConvertTo-Json) -ContentType 'application/json'
Write-Output "ANALYSIS:"
$an | ConvertTo-Json -Depth 5
$step = $an.plan[0]
$gp = Invoke-RestMethod -Uri 'http://localhost:4000/api/generate-prompt' -Method Post -Body (@{ stepText = $step.title; transcription = $an.transcription; analysis = $an.analysis } | ConvertTo-Json) -ContentType 'application/json'
Write-Output "GENERATED_PROMPT:"
$gp | ConvertTo-Json -Depth 5
$gi = Invoke-RestMethod -Uri 'http://localhost:4000/api/generate-image' -Method Post -Body (@{ prompt = $gp.prompt; style = @{ name='local-style' } } | ConvertTo-Json) -ContentType 'application/json'
Write-Output "GENERATED_IMAGE:"
$gi | ConvertTo-Json -Depth 5
