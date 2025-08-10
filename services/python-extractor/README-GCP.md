# LangExtract PDF Service - Google Cloud Functions Deployment

This directory contains the Python LangExtract service configured for deployment to Google Cloud Functions.

## Prerequisites

1. **Google Cloud SDK**: Install from https://cloud.google.com/sdk/docs/install
2. **Google Cloud Project**: Create a project at https://console.cloud.google.com
3. **Google AI API Key**: Get from https://aistudio.google.com/app/apikey

## Quick Deployment

### 1. Setup Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Set Environment Variables

```bash
# Set your Google AI API key
export GOOGLE_GENAI_API_KEY="your_api_key_here"
```

### 3. Deploy (Windows PowerShell)

```powershell
cd services/python-extractor
.\deploy-gcp.ps1
```

### 3. Deploy (Linux/Mac)

```bash
cd services/python-extractor
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

## After Deployment

1. **Get Function URL**: The deployment script will show the function URL
2. **Update Next.js**: Add to your `.env.local`:

```env
LANGEXTRACT_SERVICE_URL=https://us-central1-your-project.cloudfunctions.net/langextract-pdf-service
```

3. **Update Dashboard**: The dashboard will automatically use the cloud function instead of localhost

## Testing the Cloud Function

```bash
# Test with curl
curl -X POST 'https://us-central1-your-project.cloudfunctions.net/langextract-pdf-service' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@test_document.pdf' \
  -F 'document_type=bank_statement'
```

## Cost Estimation

- **Free Tier**: 2 million invocations per month
- **Typical Cost**: $0.0000004 per invocation + compute time
- **Memory**: 1GB allocated for PDF processing
- **Timeout**: 5 minutes maximum

## Monitoring

Monitor your function at:
https://console.cloud.google.com/functions/list

## Files Structure

```
cloud_function.py       # Google Cloud Function entry point
requirements-gcp.txt    # Dependencies for Cloud Functions
deploy-gcp.ps1         # Windows deployment script
deploy-gcp.sh          # Linux/Mac deployment script
langextract_service.py # Core LangExtract implementation
```

## Environment Variables

- `GOOGLE_GENAI_API_KEY`: Required for AI processing
- `LANGEXTRACT_SERVICE_URL`: URL of deployed function (for Next.js app)

## Troubleshooting

### Common Issues

1. **API Key Missing**: Set `GOOGLE_GENAI_API_KEY` environment variable
2. **APIs Not Enabled**: Enable Cloud Functions and Cloud Build APIs
3. **Permissions**: Ensure your Google Cloud account has function deployment permissions
4. **Memory Limits**: Increase memory if processing large PDFs fails

### Debug Function

```bash
# View function logs
gcloud functions logs read langextract-pdf-service --region=us-central1
```

### Redeploy

Simply run the deploy script again to update the function with new code.

## Production Considerations

1. **Security**: Remove `--allow-unauthenticated` for production
2. **CORS**: Configure specific origins instead of `*`
3. **Rate Limiting**: Implement quota management
4. **Monitoring**: Set up alerting for errors/performance
