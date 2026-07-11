import ownerTemplate from "../../emails/thinkgreen-owner-email.html";
import clientTemplate from "../../emails/thinkgreen-client-email.html";
import { handleLeadRequest } from "../../lib/landscape-lead-handler.mjs";

export function onRequest(context) {
  return handleLeadRequest({
    request: context.request,
    env: context.env,
    ownerTemplate,
    clientTemplate
  });
}
