import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function hasFollowUpRequestedTag(tags) {
  if (!tags) return false;

  const normalizedTags = Array.isArray(tags)
    ? tags
    : String(tags).split(",");

  return normalizedTags
    .map((tag) => String(tag).trim().toLowerCase())
    .includes("follow-up-requested");
}

function cleanValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmailLike(value) {
  return typeof value === "string" && value.includes("@");
}

function shouldReplaceValue(value) {
  const cleaned = cleanValue(value);

  return (
    !cleaned ||
    cleaned === "Unknown" ||
    cleaned === "N/A" ||
    isEmailLike(cleaned)
  );
}

function getCustomerNameFromWebhook(payload) {
  const customerFirstName = cleanValue(payload.customer?.first_name);
  const customerLastName = cleanValue(payload.customer?.last_name);

  const customerName = [customerFirstName, customerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (customerName && !isEmailLike(customerName)) {
    return customerName;
  }

  const shippingFirstName = cleanValue(payload.shipping_address?.first_name);
  const shippingLastName = cleanValue(payload.shipping_address?.last_name);

  const shippingName = [shippingFirstName, shippingLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (shippingName && !isEmailLike(shippingName)) {
    return shippingName;
  }

  const billingFirstName = cleanValue(payload.billing_address?.first_name);
  const billingLastName = cleanValue(payload.billing_address?.last_name);

  const billingName = [billingFirstName, billingLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (billingName && !isEmailLike(billingName)) {
    return billingName;
  }

  const shippingFullName = cleanValue(payload.shipping_address?.name);
  if (shippingFullName && !isEmailLike(shippingFullName)) {
    return shippingFullName;
  }

  const billingFullName = cleanValue(payload.billing_address?.name);
  if (billingFullName && !isEmailLike(billingFullName)) {
    return billingFullName;
  }

  return "Unknown";
}

export const action = async ({ request }) => {
  console.log("Webhook received for draft order update");

  try {
    const { payload, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const draftOrderId = String(payload.id);

    console.log("Draft order updated:", draftOrderId);

    const hasFollowUpTag = hasFollowUpRequestedTag(payload.tags);

    if (!hasFollowUpTag) {
      console.log("No follow-up tag found, skipping draft order:", draftOrderId);
      return new Response(null, { status: 200 });
    }

    const customerName = getCustomerNameFromWebhook(payload);

    console.log("Webhook resolved customer name:", {
      draftOrderId,
      customerName,
      payloadCustomer: payload.customer,
      shippingAddress: payload.shipping_address,
      billingAddress: payload.billing_address,
    });

    const existingFollowUp = await prisma.followUp.findUnique({
      where: {
        shop_draftId: {
          shop,
          draftId: draftOrderId,
        },
      },
    });

    if (existingFollowUp) {
      console.log("Existing follow-up found. Updating missing customer details:", {
        id: existingFollowUp.id,
        oldCustomer: existingFollowUp.customer,
        newCustomer: customerName,
      });

      const updatedFollowUp = await prisma.followUp.update({
        where: {
          id: existingFollowUp.id,
        },
        data: {
          orderName: shouldReplaceValue(existingFollowUp.orderName)
            ? payload.name || undefined
            : existingFollowUp.orderName,

          email: shouldReplaceValue(existingFollowUp.email)
            ? payload.email || payload.customer?.email || undefined
            : existingFollowUp.email,

          phone: shouldReplaceValue(existingFollowUp.phone)
            ? payload.phone ||
              payload.customer?.phone ||
              payload.shipping_address?.phone ||
              payload.billing_address?.phone ||
              undefined
            : existingFollowUp.phone,

          customer: shouldReplaceValue(existingFollowUp.customer)
            ? customerName
            : existingFollowUp.customer,

          total: shouldReplaceValue(existingFollowUp.total)
            ? payload.total_price || undefined
            : existingFollowUp.total,
        },
      });

      console.log("Follow-up updated from webhook:", updatedFollowUp);

      return new Response(null, { status: 200 });
    }

    const followUp = await prisma.followUp.create({
      data: {
        shop,
        draftId: draftOrderId,
        orderName: payload.name || "N/A",
        email: payload.email || payload.customer?.email || "N/A",
        phone:
          payload.phone ||
          payload.customer?.phone ||
          payload.shipping_address?.phone ||
          payload.billing_address?.phone ||
          "N/A",
        customer: customerName,
        total: payload.total_price || "0",
        status: "new",
      },
    });

    console.log("Follow-up created from webhook:", followUp);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error processing draft order webhook:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};