import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ????????? Obter token de acesso Microsoft Graph ????????????????????????????????????????????????????????????????????????????????????????????????????????????
async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Erro ao obter token Azure: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ????????? Obter site ID do SharePoint ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
async function getSiteId(token: string, siteUrl: string): Promise<string> {
  // Extrair host e path do site URL
  const url = new URL(siteUrl);
  const host = url.hostname;
  const sitePath = url.pathname.replace(/^\/sites\//, "").split("?")[0];

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${host}:/sites/${sitePath}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  if (!data.id) throw new Error(`Site n??o encontrado: ${JSON.stringify(data)}`);
  return data.id;
}

// ????????? Obter ou criar pasta no SharePoint ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
async function getOrCreateFolder(token: string, siteId: string, folderPath: string): Promise<string> {
  // Garantir pasta raiz "Documentos"
  const rootCheck = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Documentos`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (rootCheck.status === 404) {
    await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Documentos", folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
      },
    );
  }

  // Criar pasta do cliente dentro de Documentos
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Documentos/${folderPath}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (res.status === 404) {
    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Documentos:/children`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderPath, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
      },
    );
    const data = await createRes.json();
    return data.id;
  }

  const data = await res.json();
  return data.id;
}

// ????????? Upload do arquivo para o SharePoint ???????????????????????????????????????????????????????????????????????????????????????????????????????????????
async function uploadFile(
  token: string,
  siteId: string,
  folderPath: string,
  fileName: string,
  fileContent: ArrayBuffer,
): Promise<string> {
  // Upload simples (at?? 4MB) via PUT
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Documentos/${folderPath}/${fileName}:/content`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileContent,
  });

  const data = await res.json();
  if (!data.id) throw new Error(`Erro no upload: ${JSON.stringify(data)}`);

  // Retornar URL de compartilhamento
  return data.webUrl || data["@content.downloadUrl"] || "";
}

// ????????? HANDLER PRINCIPAL ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar configura????es SharePoint
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["sharepoint_ativo", "sharepoint_tenant_id", "sharepoint_client_id", "sharepoint_client_secret", "sharepoint_site_url"]);

    const s: Record<string, string> = {};
    (settings || []).forEach((r: any) => { s[r.key] = r.value; });

    if (s.sharepoint_ativo !== "true") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "SharePoint desativado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId     = s.sharepoint_tenant_id?.trim();
    const clientId     = s.sharepoint_client_id?.trim();
    const clientSecret = s.sharepoint_client_secret?.trim();
    const siteUrl      = s.sharepoint_site_url?.trim();

    if (!tenantId || !clientId || !clientSecret || !siteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais SharePoint n??o configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verificar se ?? teste de conex??o
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.action === "test") {
        // Testar apenas autentica????o Azure + acesso ao site
        const token  = await getAccessToken(tenantId, clientId, clientSecret);
        const siteId = await getSiteId(token, siteUrl);
        return new Response(
          JSON.stringify({ success: true, site_id: siteId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Receber multipart/form-data: file + cronograma_item_id + codigo_cliente + nome_cliente + codigo_item + descricao_item
    const formData = await req.formData();
    const file             = formData.get("file") as File | null;
    const cronogramaItemId = formData.get("cronograma_item_id") as string;
    const codigoCliente    = formData.get("codigo_cliente") as string;
    const nomeCliente      = formData.get("nome_cliente") as string;
    const codigoItem       = formData.get("codigo_item") as string;
    const descricaoItem    = formData.get("descricao_item") as string;

    if (!file || !cronogramaItemId || !codigoCliente) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigat??rios: file, cronograma_item_id, codigo_cliente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Montar nome do arquivo e pasta
    const ext        = file.name.split(".").pop() || "bin";
    const fileName   = `${codigoItem} - ${descricaoItem}.${ext}`.replace(/[/\?%*:|"<>]/g, "_");
    const folderName = `${codigoCliente} - ${nomeCliente}`.replace(/[/\?%*:|"<>]/g, "_");

    // Autenticar e fazer upload
    const token      = await getAccessToken(tenantId, clientId, clientSecret);
    const siteId     = await getSiteId(token, siteUrl);
    await getOrCreateFolder(token, siteId, folderName);
    const fileBuffer = await file.arrayBuffer();
    const fileUrl    = await uploadFile(token, siteId, folderName, fileName, fileBuffer);

    // Atualizar cronograma_item no banco
    await supabase
      .from("cronograma_itens")
      .update({
        doc_satisfeito:    true,
        doc_satisfeito_em: new Date().toISOString(),
        doc_referencia:    fileUrl,
      })
      .eq("id", cronogramaItemId);

    // Atualizar sharepoint_pasta_url no projeto
    const { data: ciRow } = await supabase
      .from("cronograma_itens")
      .select("atividade_id")
      .eq("id", cronogramaItemId)
      .single();

    if (ciRow?.atividade_id) {
      const { data: atvRow } = await supabase
        .from("projeto_atividades")
        .select("projeto_id")
        .eq("id", ciRow.atividade_id)
        .single();

      if (atvRow?.projeto_id) {
        const pastaUrl = `${siteUrl}/Shared%20Documents/Documentos/${encodeURIComponent(folderName)}`;
        await supabase
          .from("projetos")
          .update({ sharepoint_pasta_url: pastaUrl })
          .eq("id", atvRow.projeto_id);
        console.log(`sharepoint_pasta_url atualizado: ${pastaUrl}`);
      }
    }

    console.log(`Documento enviado: ${folderName}/${fileName} — ${fileUrl}`);

    return new Response(
      JSON.stringify({ success: true, file_url: fileUrl, file_name: fileName, folder: folderName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err: any) {
    console.error("sharepoint-upload error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
