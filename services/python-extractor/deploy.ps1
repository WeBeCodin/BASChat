# Cloud Run deployment script for BAS Chat PDF Extractor
# Make sure you have gcloud CLI installed and authenticated

# Configuration
$PROJECT_ID = "your-gcp-project-id"  # Replace with your actual project ID
$SERVICE_NAME = "bas-chat-pdf-extractor"
$REGION = "us-central1"  # Change to your preferred region
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "Building and deploying $SERVICE_NAME to Google Cloud Run..." -ForegroundColor Green

# Build the Docker image
Write-Host "Building Docker image..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

# Push the image to Google Container Registry
Write-Host "Pushing image to GCR..." -ForegroundColor Yellow
docker push $IMAGE_NAME

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker push failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_NAME `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 8080 `
    --set-env-vars="PORT=8080" `
    --timeout=300

if ($LASTEXITCODE -ne 0) {
    Write-Host "Cloud Run deployment failed!" -ForegroundColor Red
    exit 1
}

# Get the service URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)'

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host "Health check: $SERVICE_URL/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add this to your Vercel environment variables:" -ForegroundColor Yellow
Write-Host "PYTHON_EXTRACTOR_URL=$SERVICE_URL" -ForegroundColor White
