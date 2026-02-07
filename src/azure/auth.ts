/**
 * OAuth token verification for Azure Entra ID.
 * Verifies JWT tokens issued by Entra ID and extracts user identity.
 */

import * as jose from "jose";

export interface TokenClaims {
  oid: string; // Object ID (user ID) - unique per user in tenant
  sub: string; // Subject
  aud: string; // Audience (client ID or API identifier)
  iss: string; // Issuer
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  tid: string; // Tenant ID
  name?: string; // User's display name
  preferred_username?: string; // User's email/UPN
}

// Cache JWKS for performance
let jwksCache: jose.JWTVerifyGetKey | null = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get Entra ID configuration from environment variables.
 */
function getEntraConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    throw new Error(
      "ENTRA_TENANT_ID and ENTRA_CLIENT_ID environment variables are required"
    );
  }

  return { tenantId, clientId };
}

/**
 * Get JWKS (JSON Web Key Set) for token verification.
 * Uses Entra ID's OpenID Connect discovery endpoint.
 */
async function getJWKS(tenantId: string): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now();

  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  // Entra ID JWKS endpoint
  const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;

  jwksCache = jose.createRemoteJWKSet(new URL(jwksUri));
  jwksCacheExpiry = now + JWKS_CACHE_TTL_MS;

  return jwksCache;
}

/**
 * Verify an OAuth token from Azure Entra ID.
 * @param token - The JWT access token
 * @returns Verified token claims
 * @throws If the token is invalid, expired, or from wrong issuer/audience
 */
export async function verifyToken(token: string): Promise<TokenClaims> {
  const { tenantId, clientId } = getEntraConfig();
  const jwks = await getJWKS(tenantId);

  // Valid issuers for Entra ID tokens
  const validIssuers = [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`,
  ];

  try {
    const { payload } = await jose.jwtVerify(token, jwks, {
      audience: [clientId, `api://${clientId}`],
      issuer: validIssuers,
    });

    // Validate required claims
    if (!payload.oid || typeof payload.oid !== "string") {
      throw new Error("Token missing required claim: oid");
    }

    return {
      oid: payload.oid as string,
      sub: payload.sub as string,
      aud: payload.aud as string,
      iss: payload.iss as string,
      tid: (payload.tid as string) || tenantId,
      exp: payload.exp as number,
      iat: payload.iat as number,
      name: payload.name as string | undefined,
      preferred_username: payload.preferred_username as string | undefined,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error("Token has expired");
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
    if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      throw new Error("Token signature verification failed");
    }
    throw error;
  }
}

/**
 * Extract user ID from token claims.
 * Uses the 'oid' (object ID) claim which is unique per user in Entra ID.
 */
export function extractUserId(claims: TokenClaims): string {
  return claims.oid;
}
