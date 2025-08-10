#!/bin/bash

# Google Cloud Function deployment script for LangExtract service

# Configuration
FUNCTION_NAME="langextract-pdf-service"
REGION="us-central1"  # Change to your preferred region
RUNTIME="python311"
MEMORY="1024MB"
TIMEOUT="300s"

# Environment variables (set these before deployment)
# GOOGLE_GENAI_API_KEY should be set in Google Cloud Console or here

echo "🚀 Deploying LangExtract PDF Service to Google Cloud Functions..."

# Deploy the function
gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=extract_pdf \
  --trigger=http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --set-env-vars GOOGLE_GENAI_API_KEY="$GOOGLE_GENAI_API_KEY" \
  --requirements-file=requirements-gcp.txt

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "Function URL will be displayed above. Update your Next.js app to use this URL."
    echo ""
    echo "Example usage in your .env:"
    echo "LANGEXTRACT_SERVICE_URL=https://$REGION-[PROJECT-ID].cloudfunctions.net/$FUNCTION_NAME"
    echo ""
    echo "Test the function:"
    echo "curl -X POST 'https://$REGION-[PROJECT-ID].cloudfunctions.net/$FUNCTION_NAME' \\"
    echo "  -H 'Content-Type: multipart/form-data' \\"
    echo "  -F 'file=@test_document.pdf' \\"
    echo "  -F 'document_type=bank_statement'"
else
    echo "❌ Deployment failed!"
    exit 1
fi
