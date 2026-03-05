import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  console.log("Webhook received for draft order update");
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!session) {
    console.log("No session found for webhook");
    return new Response();
  }

  try {
    const draftOrderId = payload.id;
    const draftGid = `gid://shopify/DraftOrder/${draftOrderId}`;

    console.log("Draft order updated:", draftOrderId);

    const tags = payload.tags ? payload.tags.split(',').map(tag => tag.trim()) : [];
    const hasFollowUpTag = tags.includes('follow-up-requested');

    if (!hasFollowUpTag) {
      console.log("No follow-up tag found, skipping");
      return new Response();
    }

    const existingFollowUp = await prisma.followUp.findFirst({
      where: {
        draftId: draftGid
      }
    });

    if (!existingFollowUp) {
      const followUp = await prisma.followUp.create({
        data: {
          draftId: draftGid,
          email: payload.email || "N/A",
          customer: payload.customer
            ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim()
            : "Unknown",
          total: payload.total_price || "0",
          status: "new"
        }
      });

      console.log("Follow-up created from webhook:", followUp);
    } else {
      console.log("Follow-up already exists for this draft order");
    }

  } catch (error) {
    console.error("Error processing draft order webhook:", error);
  }

  return new Response();
};
