import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const followUps = await prisma.followUp.findMany({
    orderBy: { createdAt: "desc" }
  });

  return { 
    followUps,
    shop: session.shop 
  };
};

export default function FollowUpPage() {
  const { followUps, shop } = useLoaderData();

  return (
    <s-page heading="Follow-Up">

      {/* Activity Summary */}
      {/* <s-section heading="Activity Summary">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: "16px"
        }}>

          <div className="summaryCard">
            <div className="label">Today</div>
            <div className="value">0</div>
          </div>

          <div className="summaryCard">
            <div className="label">Yesterday</div>
            <div className="value">0</div>
          </div>

          <div className="summaryCard">
            <div className="label">Month to Date</div>
            <div className="value">0</div>
          </div>

          <div className="summaryCard">
            <div className="label">Attempts Today</div>
            <div className="value">0</div>
          </div>

          <div className="summaryCard">
            <div className="label">Remaining</div>
            <div className="value">{followUps.length}</div>
          </div>

        </div>
      </s-section> */}

      {/* Draft Orders Table */}
      <s-section>

        <table className="followupTable">
          <thead>
            <tr>
              <th>Draft Order</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Total</th>
              {/* <th>Next Follow-up</th>
              <th>Attempts</th> */}
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {followUps.map((f) => {

              const orderNumber = f.draftId?.split("/").pop();
              const shopName = shop.replace('.myshopify.com', '');
              const draftOrderUrl = `https://admin.shopify.com/store/${shopName}/draft_orders/${orderNumber}`;

              return (
                <tr key={f.id}>
                  <td>
                    <s-link href={draftOrderUrl} className="orderLink">
                      {f.orderName || `#${orderNumber}`}
                    </s-link>
                  </td>
                  <td>{f.customer || "Unknown"}</td>
                  <td>{f.email || "N/A"}</td>
                  <td>{f.total || "-"}</td>
                  {/* <td>{f.nextFollowUp || "-"}</td>
                  <td>{f.attempts || 0}</td> */}
                  <td>
                    <span className={`status ${f.status}`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </s-section>


      <style>{`

        .orderLink {
          background: none;
          border: none;
          color: #000000 !important;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          padding: 0;
          text-decoration: none !important;
          display: inline;
        }

        .orderLink:hover {
          color: #333333 !important;
          text-decoration: underline !important;
        }

        /* Override s-link default styles */
        s-link.orderLink {
          color: #000000 !important;
        }

        .summaryCard{
          background:white;
          border:1px solid #e1e3e5;
          border-radius:8px;
          padding:16px;
          text-align:center;
        }

        .summaryCard .label{
          font-size:13px;
          color:#6d7175;
          margin-bottom:6px;
        }

        .summaryCard .value{
          font-size:22px;
          font-weight:600;
        }

        .followupTable{
          width:100%;
          border-collapse:collapse;
          background:white;
        }

        .followupTable thead{
          background:#f6f6f7;
        }

        .followupTable th{
          text-align:left;
          font-weight:600;
          padding:12px;
          font-size:13px;
          color:#444;
          border-bottom:1px solid #e1e3e5;
        }

        .followupTable td{
          padding:12px;
          border-bottom:1px solid #f1f1f1;
          font-size:13px;
        }

        .followupTable tr:hover{
          background:#fafafa;
        }

        .status{
          padding:4px 8px;
          border-radius:6px;
          font-size:12px;
          background:#e3f1df;
          color:#108043;
          font-weight:500;
        }

      `}</style>

    </s-page>
  );
}