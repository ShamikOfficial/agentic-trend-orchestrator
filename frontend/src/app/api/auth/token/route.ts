import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getToken } from "next-auth/jwt";

function authSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    return null;
  }
  return new TextEncoder().encode(secret);
}

function backendIssuer(): string | undefined {
  const raw = process.env.AUTH_URL?.trim().replace(/\/$/, "");
  return raw || undefined;
}

/** HS256 JWT for FastAPI — plain claims PyJWT can verify (not Auth.js cookie encoding). */
export async function GET(req: NextRequest) {
  const key = authSecretKey();
  if (!key) {
    return NextResponse.json({ error: "AUTH_SECRET not configured" }, { status: 500 });
  }

  const session = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const provider = typeof session.provider === "string" ? session.provider : "";
  const providerAccountId =
    typeof session.providerAccountId === "string" ? session.providerAccountId : "";
  const email = typeof session.email === "string" ? session.email : undefined;
  const name = typeof session.name === "string" ? session.name : undefined;

  if (!provider || !providerAccountId) {
    return NextResponse.json(
      { error: "OAuth session missing provider identity. Sign out and sign in again." },
      { status: 401 },
    );
  }

  let builder = new SignJWT({
    email,
    name,
    provider,
    providerAccountId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(providerAccountId)
    .setIssuedAt()
    .setExpirationTime("24h");

  const issuer = backendIssuer();
  if (issuer) {
    builder = builder.setIssuer(issuer);
  }

  const token = await builder.sign(key);
  return NextResponse.json({ token });
}
