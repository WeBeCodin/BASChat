# Google Cloud Function deployment script for LangExtract service (PowerShell)

# Configuration
$FUNCTION_NAME = "langextract-pdf-service"
$REGION = "us-central1"  # Change to your preferred region
$RUNTIME = "python311"
$MEMORY = "1024MB"
$TIMEOUT = "300s"

# Check if Google Cloud SDK is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Google Cloud SDK not found. Please install it first:" -ForegroundColor Red
    Write-Host "   https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Check if user is authenticated
$authCheck = gcloud auth list --filter="status:ACTIVE" --format="value(account)"
if (-not $authCheck) {
    Write-Host "❌ Not authenticated with Google Cloud. Please run:" -ForegroundColor Red
    Write-Host "   gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Deploying LangExtract PDF Service to Google Cloud Functions..." -ForegroundColor Green

# Check for API key
if (-not $env:GOOGLE_GENAI_API_KEY) {
    Write-Host "⚠️  GOOGLE_GENAI_API_KEY environment variable not set!" -ForegroundColor Yellow
    $apiKey = Read-Host "Enter your Google AI API key (or press Enter to skip)"
    if ($apiKey) {
        $env:GOOGLE_GENAI_API_KEY = $apiKey
    }
}

# Deploy the function
$deployCmd = @(
    "gcloud", "functions", "deploy", $FUNCTION_NAME,
    "--gen2",
    "--runtime=$RUNTIME",
    "--region=$REGION",
    "--source=.",
    "--entry-point=extract_pdf",
    "--trigger=http",
    "--allow-unauthenticated",
    "--memory=$MEMORY",
    "--timeout=$TIMEOUT",
    "--requirements-file=requirements-gcp.txt"
)

if ($env:GOOGLE_GENAI_API_KEY) {
    $deployCmd += "--set-env-vars", "GOOGLE_GENAI_API_KEY=$env:GOOGLE_GENAI_API_KEY"
}

Write-Host "Executing deployment command..." -ForegroundColor Blue
& $deployCmd[0] $deployCmd[1..($deployCmd.Length-1)]

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Function URL will be displayed above. Update your Next.js app to use this URL." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Example usage in your .env.local:" -ForegroundColor Yellow
    Write-Host "LANGEXTRACT_SERVICE_URL=https://$REGION-[PROJECT-ID].cloudfunctions.net/$FUNCTION_NAME"
    Write-Host ""
    Write-Host "Test the function:" -ForegroundColor Yellow
    Write-Host "curl -X POST 'https://$REGION-[PROJECT-ID].cloudfunctions.net/$FUNCTION_NAME' \"
    Write-Host "  -H 'Content-Type: multipart/form-data' \"
    Write-Host "  -F 'file=@test_document.pdf' \"
    Write-Host "  -F 'document_type=bank_statement'"
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above and try again." -ForegroundColor Yellow
    exit 1
}
