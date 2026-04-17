import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
//versão 1.16
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API = "https://api.autentique.com.br/2/graphql";

// ─── Chamar API Autentique (JSON) ─────────────────────────────────────────────
async function gql(apiKey: string, query: string, variables?: any) {
  const res = await fetch(AUTENTIQUE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  return await res.json();
}

// ─── Obter ou criar pasta do cliente no Autentique ────────────────────────────
async function getOrCreateFolder(
  apiKey: string,
  supabase: any,
  projetoId: string,
  codigoCliente: string,
  nomeCliente: string,
): Promise<{ folder_id: string; folder_url: string }> {
  // Verificar se projeto já tem pasta
  const { data: proj } = await supabase
    .from("projetos")
    .select("autentique_folder_id, autentique_folder_url")
    .eq("id", projetoId)
    .single();

  if (proj?.autentique_folder_id) {
    return { folder_id: proj.autentique_folder_id, folder_url: proj.autentique_folder_url || "" };
  }

  // Criar pasta no Autentique
  const folderName = `${codigoCliente} - ${nomeCliente}`;
  const result = await gql(
    apiKey,
    `
    mutation CreateFolder($folder: FolderInput!) {
      createFolder(folder: $folder) { id name }
    }
  `,
    { folder: { name: folderName } },
  );

  const folderId = result?.data?.createFolder?.id;
  const folderUrl = folderId ? `https://painel.autentique.com.br/pasta/${folderId}` : "";

  if (!folderId) throw new Error(`Erro ao criar pasta Autentique: ${JSON.stringify(result)}`);

  // Salvar no banco
  await supabase
    .from("projetos")
    .update({ autentique_folder_id: folderId, autentique_folder_url: folderUrl })
    .eq("id", projetoId);

  console.log(`Pasta Autentique criada: ${folderName} (${folderId})`);
  return { folder_id: folderId, folder_url: folderUrl };
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Buscar chave API Autentique
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "autentique_api_key")
      .maybeSingle();

    const apiKey = settingRow?.value?.trim();
    if (!apiKey) throw new Error("autentique_api_key não configurada em app_settings");

    const body = await req.json();
    const { agenda_id, cronograma_item_id } = body;

    if (!agenda_id && !cronograma_item_id) throw new Error("agenda_id ou cronograma_item_id obrigatório");

    // Buscar dados da agenda e consultor
    let ciId = cronograma_item_id;
    let agendaEmail = "";
    let agendaConsultor = "";

    if (agenda_id) {
      const { data: agenda } = await supabase
        .from("agendas")
        .select("id, item_cronograma")
        .eq("id", agenda_id)
        .single();

      if (!agenda) throw new Error("Agenda não encontrada");

      // Buscar perfil do consultor
      const { data: agendaFull } = await supabase.from("agendas").select("user_id").eq("id", agenda_id).single();

      if (agendaFull?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("user_id", agendaFull.user_id)
          .single();
        agendaEmail = profile?.email || "";
        agendaConsultor = profile?.name || "";
      }

      if (agenda.item_cronograma && !ciId) {
        const codigoItem = agenda.item_cronograma.split(" - ")[0].trim();
        const { data: ci } = await supabase
          .from("cronograma_itens")
          .select("id")
          .ilike("codigo", codigoItem)
          .maybeSingle();
        if (ci) ciId = ci.id;
      }
    }

    // Buscar cronograma_item
    const { data: ci } = await supabase
      .from("cronograma_itens")
      .select("id, codigo, descricao, doc_referencia, autentique_envelope_id, atividade_id")
      .eq("id", ciId)
      .single();

    if (!ci) throw new Error("Item de cronograma não encontrado");
    if (!ci.doc_referencia) throw new Error("Documento não enviado ao SharePoint. Faça o upload primeiro.");
    if (ci.autentique_envelope_id) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "Já enviado ao Autentique",
          envelope_id: ci.autentique_envelope_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar projeto
    const { data: atv } = await supabase
      .from("projeto_atividades")
      .select("projeto_id")
      .eq("id", ci.atividade_id)
      .single();

    const { data: projeto } = await supabase
      .from("projetos")
      .select("id, nome_cliente, codigo_cliente, coordenador_id, email_contato, contato_nome")
      .eq("id", atv?.projeto_id)
      .single();

    if (!projeto) throw new Error("Projeto não encontrado");

    // Buscar coordenador do projeto
    const { data: coordProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", projeto.coordenador_id)
      .single();

    if (!coordProfile?.email) throw new Error("Email do coordenador não encontrado");

    // Obter ou criar pasta do cliente no Autentique
    const { folder_id } = await getOrCreateFolder(
      apiKey,
      supabase,
      projeto.id,
      projeto.codigo_cliente,
      projeto.nome_cliente,
    );

    // Baixar documento do SharePoint via Microsoft Graph (autenticado)
    // Buscar credenciais SharePoint
    const { data: spSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["sharepoint_tenant_id", "sharepoint_client_id", "sharepoint_client_secret", "sharepoint_site_url"]);

    const sp: Record<string, string> = {};
    (spSettings || []).forEach((r: any) => {
      sp[r.key] = r.value;
    });

    // Obter token Azure
    const tokenRes = await fetch(`https://login.microsoftonline.com/${sp.sharepoint_tenant_id}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: sp.sharepoint_client_id,
        client_secret: sp.sharepoint_client_secret,
        scope: "https://graph.microsoft.com/.default",
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(`Erro ao obter token Azure: ${JSON.stringify(tokenData)}`);

    // Extrair caminho relativo da URL do SharePoint
    // URL formato: https://aceexcombr.sharepoint.com/sites/projeto/Shared%20Documents/Documentos/...
    const fileUrl = new URL(ci.doc_referencia);
    const siteUrl = new URL(sp.sharepoint_site_url);
    const relativePath = decodeURIComponent(fileUrl.pathname.replace(siteUrl.pathname, "").replace(/^\//, ""));
    const fileName = relativePath.split("/").pop() || `${ci.codigo}.pdf`;

    // Buscar site ID via Graph API
    const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteUrl.hostname}:${siteUrl.pathname}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!siteRes.ok) {
      const errText = await siteRes.text();
      throw new Error(`Erro ao buscar site SharePoint: ${siteRes.status} — ${errText.slice(0, 300)}`);
    }
    const siteData = await siteRes.json();
    const siteId = siteData.id;
    if (!siteId) throw new Error("Site ID não encontrado na resposta do Graph API");

    // Buscar drive padrão do site
    const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!driveRes.ok) {
      const errText = await driveRes.text();
      throw new Error(`Erro ao buscar drive do site: ${driveRes.status} — ${errText.slice(0, 300)}`);
    }
    const driveData = await driveRes.json();
    const driveId = driveData.id;
    if (!driveId) throw new Error("Drive ID não encontrado");

    // Buscar metadata do arquivo pelo caminho relativo
    // relativePath ex: "Shared Documents/Documentos/000449 - WDM/X07 - teste doc.pdf"
    const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
    const metaRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Erro ao buscar metadata do arquivo: ${metaRes.status} — ${errText.slice(0, 300)}`);
    }
    const metaData = await metaRes.json();
    const preSignedUrl = metaData["@microsoft.graph.downloadUrl"];
    if (!preSignedUrl) throw new Error("downloadUrl não disponível no metadata");

    const downloadRes = await fetch(preSignedUrl);
    if (!downloadRes.ok) throw new Error(`Erro ao baixar documento: ${downloadRes.status}`);
    const fileBuffer = await downloadRes.arrayBuffer();

    // Montar signatários
    const signers: { email: string; name: string }[] = [{ email: coordProfile.email, name: coordProfile.name }];
    if (agendaEmail) signers.push({ email: agendaEmail, name: agendaConsultor || "Consultor" });
    if (projeto.email_contato)
      signers.push({ email: projeto.email_contato, name: projeto.contato_nome || "Coordenador Cliente" });

    // Mutation GraphQL multipart
    const mutation = `
      mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(document: $document, signers: $signers, file: $file, folder_id: "${folder_id}") {
          id name created_at
          signatures { public_id name email link { short_link } action { name } }
        }
      }
    `;

    const variables = {
      document: {
        name: `${ci.codigo} - ${ci.descricao || "Documento"} — ${projeto.nome_cliente}`,
        refusable: true,
        sortable: false,
      },
      signers: signers.map((s) => ({
        email: s.email,
        name: s.name,
        action: { name: "SIGN" },
      })),
    };

    const form = new FormData();
    form.append("operations", JSON.stringify({ query: mutation, variables: { ...variables, file: null } }));
    form.append("map", JSON.stringify({ "0": ["variables.file"] }));
    form.append("0", new Blob([fileBuffer]), fileName);

    const result = await fetch(AUTENTIQUE_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }).then((r) => r.json());

    if (result.errors) throw new Error(`Autentique API error: ${JSON.stringify(result.errors)}`);

    const doc = result.data?.createDocument;
    if (!doc?.id) throw new Error("Documento não criado no Autentique");

    // Salvar envelope_id no banco
    await supabase
      .from("cronograma_itens")
      .update({ autentique_envelope_id: doc.id, autentique_status: "pending" })
      .eq("id", ci.id);

    // Log
    await supabase.from("integration_logs").insert({
      codigo: "AUTENTIQUE-SEND",
      status: "success",
      message: `Documento enviado: ${doc.name} — ${signers.length} signatário(s) — pasta: ${projeto.codigo_cliente} - ${projeto.nome_cliente}`,
      http_status: 200,
      payload: {
        envelope_id: doc.id,
        folder_id,
        documento: doc.name,
        signatarios: signers.map((s) => s.email),
        links: doc.signatures?.map((s: any) => ({ email: s.email, link: s.link?.short_link })),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        envelope_id: doc.id,
        folder_id,
        documento: doc.name,
        signatarios: signers.length,
        links: doc.signatures?.map((s: any) => ({ email: s.email, link: s.link?.short_link })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("autentique-send error:", err);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("integration_logs").insert({
        codigo: "AUTENTIQUE-SEND",
        status: "error",
        message: err.message,
        http_status: 500,
        payload: { error: err.message },
      });
    } catch {}
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});