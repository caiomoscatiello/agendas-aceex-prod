import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: params,
    });

    if (error) {
      return { success: false, error: error.message || "Erro ao chamar serviço de email" };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Erro desconhecido" };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    return { success: false, error: message };
  }
}

export function useEmailSender() {
  return { sendEmail };
}
