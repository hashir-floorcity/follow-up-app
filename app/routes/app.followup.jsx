import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const id = formData.get("id");
  
  if (id) {
    await prisma.followUp.delete({
      where: { id: parseInt(id) }
    });
  }
  
  return { success: true };
};

function DeleteButton({ id }) {
  const fetcher = useFetcher();
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const handleDelete = () => {
    fetcher.submit({ id }, { method: "post" });
    setShowModal(false);
  };
  
  const modalContent = showModal && mounted ? (
    <div className="modalOverlay" onClick={() => setShowModal(false)}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <h3>Delete Follow-Up</h3>
        <p>Are you sure you want to delete this follow-up? This will allow you to send another follow-up for this order.</p>
        <div className="modalButtons">
          <button onClick={() => setShowModal(false)} className="cancelButton">
            Cancel
          </button>
          <button onClick={handleDelete} className="confirmButton">
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;
  
  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="deleteButton"
        disabled={fetcher.state === "submitting"}
      >
        {fetcher.state === "submitting" ? "Deleting..." : "Delete"}
      </button>

      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}

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
              <th>Action</th>
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
                  <td>
                    <DeleteButton id={f.id} />
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

        .deleteButton {
          background: #ff4444;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 500;
        }

        .deleteButton:hover {
          background: #cc0000;
        }

        .deleteButton:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }

        .modalOverlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modalContent {
          background: white;
          padding: 24px;
          border-radius: 8px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .modalContent h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
          color: #202223;
        }

        .modalContent p {
          margin: 0 0 24px 0;
          font-size: 14px;
          color: #6d7175;
          line-height: 1.5;
        }

        .modalButtons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .cancelButton {
          background: #f6f6f7;
          color: #202223;
          border: 1px solid #c9cccf;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }

        .cancelButton:hover {
          background: #e3e4e5;
        }

        .confirmButton {
          background: #ff4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          font-weight: 500;
        }

        .confirmButton:hover {
          background: #cc0000;
        }

      `}</style>

    </s-page>
  );
}