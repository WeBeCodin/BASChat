# Fixing "Categorization Failed" Error

## Problem
The application shows "Categorization Failed - Could not categorize the financial data" when trying to categorize transactions after selecting an industry.

## Root Cause
The `GOOGLE_GENAI_API_KEY` environment variable is not configured. The categorization feature uses Google's Generative AI API (Gemini) to intelligently categorize transactions based on industry-specific BAS rules.

## Solution

### Step 1: Get a Google AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### Step 2: Create Environment File

1. In the root of your project, create a file named `.env.local`
2. Add the following content:

```env
# Google AI API Key for transaction categorization and extraction
GOOGLE_GENAI_API_KEY=your_actual_api_key_here

# Optional: Python extractor service URLs (for local development)
PYTHON_EXTRACTOR_URL=http://localhost:8000
LANGEXTRACT_SERVICE_URL=http://localhost:8084

# Optional: Hybrid extraction configuration
EXTRACT_PAGE_LIMIT_FOR_PYTHON=1
VERTEX_AI_MODEL=gemini-2.5-flash-lite
```

3. Replace `your_actual_api_key_here` with the API key you copied from Google AI Studio

### Step 3: Restart the Development Server

1. Stop the current Next.js server (Ctrl+C)
2. Restart it:
   ```bash
   npm run dev
   ```

### Step 4: Test the Fix

1. Upload a PDF document
2. Select an industry (e.g., "Rideshare", "Construction & Trades")
3. The categorization should now work successfully

## Improvements Made

In addition to fixing the root cause, the following improvements were made:

1. **Better Error Messages**: The UI now shows specific error messages indicating when the API key is missing
2. **Error Details**: API errors now display the actual error message from the server instead of generic "Categorization Failed"
3. **Example Environment File**: Created `.env.local.example` as a template for configuration

## Verification

After following these steps, you should see:
- ✅ Transactions successfully categorized into Income/Expenses
- ✅ Industry-specific categorization based on BAS rules
- ✅ Confidence scores for each transaction
- ✅ "Maybe" category for transactions needing review

## Troubleshooting

### If categorization still fails:

1. **Check API Key Format**: Ensure there are no extra spaces or quotes around the key
2. **Verify Key Validity**: Test the key at [Google AI Studio](https://aistudio.google.com/)
3. **Check Console Logs**: Look for specific error messages in the browser console (F12)
4. **Environment Variables**: Ensure the `.env.local` file is in the root directory (same level as `package.json`)
5. **Restart Server**: Make sure you restarted the dev server after creating `.env.local`

### Common Error Messages:

- **"API Key Missing"**: `.env.local` file not found or `GOOGLE_GENAI_API_KEY` not set
- **"AI API failed: 401"**: Invalid API key
- **"AI API failed: 429"**: Rate limit exceeded (try again in a moment)
- **"AI API failed: 403"**: API key doesn't have proper permissions

## Security Note

⚠️ **Never commit your `.env.local` file to version control!** 

The `.gitignore` file should already exclude it, but double-check:
```bash
cat .gitignore | grep .env.local
```

If not present, add this line to `.gitignore`:
```
.env.local
```
