# Google Cloud Run Deployment Guide

## Prerequisites

1. **Install Google Cloud CLI**
   ```bash
   # Download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate with Google Cloud**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable required APIs**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

4. **Install Docker** (if not already installed)

## Deployment Steps

1. **Update the project ID** in `deploy.ps1`:
   ```powershell
   $PROJECT_ID = "your-actual-gcp-project-id"
   ```

2. **Navigate to the service directory**:
   ```bash
   cd services/python-extractor
   ```

3. **Run the deployment script**:
   ```powershell
   .\deploy.ps1
   ```

4. **Copy the service URL** from the output and add it to your Vercel environment variables:
   - Go to your Vercel dashboard
   - Navigate to your project settings
   - Add environment variable: `PYTHON_EXTRACTOR_URL=https://your-service-url`
   - Redeploy your Vercel app

## Testing the Deployment

After deployment, test the service:

```bash
# Test health endpoint
curl https://your-service-url/health

# Test extraction endpoint
curl -X POST https://your-service-url/extract \
  -F "file=@sample.pdf"
```

## Monitoring

- View logs: `gcloud run services logs read bas-chat-pdf-extractor --region=us-central1`
- View metrics in Google Cloud Console: Cloud Run > Services > bas-chat-pdf-extractor

## Cost Optimization

- The service is configured with `min-instances: 0` for cost savings
- It will scale down to zero when not in use
- Memory: 1GB, CPU: 1 vCPU (adjust in deploy script if needed)

## Troubleshooting

1. **Build fails**: Check Docker is running and you have the required dependencies
2. **Push fails**: Ensure you're authenticated with `gcloud auth login`
3. **Deploy fails**: Check your project ID and that required APIs are enabled
4. **Service errors**: Check logs with `gcloud run services logs read`
