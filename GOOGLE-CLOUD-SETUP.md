# 🔧 Google Cloud Setup Guide

This guide will help you set up Google Cloud services to replace Azure services in the ESUS Audit AI application.

## 📋 Prerequisites

- Google Cloud Account with billing enabled
- Google Cloud SDK installed locally (optional)
- Access to create and manage Google Cloud resources

## 🚀 Service Setup

### 1. Google Cloud Project Setup

1. **Create a new project** or select an existing one:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Note your Project ID

2. **Enable required APIs**:
   ```bash
   # Enable Document AI API
   gcloud services enable documentai.googleapis.com
   
   # Enable Vertex AI API
   gcloud services enable aiplatform.googleapis.com
   
   # Enable Discovery Engine API (for Vertex AI Search)
   gcloud services enable discoveryengine.googleapis.com
   
   # Enable Cloud Storage API
   gcloud services enable storage.googleapis.com
   ```

### 2. Document AI Setup

1. **Create a Document AI processor**:
   - Go to [Document AI Console](https://console.cloud.google.com/ai/document-ai)
   - Click "Create Processor"
   - Select "Form Parser" or "Invoice Parser" based on your needs
   - Choose your region (e.g., `us`, `eu`, `asia`)
   - Note the Processor ID

2. **Configure environment variables**:
   ```bash
   DOCUMENT_AI_PROCESSOR_ID=your-processor-id
   DOCUMENT_AI_LOCATION=us  # or your chosen region
   ```

### 3. Vertex AI Setup

1. **Create a service account**:
   - Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
   - Click "Create Service Account"
   - Name: `esus-audit-ai-service`
   - Description: `Service account for ESUS Audit AI application`

2. **Grant required permissions**:
   - Document AI API User
   - Vertex AI User
   - Discovery Engine API User
   - Cloud Storage Object Viewer
   - Cloud Storage Object Creator

3. **Create and download service account key**:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download and save securely
   - Set environment variable: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json`

### 4. Vertex AI Search Setup

1. **Create a data store**:
   - Go to [Vertex AI Search Console](https://console.cloud.google.com/gen-app-builder)
   - Click "Create App" or "Create Data Store"
   - Choose "Search" as the use case
   - Select "Unstructured documents"
   - Choose your region (e.g., `global`, `us-central1`)
   - Note the Data Store ID

2. **Configure environment variables**:
   ```bash
   VERTEX_AI_SEARCH_DATA_STORE_ID=your-data-store-id
   VERTEX_AI_SEARCH_LOCATION=global  # or your chosen region
   ```

### 5. Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Google Cloud Configuration
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_LOCATION=your-gcp-region
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json

# Document AI Configuration
DOCUMENT_AI_PROCESSOR_ID=your-document-ai-processor-id
DOCUMENT_AI_LOCATION=your-document-ai-location

# Vertex AI Configuration
VERTEX_AI_MODEL_NAME=gemini-1.5-pro-001

# Vertex AI Search Configuration
VERTEX_AI_SEARCH_DATA_STORE_ID=your-search-data-store-id
VERTEX_AI_SEARCH_LOCATION=global
```

## 🔧 Local Development

1. **Install dependencies**:
   ```bash
   cd nextjs
   npm install
   ```

2. **Set up authentication**:
   - Place your service account key file in a secure location
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable
   - Or use `gcloud auth application-default login` for development

3. **Test the setup**:
   ```bash
   npm run dev
   ```

## 🚀 Production Deployment

### Vercel Deployment

1. **Add environment variables in Vercel**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add all the Google Cloud environment variables
   - For `GOOGLE_APPLICATION_CREDENTIALS`, upload the service account key file content

2. **Deploy**:
   ```bash
   vercel --prod
   ```

### Other Platforms

For other deployment platforms, ensure you:
- Set all required environment variables
- Securely store the service account key
- Configure proper IAM permissions

## 🔍 Testing Your Setup

1. **Test Document AI**:
   - Upload a document through the application
   - Check if it processes correctly
   - Verify extracted data quality

2. **Test Vertex AI**:
   - Use the chat functionality
   - Verify AI responses are generated
   - Check for any authentication errors

3. **Test Vertex AI Search**:
   - Search for documents
   - Verify search results are returned
   - Check search relevance

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify service account key is correct
   - Check IAM permissions
   - Ensure APIs are enabled

2. **Document AI Errors**:
   - Verify processor ID is correct
   - Check region matches
   - Ensure processor is active

3. **Vertex AI Errors**:
   - Check model name is correct
   - Verify project ID
   - Ensure billing is enabled

4. **Search Errors**:
   - Verify data store ID
   - Check region configuration
   - Ensure data store is active

### Getting Help

- Check [Google Cloud Documentation](https://cloud.google.com/docs)
- Review [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- Check [Document AI Documentation](https://cloud.google.com/document-ai/docs)

## 💰 Cost Considerations

- **Document AI**: Pay per document processed
- **Vertex AI**: Pay per token used
- **Vertex AI Search**: Pay per search query and document storage
- **Cloud Storage**: Pay for storage and bandwidth

Monitor your usage in the [Google Cloud Console](https://console.cloud.google.com/) to track costs.

## 🔒 Security Best Practices

1. **Service Account Security**:
   - Use least privilege principle
   - Rotate keys regularly
   - Store keys securely

2. **API Security**:
   - Enable API restrictions
   - Use VPC Service Controls if needed
   - Monitor API usage

3. **Data Security**:
   - Encrypt data at rest and in transit
   - Use proper access controls
   - Regular security audits

---

*Last updated: 2025-01-28*
