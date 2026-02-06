using './main.bicep'

// Production parameters
// To deploy: az deployment group create --resource-group rg-personal-memory-prod --template-file main.bicep --parameters main.bicepparam

param environment = 'prod'

// Entra ID configuration
param entraIdTenantId = 'b3cd2a14-99f1-4d5b-9667-58b84b2083c0'
param entraIdClientId = 'bb2048d4-27de-4bf6-a13b-6bf1739e68b6'

// Client secret must be passed at deployment time (never commit secrets!)
// az deployment group create ... --parameters entraIdClientSecret=$ENTRA_CLIENT_SECRET
param entraIdClientSecret = ''
