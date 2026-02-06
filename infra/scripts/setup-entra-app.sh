#!/bin/bash
# Setup Azure Entra ID (Azure AD) app registration for Personal Memory MCP Server
# This script creates the app registration that enables OAuth authentication

set -e

APP_NAME="Personal Memory MCP Server"
REPLY_URLS=(
  "https://oauth.pstmn.io/v1/callback"          # Postman callback for testing
  "https://claude.ai/api/mcp/auth_callback"      # Claude.ai callback
  "https://claude.com/api/mcp/auth_callback"     # Claude.com callback
)

echo "Creating Entra ID app registration: $APP_NAME"

# Create app registration
APP_RESULT=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "${REPLY_URLS[@]}" \
  --enable-id-token-issuance true \
  --enable-access-token-issuance true \
  --output json)

APP_ID=$(echo "$APP_RESULT" | jq -r '.appId')
OBJECT_ID=$(echo "$APP_RESULT" | jq -r '.id')

echo "App ID (Client ID): $APP_ID"
echo "Object ID: $OBJECT_ID"

# Create API scopes
echo "Creating API scopes..."
API_SCOPE_ID=$(uuidgen || cat /proc/sys/kernel/random/uuid)
az ad app update \
  --id "$OBJECT_ID" \
  --set api="{\"oauth2PermissionScopes\":[{\"adminConsentDescription\":\"Read profile\",\"adminConsentDisplayName\":\"mcp.profile.read\",\"id\":\"$API_SCOPE_ID\",\"isEnabled\":true,\"type\":\"User\",\"userConsentDescription\":\"Read your profile\",\"userConsentDisplayName\":\"Read profile\",\"value\":\"mcp.profile.read\"}]}"

# Create service principal
echo "Creating service principal..."
az ad sp create --id "$APP_ID"

# Create client secret
echo "Creating client secret..."
SECRET_RESULT=$(az ad app credential reset \
  --id "$APP_ID" \
  --display-name "personal-memory-secret" \
  --years 2 \
  --output json)

CLIENT_SECRET=$(echo "$SECRET_RESULT" | jq -r '.password')

# Get tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
echo "=============================================="
echo "Entra ID App Registration Complete!"
echo "=============================================="
echo ""
echo "Add these values to your deployment parameters:"
echo ""
echo "ENTRA_TENANT_ID=$TENANT_ID"
echo "ENTRA_CLIENT_ID=$APP_ID"
echo "ENTRA_CLIENT_SECRET=$CLIENT_SECRET"
echo ""
echo "Save the client secret securely - it won't be shown again!"
echo ""
echo "OAuth endpoints:"
echo "Authorization: https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/authorize"
echo "Token: https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token"
echo ""
echo "Scopes: api://$APP_ID/mcp.profile.read"
echo ""
echo "Next steps:"
echo "1. Update infra/main.bicepparam with the values above"
echo "2. Deploy infrastructure: az deployment group create ..."
