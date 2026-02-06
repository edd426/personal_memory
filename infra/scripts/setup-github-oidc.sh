#!/bin/bash
# Setup GitHub OIDC federation for Azure deployment
# This enables GitHub Actions to deploy to Azure without storing secrets

set -e

# Configuration - update these values
GITHUB_ORG="edd426"
GITHUB_REPO="personal_memory"
AZURE_SUBSCRIPTION_ID="bcdbd425-4090-46c3-95a4-41d381ab08c5"  # Get from: az account show --query id -o tsv
RESOURCE_GROUP="rg-personal-memory-prod"

# Validate inputs
if [ -z "$AZURE_SUBSCRIPTION_ID" ]; then
  echo "Getting subscription ID..."
  AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
fi

if [ "$GITHUB_ORG" = "YOUR_GITHUB_USERNAME_OR_ORG" ]; then
  echo "Error: Please set GITHUB_ORG in this script"
  exit 1
fi

APP_NAME="github-actions-$GITHUB_REPO"

echo "Setting up GitHub OIDC for: $GITHUB_ORG/$GITHUB_REPO"
echo "Subscription: $AZURE_SUBSCRIPTION_ID"

# Create app registration for GitHub Actions
echo "Creating Entra ID app for GitHub Actions..."
APP_RESULT=$(az ad app create \
  --display-name "$APP_NAME" \
  --output json)

APP_ID=$(echo "$APP_RESULT" | jq -r '.appId')
OBJECT_ID=$(echo "$APP_RESULT" | jq -r '.id')

echo "App ID (Client ID): $APP_ID"

# Create service principal
echo "Creating service principal..."
SP_RESULT=$(az ad sp create --id "$APP_ID" --output json)
SP_OBJECT_ID=$(echo "$SP_RESULT" | jq -r '.id')

# Create federated credential for main branch
echo "Creating federated credential for main branch..."
az ad app federated-credential create \
  --id "$OBJECT_ID" \
  --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$GITHUB_ORG/$GITHUB_REPO:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"],
    \"description\": \"GitHub Actions deployment from main branch\"
  }"

# Create resource group if it doesn't exist
echo "Ensuring resource group exists..."
az group create --name "$RESOURCE_GROUP" --location eastus --output none 2>/dev/null || true

# Assign Contributor role on resource group
echo "Assigning Contributor role to resource group..."
az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"

# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
echo "=============================================="
echo "GitHub OIDC Setup Complete!"
echo "=============================================="
echo ""
echo "Add these as GitHub repository variables (Settings > Secrets and variables > Actions > Variables):"
echo ""
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=$AZURE_SUBSCRIPTION_ID"
echo ""
echo "Also add ENTRA_TENANT_ID and ENTRA_CLIENT_ID from your app registration."
echo ""
echo "Add as GitHub repository secret:"
echo "ENTRA_CLIENT_SECRET=<your client secret from setup-entra-app.sh>"
echo ""
echo "Test the setup by running the workflow manually or pushing to main."
