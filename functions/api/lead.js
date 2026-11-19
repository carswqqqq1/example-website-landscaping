import ownerTemplate from "../../emails/lead-owner-email.html";
import clientTemplate from "../../emails/lead-client-email.html";
import { handleLeadRequest } from "../../lib/landscape-lead-handler.mjs";
import siteConfig from "../../site-config.js";

export function onRequest(context) {
  return handleLeadRequest({
    request: context.request,
    env: context.env,
    ownerTemplate,
    clientTemplate,
    defaultEmailLogoUrl: siteConfig && siteConfig.emailLogoUrl,
    siteConfig
  });
}
