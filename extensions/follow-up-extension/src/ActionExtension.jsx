import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function cleanValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmailLike(value) {
  return typeof value === "string" && value.includes("@");
}

function isPhoneLike(value) {
  return typeof value === "string" && /^\+?\d[\d\s().-]+$/.test(value.trim());
}

function resolveCustomerName(draftOrder) {
  const customerFirstLast = [
    cleanValue(draftOrder.customer?.firstName),
    cleanValue(draftOrder.customer?.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const shippingFirstLast = [
    cleanValue(draftOrder.shippingAddress?.firstName),
    cleanValue(draftOrder.shippingAddress?.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const billingFirstLast = [
    cleanValue(draftOrder.billingAddress?.firstName),
    cleanValue(draftOrder.billingAddress?.lastName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const possibleNames = [
    customerFirstLast,
    cleanValue(draftOrder.customer?.displayName),
    cleanValue(draftOrder.shippingAddress?.name),
    shippingFirstLast,
    cleanValue(draftOrder.billingAddress?.name),
    billingFirstLast,
  ];

  const realName = possibleNames.find((name) => {
    if (!name) return false;
    if (isEmailLike(name)) return false;
    if (isPhoneLike(name)) return false;
    return true;
  });

  return realName || "Unknown";
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function Extension() {
  const { close, data } = shopify;

  console.log("Extension data:", data);
  console.log("Selected item:", data.selected?.[0]);

  const selectedDraft = /** @type {any} */ (data.selected?.[0]);
  const existingTags = normalizeTags(selectedDraft?.tags);

  console.log("Selected tags:", existingTags);

  const hasFollowUpTag = existingTags.includes("follow-up-requested");

  const sendFollowUp = () => {
    const selectedDraft = data.selected?.[0];
    const draftId = selectedDraft?.id;

    if (!draftId) {
      console.error("Missing draft order ID");
      close();
      return;
    }

    shopify
      .query(
        `query draftOrderDetails($id: ID!) {
          draftOrder(id: $id) {
            id
            name
            email
            phone
            totalPrice
            tags
            customer {
              firstName
              lastName
              displayName
              email
              phone
            }
            shippingAddress {
              firstName
              lastName
              name
              phone
            }
            billingAddress {
              firstName
              lastName
              name
              phone
            }
          }
        }`,
        { variables: { id: draftId } }
      )
      .then((queryResult) => {
        const queryData = /** @type {any} */ (queryResult).data;
        const draftOrder = queryData?.draftOrder;

        if (!draftOrder) {
          throw new Error("Draft order not found from Shopify query");
        }

        const currentTags = normalizeTags(draftOrder.tags);
        const hasCurrentFollowUpTag = currentTags.includes("follow-up-requested");

        const customerName = resolveCustomerName(draftOrder);

        console.log("Draft order customer debug:", {
          customer: draftOrder.customer,
          shippingAddress: draftOrder.shippingAddress,
          billingAddress: draftOrder.billingAddress,
          resolvedCustomerName: customerName,
        });

        const payload = {
          draftGid: draftOrder.id,
          orderName: draftOrder.name || "",
          email: draftOrder.email || draftOrder.customer?.email || "",
          customer: customerName,
          phone:
            draftOrder.phone ||
            draftOrder.customer?.phone ||
            draftOrder.shippingAddress?.phone ||
            draftOrder.billingAddress?.phone ||
            "",
          total: draftOrder.totalPrice ? String(draftOrder.totalPrice) : "",
          tags: hasCurrentFollowUpTag
            ? currentTags
            : [...currentTags, "follow-up-requested"],
        };

        console.log("Follow-up payload:", payload);

        const saveFollowUpToDatabase = async () => {
          const response = await fetch("/api/followup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await response.json().catch(() => ({}));

          return {
            type: "database",
            ok: response.ok,
            status: response.status,
            data,
          };
        };

        const addFollowUpTag = async () => {
          if (hasCurrentFollowUpTag) {
            console.log("Follow-up tag already exists. Skipping tagsAdd.");

            return {
              type: "tag",
              skipped: true,
              data: null,
              errors: [],
            };
          }

          const result = await shopify.query(
            `mutation addFollowUpTag($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
            {
              variables: {
                id: draftOrder.id,
                tags: ["follow-up-requested"],
              },
            }
          );

          const resultData = /** @type {any} */ (result.data);

          return {
            type: "tag",
            skipped: false,
            data: resultData,
            errors: result.errors || [],
          };
        };

        return Promise.allSettled([
          addFollowUpTag(),
          saveFollowUpToDatabase(),
        ]).then((results) => {
          const tagResult = results[0];
          const dbResult = results[1];

          console.log("Parallel follow-up results:", {
            tagResult,
            dbResult,
          });

          if (tagResult.status === "rejected") {
            console.error("Tag add failed:", tagResult.reason);
          }

          if (tagResult.status === "fulfilled") {
            const tagValue = /** @type {any} */ (tagResult.value);

            if (!tagValue.skipped) {
              if (tagValue.errors?.length) {
                console.error("GraphQL errors adding follow-up tag:", tagValue.errors);
              }

              if (tagValue.data?.tagsAdd?.userErrors?.length) {
                console.error(
                  "Shopify user errors adding follow-up tag:",
                  tagValue.data.tagsAdd.userErrors
                );
              }
            }
          }

          if (dbResult.status === "rejected") {
            console.error("Database save request failed:", dbResult.reason);
            throw new Error("Database save request failed");
          }

          const dbValue = /** @type {any} */ (dbResult.value);

          console.log("API response status:", dbValue.status);
          console.log("API response:", dbValue.data);

          if (!dbValue.ok || !dbValue.data?.success) {
            console.error("API failed:", dbValue.data?.error);
            throw new Error(dbValue.data?.error || "Database save failed");
          }

          return dbValue.data;
        });
      })
      .then((apiData) => {
        console.log("Final follow-up API data:", apiData);
      })
      .catch((err) => {
        console.error("Failed to create follow-up request", err);
      })
      .finally(() => {
        close();
      });
  };

  return (
    <s-admin-action>
      <s-text>Are you sure you want to send a follow-up request?</s-text>

      <s-button
        slot="primary-action"
        disabled={hasFollowUpTag}
        onClick={sendFollowUp}
      >
        {hasFollowUpTag ? "Follow-Up Requested" : "Follow-Up"}
      </s-button>
    </s-admin-action>
  );
}