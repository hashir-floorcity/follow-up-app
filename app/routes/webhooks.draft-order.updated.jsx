import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function hasFollowUpRequestedTag(tags) {
  if (!tags) return false;

  const normalizedTags = Array.isArray(tags)
    ? tags
    : String(tags).split(",");

  return normalizedTags
    .map(tag => String(tag).trim().toLowerCase())
    .includes("follow-up-requested");
}

export const action = async ({ request }) => {
  console.log("Webhook received for draft order update");

  try {
    const { payload, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const draftOrderId = payload.id;
    const draftGid = `gid://shopify/DraftOrder/${draftOrderId}`;
    console.log("Draft order updated:", draftOrderId);

    const hasFollowUpTag = hasFollowUpRequestedTag(payload.tags);

    if (!hasFollowUpTag) {
      console.log("No follow-up tag found, skipping draft order:", draftOrderId);
      return new Response(null, { status: 200 });
    }

    console.log("Follow-up tag found, processing draft order:", draftOrderId);

    const existingFollowUp = await prisma.followUp.findFirst({
      where: {
        draftId: draftGid
      }
    });

    if (existingFollowUp) {
      console.log("Follow-up already exists for this draft order");
      return new Response(null, { status: 200 });
    }

    const followUp = await prisma.followUp.create({
      data: {
        draftId: draftGid,
        orderName: payload.name || "N/A",
        email: payload.email || "N/A",
        phone: payload.phone || payload.customer?.phone || "N/A",
        customer: payload.customer
          ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() || "Unknown"
          : "Unknown",
        total: payload.total_price || "0",
        status: "new"
      }
    });

    console.log("Follow-up created from webhook:", followUp);
    return new Response(null, { status: 200 });

  } catch (error) {
    console.error("Error processing draft order webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
