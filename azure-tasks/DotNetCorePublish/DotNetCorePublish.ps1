[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $WebSiteName,

    [String] [Parameter(Mandatory = $false)]
    $Slot,

    [String] [Parameter(Mandatory = $true)]
    $PackageOutput
)

Write-Verbose "Entering script DotNetCorePublish.ps1"

Write-Host "ConnectedServiceName= $ConnectedServiceName"
Write-Host "WebSiteName= $WebSiteName"
Write-Host "Slot= $Slot"
Write-Host "PackageOutput= $PackageOutput"

if ($Slot) 
{
    $website = Get-AzureWebsite -Name "$WebSiteName" -Slot "$Slot"
    $deployIisAppPath = $website.Name + "__" + $Slot
}
else 
{
    $website = Get-AzureWebsite -Name "$WebSiteName"
    $deployIisAppPath = $website.Name
}

# get the scm url to use with MSDeploy.  By default this will be the second in the array
$msdeployurl = $website.EnabledHostNames | Where-Object { $_ -like '*.scm*azurewebsites.net*' } | Select-Object -First 1

$publishProperties = @{
	'WebPublishMethod'='MSDeploy';
    'MSDeployServiceUrl'=$msdeployurl;
    'DeployIisAppPath'=$deployIisAppPath;
    'Username'=$website.PublishingUsername;
    'Password'=$website.PublishingPassword;
}

$publishScript = "${env:ProgramFiles(x86)}\Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\Web Tools\Publish\Scripts\default-publish.ps1"
. $publishScript -publishProperties $publishProperties  -packOutput "$PackageOutput"

Write-Verbose "Leaving script DotNetCorePublish.ps1"
