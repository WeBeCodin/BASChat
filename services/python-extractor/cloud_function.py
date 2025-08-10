# Google Cloud Function entry point
# This file adapts the LangExtract service for Google Cloud Functions

import functions_framework
from flask import Request
import json
import base64
from langextract_service import LangExtractProcessor

# Initialize the processor
processor = LangExtractProcessor()

@functions_framework.http
def extract_pdf(request: Request):
    """Google Cloud Function entry point for PDF extraction"""
    
    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if request.method != 'POST':
        return ('Method not allowed', 405, headers)

    try:
        # Handle JSON payload (base64 encoded PDF)
        if request.content_type == 'application/json':
            data = request.get_json()
            pdf_base64 = data.get('pdf_data')
            document_type = data.get('document_type', 'bank_statement')
            
            if not pdf_base64:
                return (json.dumps({'error': 'No PDF data provided'}), 400, headers)
            
            # Decode base64 PDF
            pdf_bytes = base64.b64decode(pdf_base64)
        
        # Handle multipart form data
        elif 'multipart/form-data' in request.content_type:
            files = request.files
            form = request.form
            
            if 'file' not in files:
                return (json.dumps({'error': 'No file provided'}), 400, headers)
            
            file = files['file']
            document_type = form.get('document_type', 'bank_statement')
            pdf_bytes = file.read()
        
        else:
            return (json.dumps({'error': 'Invalid content type'}), 400, headers)

        print(f"Processing PDF: {len(pdf_bytes)} bytes, type: {document_type}")

        # Process with LangExtract
        result = processor.handle_extraction_request(pdf_bytes, document_type)
        
        print(f"Extraction completed: {result.get('transaction_count', 0)} transactions")
        
        return (json.dumps(result), 200, headers)

    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        error_response = {
            'error': f'PDF extraction failed: {str(e)}',
            'timestamp': processor.get_timestamp()
        }
        return (json.dumps(error_response), 500, headers)
