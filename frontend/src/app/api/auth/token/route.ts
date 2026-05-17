import { NextRequest, NextResponse } from "next/server";
import { encode, getToken } from "next-auth/jwt";

export async function GET(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTH_SECRET not configured" }, { status: 500 });
  }
  const token = await getToken({ req, secret, salt: "" });
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const jwt = await encode({ token, secret, salt: "" });
  return NextResponse.json({ token: jwt });
}
