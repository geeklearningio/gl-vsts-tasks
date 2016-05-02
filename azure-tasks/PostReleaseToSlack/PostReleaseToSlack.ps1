param(
   [string] $WebHookUrl,
   [string] $RequestedFor,
   [string] $ReleaseName,
   [string] $AzureWebsiteName,
   [string] $Slot,
   [string] $EnvironmentName,
   [string] $ReleaseDescription
)

if ($Slot) {
    $website = Get-AzureWebsite -Name "$AzureWebsiteName" -Slot "$Slot"
	$websiteName = "$AzureWebsiteName (slot $Slot)"
} else {
    $website = Get-AzureWebsite -Name "$AzureWebsiteName"
	$websiteName = "$AzureWebsiteName"
}

$websiteUrl = "http://$($website.EnabledHostNames[0])" 

$message = @{
  attachments = @(
    @{
      color = "good"
      fields = @(
        @{
          title = "Requested by"
          value = $RequestedFor
          short = "true"
        },    
        @{	    
          title = "Description"
          value = $ReleaseDescription
          short = "true"
        }
      )
      pretext = "Release $ReleaseName deployed to $EnvironmentName environment successfully! :grinning:
You can test it now on <$websiteUrl>."
      mrkdwn_in = @(
        "pretext"
      )
      fallback = "Release $ReleaseName deployed to $EnvironmentName successfully!"
    }
  )
}

$json = $message | ConvertTo-Json -Depth 4
echo $json

try 
{
    Invoke-RestMethod -Uri "$WebHookUrl" -Method Post -Body $json -ContentType 'application/json; charset=utf-8'
}
catch 
{
	echo "Slack API call failed."
	echo "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    echo "StatusDescription:" $_.Exception.Response.StatusDescription
}
