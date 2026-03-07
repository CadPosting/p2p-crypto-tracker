"use server";

/**
 * Server Actions for login.
 *
 * Why server actions instead of client-side auth?
 * In Next.js 15+, the session cookie must be set SERVER-SIDE for the
 * middleware to see it. Client-side signInWithPassword sets the cookie
 * in the browser, but there is a race condition before the middleware
 * can read it. Using a server action fixes this completely — the cookie
 * is set as part of the server response, so it's immediately available.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthState = {
  error: string | null;
};

export async function loginAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  // redirect() throws internally — this is expected Next.js behaviour
  redirect("/");
}
