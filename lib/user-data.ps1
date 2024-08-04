$env:SECRET_NAME = "{SECRET_NAME}"
$env:SSM_NAME = "{SSM_NAME}"

$awsCliInstallerUrl = "https://awscli.amazonaws.com/AWSCLIV2.msi"
$installerPath = "$env:TEMP\AWSCLIV2.msi"

function Check-AwsCli {
    try {
        aws --version
        return $true
    } catch {
        return $false
    }
}

function Find-AwsCliPath {
    $pathToCheck = [System.IO.Path]::Combine("C:\Program Files\Amazon\AWSCLIV2")

    if (Test-Path "$pathToCheck\aws.exe") {
        return $pathToCheck
    }
    return $null
}

if (-not (Check-AwsCli)) {
    Write-Output "AWS CLI not found. Installing AWS CLI..."

    try {
        Write-Output "Downloading AWS CLI installer..."
        Invoke-WebRequest -Uri $awsCliInstallerUrl -OutFile $installerPath

        Write-Output "Installing AWS CLI..."
        Start-Process -FilePath msiexec.exe -ArgumentList "/i $installerPath /quiet" -Wait

        # Give some time for the installation to complete
        Start-Sleep -Seconds 10

        # Find the AWS CLI installation path
        $awsCliPath = Find-AwsCliPath

        if ($awsCliPath) {
            # Add AWS CLI path to the current session's PATH
            $env:PATH += ";$awsCliPath"

            # Verify the AWS CLI installation
            if (Check-AwsCli) {
                Write-Output "AWS CLI installed successfully."
            } else {
                Write-Error "Failed to install AWS CLI."
                exit 1
            }
        } else {
            Write-Error "AWS CLI path not found. Installation may have failed."
            exit 1
        }
    } catch {
        Write-Error "Error during AWS CLI installation: $_"
        exit 1
    }
}

if (-not (Check-AwsCli)) {
    Write-Error "AWS CLI is not installed. Exiting."
    exit 1
}

$ssmParameterName = $env:SSM_NAME

Write-Output "Retrieving SSM parameter..."
$parameterValueJson = aws ssm get-parameter --name $ssmParameterName --with-decryption --query Parameter.Value --output text

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to retrieve the SSM parameter."
    exit 1
}

$parameterValue = $parameterValueJson | ConvertFrom-Json
$dbName = $parameterValue.dbName
$instanceName = $parameterValue.instanceName
$acumaticaMsiUrl = $parameterValue.acumaticaMsiUrl

Write-Output "Retrieving secret..."
$secretName = $env:SECRET_NAME
$secretValueJson = aws secretsmanager get-secret-value --secret-id $secretName --query SecretString --output text

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to retrieve the secret."
    exit 1
}

$secretValue = $secretValueJson | ConvertFrom-Json
$password = $secretValue.password
$port = $secretValue.port
$dbInstanceIdentifier = $secretValue.dbInstanceIdentifier
$secretHost = $secretValue.host
$username = $secretValue.username

Install-WindowsFeature -Name Web-Server, Web-Mgmt-Tools, Web-Asp-Net45, Web-Net-Ext45, Web-ISAPI-Ext, Web-ISAPI-Filter, Web-Default-Doc, Web-Dir-Browsing, Web-Http-Errors, Web-Static-Content, Web-Http-Redirect, NET-Framework-45-ASPNET, NET-Framework-45-Core, NET-Framework-45-Features, NET-Framework-Features

$acumaticaMsiPath = "$env:TEMP\AcumaticaERPInstall.msi"
Invoke-WebRequest -Uri $acumaticaMsiUrl -OutFile $acumaticaMsiPath

Write-Output "Installing Acumatica ERP..."
Start-Process -FilePath msiexec.exe -ArgumentList "/i `"$acumaticaMsiPath`" /quiet /norestart" -NoNewWindow -Wait -ErrorAction Stop

$configMode = "NewInstance"
$dbSrvType = "MSSqlServer"
$dbSrvName = $secretValue.host
$dbSrvUser = $secretValue.username
$dbSrvPass = $secretValue.password
$dbSrvWinAuth = "No"
$dbName = $parameterValue.dbName
$iName = $parameterValue.instanceName
$iPath = "C:\Program Files\Acumatica ERP\$iName"
$sWebsite = "Default Web Site"
$sVirtDir = $parameterValue.instanceName
$spool = $parameterValue.instanceName
$dbWinAuth = "No"
$dbUser = $secretValue.username
$dbNewUser = "No"
$dbPass = $secretValue.password
$company1 = "CompanyID=1;CompanyType=;LoginName=;"
$fullLog = "Yes"

$acumaticaConfigPath = "C:\Program Files\Acumatica ERP\Data\ac.exe"

Write-Output "Configuring Acumatica ERP..."
Start-Process -FilePath $acumaticaConfigPath -ArgumentList `
    "-configmode:$configMode", `
    "-dbsrvtype:$dbSrvType", `
    "-dbsrvname:`"$dbSrvName`"", `
    "-dbsrvuser:`"$dbSrvUser`"", `
    "-dbsrvpass:`"$dbSrvPass`"", `
    "-dbsrvwinauth:$dbSrvWinAuth", `
    "-dbname:`"$dbName`"", `
    "-iname:`"$iName`"", `
    "-ipath:`"$iPath`"", `
    "-swebsite:`"$sWebsite`"", `
    "-svirtdir:`"$sVirtDir`"", `
    "-spool:`"$spool`"", `
    "-dbwinauth:$dbWinAuth", `
    "-dbnewuser:`"$dbNewUser`"", `
    "-dbuser:`"$dbUser`"", `
    "-dbpass:`"$dbPass`"", `
    "-company:`"$company1`"", `
    "-fulllog:$fullLog" -NoNewWindow -Wait
