import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://extensions.shopifycdn.com",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function getNumericDraftOrderId(draftGid) {
  if (!draftGid) return null;

  const value = String(draftGid);
  const match = value.match(/\/(\d+)$/);

  return match ? match[1] : value;
}

function isEmailLike(value) {
  return typeof value === "string" && value.includes("@");
}

function shouldReplaceValue(value) {
  return (
    !value ||
    String(value).trim() === "" ||
    value === "Unknown" ||
    value === "N/A" ||
    isEmailLike(value)
  );
}

export async function loader() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405
    );
  }

  let auth;
  let session;

  try {
    auth = await authenticate.admin(request);
    session = auth.session;
  } catch (err) {
    console.error("Follow-up auth failed:", err?.message);

    return jsonResponse(
      {
        success: false,
        error: "Authentication failed",
      },
      401
    );
  }

  console.log("=== API Follow-Up Route Hit ===");

  try {
    const body = await request.json();
    const { draftGid, tags } = body;

    console.log("Session shop:", session?.shop);
    console.log("draftGid:", draftGid);

    if (!draftGid) {
      return jsonResponse(
        {
          success: false,
          error: "draftGid is required",
        },
        400
      );
    }

    const shopDomain = session?.shop;

    if (!shopDomain) {
      return jsonResponse(
        {
          success: false,
          error: "Shop domain not found in session",
        },
        401
      );
    }

    const tagList = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [];

    if (!tagList.includes("follow-up-requested")) {
      console.error("Tag validation failed:", tagList);

      return jsonResponse(
        {
          success: false,
          error: "Draft order must include follow-up-requested tag to create a follow-up",
        },
        400
      );
    }

    const numericDraftId = getNumericDraftOrderId(draftGid);

    console.log("Numeric draftId extracted:", numericDraftId);

    const existingFollowUp = await prisma.followUp.findUnique({
      where: {
        shop_draftId: {
          shop: shopDomain,
          draftId: numericDraftId,
        },
      },
    });

    if (existingFollowUp) {
      console.log("Follow-up already exists, updating missing details:", {
        id: existingFollowUp.id,
        shop: shopDomain,
        draftId: numericDraftId,
      });

      const updatedFollowUp = await prisma.followUp.update({
        where: {
          id: existingFollowUp.id,
        },
        data: {
          orderName: shouldReplaceValue(existingFollowUp.orderName)
            ? body.orderName || undefined
            : existingFollowUp.orderName,

          email: shouldReplaceValue(existingFollowUp.email)
            ? body.email || undefined
            : existingFollowUp.email,

          customer: shouldReplaceValue(existingFollowUp.customer)
            ? body.customer || undefined
            : existingFollowUp.customer,

          phone: shouldReplaceValue(existingFollowUp.phone)
            ? body.phone || undefined
            : existingFollowUp.phone,

          total: shouldReplaceValue(existingFollowUp.total)
            ? body.total || undefined
            : existingFollowUp.total,
        },
      });

      return jsonResponse({
        success: true,
        duplicate: true,
        message: "Follow-up already exists for this draft order. Missing details were updated.",
        followUp: updatedFollowUp,
      });
    }
    const followUp = await prisma.followUp.create({
      data: {
        shop: shopDomain,
        draftId: numericDraftId,
        orderName: body.orderName || undefined,
        email: body.email || undefined,
        customer: body.customer || undefined,
        phone: body.phone || undefined,
        total: body.total || undefined,
        status: "new",
      },
    });

    console.log("Follow-up created successfully:", {
      id: followUp.id,
      shop: followUp.shop,
      draftId: followUp.draftId,
      createdAt: followUp.createdAt,
    });

    return jsonResponse({
      success: true,
      duplicate: false,
      followUp,
    });
  } catch (error) {
    console.error("=== Error creating follow-up ===", {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });

    return jsonResponse(
      {
        success: false,
        error: error?.message || "Unknown error",
        code: error?.code,
      },
      500
    );
  }
}