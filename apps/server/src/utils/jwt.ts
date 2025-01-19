import {
  sign as jwtSign,
  verify as jwtVerify,
} from "@tsndr/cloudflare-worker-jwt";

interface JWTPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function sign(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await jwtSign(
    {
      ...payload,
      iat: now,
      exp: now + 60 * 24 * 60 * 60, // 60 days
    },
    secret,
  );
}

export async function verify(
  token: string,
  secret: string,
): Promise<JWTPayload> {
  const isValid = await jwtVerify(token, secret);
  if (!isValid) {
    throw new Error("Invalid token");
  }

  // Decode payload
  const [, payloadB64] = token.split(".");
  const payload = JSON.parse(atob(payloadB64));

  return payload as JWTPayload;
}
