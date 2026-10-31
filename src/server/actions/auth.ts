"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** callbackUrl solo puede ser una ruta interna (evita open redirects). */
function safeCallback(url: unknown): string {
  const value = typeof url === "string" ? url : "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallback(formData.get("callbackUrl")) });
}

export async function signInDev(formData: FormData) {
  await signIn("dev", {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    redirectTo: safeCallback(formData.get("callbackUrl")),
  });
}
