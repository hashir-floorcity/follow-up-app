import "@shopify/ui-extensions/preact";
import {render} from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {

  const {close, data} = shopify;
  const hasFollowUpTag =
  data.selected?.[0]?.tags?.includes("follow-up-requested");

  const sendFollowUp = () => {
    const draftId = data.selected?.[0]?.id;
    console.log("Follow-up triggered for:", draftId);
    if (draftId) {
      shopify.query(
        `mutation draftOrderUpdate($id: ID!) {
           draftOrderUpdate(id: $id, input: { tags: ["follow-up-requested"] }) {
             draftOrder { id }
             userErrors { field message }
           }
         }`,
        { variables: { id: draftId } }
      )
        .then(res => {
          console.log("Mutation result:", res);
          if (res.errors?.length) {
            console.error("GraphQL errors updating draft order:", res.errors);
          }
          if (res.data?.draftOrderUpdate?.userErrors?.length) {
            console.error("User errors:", res.data.draftOrderUpdate.userErrors);
          }
        })
        .catch(err => {
          console.error("Failed to update draft order for follow-up", err);
        })
        .finally(() => {
          close();
        });
    } else {
      close();
    }
  };

  return (
    <s-admin-action>
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