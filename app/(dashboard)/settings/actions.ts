"use server";

import { createClient } from "@/lib/supabase/server";

export type PasswordChangeState = {
  error: string | null;
  success: boolean;
};

export async function changePasswordAction(
  prevState: PasswordChangeState,
  formData: FormData
): Promise<PasswordChangeState> {
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  if (newPassword.length > 128) {
    return { error: "Password must be 128 characters or fewer.", success: false };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match.", success: false };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    if (error.message.includes("<!DOCTYPE") || error.message.includes("not valid JSON")) {
      return { error: "Unable to reach the authentication server. Please check your configuration.", success: false };
    }
    return { error: error.message, success: false };
  }

  return { error: null, success: true };
}
