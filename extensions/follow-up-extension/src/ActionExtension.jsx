import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {

  const { close, data } = shopify;
  console.log("Extension data:", data);
  console.log("Selected item:", data.selected?.[0]);
  const selectedDraft = /** @type {any} */ (data.selected?.[0]);
  const rawTags = selectedDraft?.tags;
  const existingTags = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? rawTags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];
  console.log("Selected tags:", existingTags);
  const hasFollowUpTag = existingTags.includes("follow-up-requested");

  const sendFollowUp = () => {
    const draftId = data.selected?.[0]?.id;
    if (!draftId) {
      close();
      return;
    }

    shopify.query(
      `query draftOrderTags($id: ID!) {
         draftOrder(id: $id) {
           tags
         }
       }`,
      { variables: { id: draftId } }
    )
      .then((queryResult) => {
        const queryData = /** @type {any} */ (queryResult).data;
        const currentTags = Array.isArray(queryData?.draftOrder?.tags)
          ? queryData.draftOrder.tags
          : typeof queryData?.draftOrder?.tags === "string"
            ? queryData.draftOrder.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
            : existingTags;

        const updatedTags = currentTags.includes("follow-up-requested")
          ? currentTags
          : [...currentTags, "follow-up-requested"];

        console.log("Follow-up triggered for:", draftId);
        console.log("Current tags from store:", currentTags);
        console.log("Updated tags:", updatedTags);

        return shopify.query(
          `mutation draftOrderUpdate($id: ID!, $tags: [String!]) {
             draftOrderUpdate(id: $id, input: { tags: $tags }) {
               draftOrder { id tags }
               userErrors { field message }
             }
           }`,
          { variables: { id: draftId, tags: updatedTags } }
        );
      })
      .then((res) => {
        console.log("Mutation result:", res);
        const resData = /** @type {any} */ (res).data;
        if (res.errors?.length) {
          console.error("GraphQL errors updating draft order:", res.errors);
        }
        if (resData?.draftOrderUpdate?.userErrors?.length) {
          console.error("User errors:", resData.draftOrderUpdate.userErrors);
        }
      })
      .catch((err) => {
        console.error("Failed to update draft order for follow-up", err);
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