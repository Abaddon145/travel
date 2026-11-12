import { mapFrameDocument, mapFrameDocumentMarker } from "../../shared/map-frame";
import { applySecurityHeaders } from "../security-headers";

function denied(status: number, message: string) {
  return applySecurityHeaders(
    new Response(message, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

export async function handleMapFrameDocument(
  request: Request,
  fetchAsset: (request: Request) => Promise<Response>,
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return denied(405, "方法不允许");
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = mapFrameDocument;
  assetUrl.search = "";
  const asset = await fetchAsset(new Request(assetUrl, { method: "GET" }));
  const html = await asset.text();
  if (!asset.ok || !mapFrameDocumentMarker(html)) {
    return denied(404, "没有这个页面");
  }
  return applySecurityHeaders(
    new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
      },
    }),
    { framing: "shell" },
  );
}
