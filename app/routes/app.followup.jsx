import { useLoaderData, useFetcher, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const { admin } = await authenticate.admin(request);

  const followUps = await prisma.followUp.findMany({
    orderBy: { createdAt: "desc" }
  });

  
  const followUpsWithInvoice = await Promise.all(
    followUps.map(async (f) => {
      try {
        const response = await admin.graphql(`
        query {
          draftOrder(id: "${f.draftId}") {
            invoiceSentAt
          }
        }
      `);

        const json = await response.json();
        const invoiceSentAt = json.data?.draftOrder?.invoiceSentAt;

        return {
          ...f,
          invoiceSentAt
        };
      } catch (err) {
        console.log("Invoice fetch error:", err);
        return {
          ...f,
          invoiceSentAt: null
        };
      }
    })
  );
  return {
    followUps: followUpsWithInvoice,
    shop: session.shop
  };
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const id = formData.get("id");
  const outcome = formData.get("outcome");
  const nextFollowUp = formData.get("nextFollowUp");
  const notes = formData.get("notes");
  const status = formData.get("status");

  
  if (id && !outcome && !status) {
    await prisma.followUp.delete({
      where: { id: parseInt(id) }
    });
    return { success: true, action: 'delete' };
  }

  if (id && outcome) {
    const existing = await prisma.followUp.findUnique({
      where: { id: parseInt(id) }
    });

    const callHistory = existing.callHistory
      ? JSON.parse(existing.callHistory)
      : [];

    callHistory.push({
      date: new Date().toISOString(),
      outcome,
      notes: notes || ""
    });

    const updateData = {
      attempts: existing.attempts + 1,
      lastOutcome: outcome,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : existing.nextFollowUp,
      notes: notes || existing.notes,
      callHistory: JSON.stringify(callHistory)
    };

    if (status) {
      updateData.status = status;
    }

    await prisma.followUp.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return { success: true, action: 'update' };
  }

  return { success: false };
};

// export const action = async ({ request }) => {
//   await authenticate.admin(request);

//   const formData = await request.formData();
//   const id = formData.get("id");

//   if (id) {
//     await prisma.followUp.delete({
//       where: { id: parseInt(id) }
//     });
//   }

//   return { success: true };
// };

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
          <button onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }} className="confirmButton">
            Delete
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className="deleteButton"
        disabled={fetcher.state === "submitting"}
      >
        {fetcher.state === "submitting" ? "Deleting..." : "Delete"}
      </button>

      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}

function FollowUpDetailPage({ followUp, shop, onBack }) {
  const fetcher = useFetcher();
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [markAsCompleted, setMarkAsCompleted] = useState(false);


  const orderNumber = followUp.draftId?.split("/").pop();
  const shopName = shop.replace('.myshopify.com', '');
  const draftOrderUrl = `https://admin.shopify.com/store/${shopName}/draft_orders/${orderNumber}`;

  const callHistory = followUp.callHistory
    ? (typeof followUp.callHistory === 'string' ? JSON.parse(followUp.callHistory) : followUp.callHistory)
    : [];

  const handleSubmit = () => {
    if (!selectedOutcome) return;

    const formData = new FormData();
    formData.append("id", followUp.id);
    formData.append("outcome", selectedOutcome);
    formData.append("nextFollowUp", selectedDate);
    formData.append("notes", callNotes);
    if (markAsCompleted) {
      formData.append("status", "completed");
    }

    fetcher.submit(formData, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onBack();
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="detailPage">
      <div className="detailContainer">
        <div className="topNav">
          <button onClick={onBack} className="navButton">
            ← Back
          </button>
        </div>

        <div className="orderHeader">
          <a
            href={draftOrderUrl}
            target="_parent"
            className="orderTitle"
          >
            {followUp.orderName || `#${orderNumber}`}
          </a>
          <div className="orderMeta">
            <span className="phoneNumber">{followUp.phone || '(509) 295-4017'}</span>
            <span className="invoiceStatus">
              Invoice Sent: {followUp.invoiceSentAt
                ? new Date(followUp.invoiceSentAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
                : "Never"}
            </span>
          </div>
        </div>

        <div className="section">
          <h3 className="sectionHeading">Call History</h3>
          <div className="callHistoryBox">
            {callHistory.length > 0 ? (
              callHistory.map((call, index) => (
                <div key={index} className="callEntry">
                  [{new Date(call.date).toLocaleString('en-US', {
                    month: 'numeric', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}] - {call.outcome}{call.notes ? ` - ${call.notes}` : ''}
                </div>
              ))
            ) : (
              <div className="noHistory">No call history yet</div>
            )}
          </div>
        </div>

        <div className="section">
          <h3 className="sectionHeading">New call notes</h3>
          <textarea
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            placeholder="Enter any notes about this call..."
            className="callNotesArea"
            rows="4"
          />
        </div>

        <div className="section">
          <h3 className="sectionHeading">Call Outcome</h3>
          <div className="outcomeGrid">
            {['Answered', 'Left VM', 'Sent Text', 'Wrong Number'].map((outcome) => (
              <button
                key={outcome}
                type="button"
                className={`outcomeButton ${selectedOutcome === outcome ? 'selected' : ''}`}
                onClick={() => setSelectedOutcome(outcome)}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <h3 className="sectionHeading">Next follow-up date (optional)</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="dateInputField"
            min={new Date().toISOString().split('T')[0]}
            placeholder="Select date"
          />
        </div>

        {followUp.status !== 'completed' && (
          <div className="section">
            <label className="checkboxLabel">
              <input
                type="checkbox"
                checked={markAsCompleted}
                onChange={(e) => setMarkAsCompleted(e.target.checked)}
                className="checkbox"
              />
              <span>Mark this follow-up as completed</span>
            </label>
          </div>
        )}

        <div className="actionButtonsRow">
          <button onClick={onBack} className="btnCancel">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btnSave"
            disabled={!selectedOutcome || fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? "Saving..." : "Save & Next"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function FollowUpPage() {
  const { followUps, shop } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const itemsPerPage = 10;

  const filteredFollowUps = followUps.filter((f) => {
    const query = search.toLowerCase();

    return (
      f.customer?.toLowerCase().includes(query) ||
      f.email?.toLowerCase().includes(query) ||
      f.orderName?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredFollowUps.length / itemsPerPage);

  const paginatedFollowUps = filteredFollowUps.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const selectedId = searchParams.get('id');
  const selectedFollowUp = selectedId ? followUps.find(f => f.id === parseInt(selectedId)) : null;

  const handleRowClick = (followUp) => {
    navigate(`/app/followup?id=${followUp.id}`, { replace: true });
  };

  const closeDetail = () => {
    navigate('/app/followup', { replace: true });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayFollowUps = followUps.filter(f => {
    const created = new Date(f.createdAt);
    created.setHours(0, 0, 0, 0);
    return created.getTime() === today.getTime();
  }).length;

  const yesterdayFollowUps = followUps.filter(f => {
    const created = new Date(f.createdAt);
    created.setHours(0, 0, 0, 0);
    return created.getTime() === yesterday.getTime();
  }).length;

  const monthToDateFollowUps = followUps.filter(f => {
    const created = new Date(f.createdAt);
    return created >= monthStart;
  }).length;

  const attemptsToday = followUps.reduce((sum, f) => {
    const callHistory = f.callHistory ? JSON.parse(f.callHistory) : [];
    const todayCalls = callHistory.filter(call => {
      const callDate = new Date(call.date);
      callDate.setHours(0, 0, 0, 0);
      return callDate.getTime() === today.getTime();
    });
    return sum + todayCalls.length;
  }, 0);

  const remainingFollowUps = followUps.filter(f => f.status !== 'completed').length;

  if (selectedFollowUp) {
    return (
      <>
        <FollowUpDetailPage
          followUp={selectedFollowUp}
          shop={shop}
          onBack={closeDetail}
        />
        <style>{`
          /* Page background */
          .detailPage{
            background:#f6f7f8;
            min-height:100vh;
            padding:28px;
          }

          /* Main container */
          .detailContainer{
            max-width:760px;
            margin:auto;
            background:#fff;
            border-radius:10px;
            border:1px solid #e5e7eb;
            padding:28px;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
          }

          /* Top navigation */
          .topNav{
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:24px;
          }

          .navButton{
            background:#fff;
            border:1px solid #d1d5db;
            padding:6px 14px;
            border-radius:6px;
            font-size:13px;
            font-weight:500;
            color:#374151;
            cursor:pointer;
          }

          .navButton:hover{
            background:#f3f4f6;
          }

          /* Order header */
          .orderHeader{
            margin-bottom:28px;
          }

          .orderTitle{
            font-size:22px;
            font-weight:600;
            color:#111827;
            text-decoration:none;
          }

          .orderMeta{
            margin-top:6px;
            font-size:13px;
            color:#6b7280;
            display:flex;
            gap:18px;
          }

          /* Section layout */
          .section{
            margin-bottom:28px;
          }

          .sectionHeading{
            font-size:13px;
            font-weight:600;
            color:#111827;
            margin-bottom:10px;
            letter-spacing:.2px;
          }

          /* Call history */
          .callHistoryBox{
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:6px;
            padding:14px;
            font-size:12px;
            line-height:1.7;
            max-height:160px;
            overflow:auto;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
          }

          .callEntry{
            color:#374151;
          }

          .noHistory{
            color:#9ca3af;
          }

          /* Notes textarea */
          .callNotesArea{
            width:100%;
            padding:10px 12px;
            border:1px solid #d1d5db;
            border-radius:6px;
            font-size:13px;
            resize:vertical;
            box-sizing:border-box;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
          }

          .callNotesArea:focus{
            outline:none;
            border-color:#111;
            box-shadow:0 0 0 2px rgba(0,0,0,0.05);
          }

          /* Outcome buttons */
          .outcomeGrid{
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          }

          .outcomeButton{
            padding:6px 14px;
            border:1px solid #d1d5db;
            background:#fff;
            border-radius:6px;
            font-size:13px;
            cursor:pointer;
          }

          .outcomeButton:hover{
            background:#f3f4f6;
          }

          .outcomeButton.selected{
            background:#111;
            border-color:#111;
            color:#fff;
          }

          /* Date input */
          .dateInputField{
            width:200px;
            padding:8px 10px;
            border:1px solid #d1d5db;
            border-radius:6px;
            font-size:13px;
          }

          .dateInputField:focus{
            outline:none;
            border-color:#111;
          }

          /* Checkbox */
          .checkboxLabel{
            font-size:13px;
            color:#374151;
            display:flex;
            align-items:center;
            gap:8px;
          }

          /* Action buttons */
          .actionButtonsRow{
            display:flex;
            justify-content:flex-end;
            gap:10px;
            margin-top:28px;
          }

          .btnCancel{
            padding:8px 16px;
            border:1px solid #d1d5db;
            background:#fff;
            border-radius:6px;
            font-size:13px;
            cursor:pointer;
          }

          .btnCancel:hover{
            background:#f3f4f6;
          }

          .btnSave{
            padding:8px 18px;
            border:none;
            background:#111;
            color:#fff;
            border-radius:6px;
            font-size:13px;
            cursor:pointer;
          }

          .btnSave:hover{
            background:#000;
          }

          .btnSave:disabled{
            opacity:.5;
            cursor:not-allowed;
          }
        `}</style>
      </>
    );
  }

  return (
    <s-page heading="Follow-Up">
      <s-section heading="Activity Summary">
       <div className="summaryGrid">

          <div className="summaryCard">
            <div className="label">Today</div>
            <div className="value">{todayFollowUps}</div>
          </div>

          <div className="summaryCard">
            <div className="label">Yesterday</div>
            <div className="value">{yesterdayFollowUps}</div>
          </div>

          <div className="summaryCard">
            <div className="label">Month to Date</div>
            <div className="value">{monthToDateFollowUps}</div>
          </div>

          <div className="summaryCard">
            <div className="label">Attempts Today</div>
            <div className="value">{attemptsToday}</div>
          </div>

          <div className="summaryCard">
            <div className="label">Remaining</div>
            <div className="value">{remainingFollowUps}</div>
          </div>

        </div>
      </s-section>

      <s-section>
        <div className="tableToolbar">

          <input
            type="text"
            placeholder="Search customer, email or order..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="searchInput"
          />

        </div>

        <div className="tableWrapper">
          <table className="followupTable">

            <thead>
              <tr>
                <th>Draft Order</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Total</th>
                <th>Next Follow-up</th>
                <th>Last Outcome</th>
                <th>Attempts</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedFollowUps.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>
                    No follow-ups found
                  </td>
                </tr>
              ) : (
                paginatedFollowUps.map((f) => {

                  const orderNumber = f.draftId?.split("/").pop();
                  const shopName = shop.replace('.myshopify.com', '');

                  const nextDate = f.nextFollowUp
                    ? new Date(f.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '-';

                  return (

                    <tr
                      key={f.id}
                      onClick={() => handleRowClick(f)}
                      style={{ cursor: "pointer" }}
                    >
                      <td title={f.orderName || `#${orderNumber}`}>
                        <button
                          onClick={() => handleRowClick(f)}
                          className="orderLinkButton"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#000000',
                            textDecoration: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'inherit',
                            fontSize: '13px'
                          }}
                        >
                          {f.orderName || `#${orderNumber}`}
                        </button>
                      </td>
                      <td>{f.customer || "Unknown"}</td>
                      <td title={f.email || "N/A"}>{f.email || "N/A"}</td>
                      <td>${f.total || "0"}</td>
                      <td>{nextDate}</td>
                      <td>
                        {f.lastOutcome ? (
                          <span className={`outcome outcome-${f.lastOutcome?.toLowerCase().replace(' ', '-')}`}>
                            {f.lastOutcome}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className="attempts-badge">{f.attempts || 0}</span>
                      </td>
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
                }))}

            </tbody>
          </table>
        </div>
        <div className="pagination">

          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="pageButton"
          >
            Prev
          </button>

          <span className="pageInfo">
            Page {page} of {totalPages || 1}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="pageButton"
          >
            Next
          </button>

        </div>

      </s-section>

      <style>{`

        /* SUMMARY CARDS */
      .summaryGrid{
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:16px;
      }

      @media (max-width:1100px){
        .summaryGrid{
          grid-template-columns:repeat(3,1fr);
        }
      }

      @media (max-width:700px){
        .summaryGrid{
          grid-template-columns:repeat(2,1fr);
        }
      }

      @media (max-width:480px){
        .summaryGrid{
          grid-template-columns:1fr;
        }
      }

      .summaryCard{
        background:white;
        border:1px solid #e5e7eb;
        border-radius:8px;
        padding:16px;
        text-align:center;
      }

      .summaryCard .label{
        font-size:12px;
        color:#6b7280;
        margin-bottom:4px;
      }

      .summaryCard .value{
        font-size:20px;
        font-weight:600;
      }


      /* TOOLBAR */

      .tableToolbar{
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:10px;
        margin-bottom:14px;
      }

      .searchInput{
        padding:8px 12px;
        border:1px solid #d1d5db;
        border-radius:6px;
        font-size:13px;
        width:260px;
      }

      .searchInput:focus{
        outline:none;
        border-color:#111827;
      }

      @media (max-width:600px){

        .searchInput{
          width:100%;
        }

      }


      /* TABLE */

      .tableWrapper{
        width:100%;
        overflow-x:auto;
        border:1px solid #e5e7eb;
        border-radius:8px;
      }

      .followupTable{
        width:100%;
        border-collapse:collapse;
        font-size:13px;
        table-layout:fixed;
        background:white;
      }


      /* HEADER */

      .followupTable thead{
        background:#f9fafb;
      }

      .followupTable th{
        text-align:left;
        font-weight:600;
        padding:10px 12px;
        font-size:12px;
        border-bottom:1px solid #e5e7eb;
        white-space:nowrap;
      }


      /* BODY */

      .followupTable td{
        padding:10px 12px;
        font-size:13px;
        border-bottom:1px solid #f1f5f9;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .followupTable tbody tr{
        cursor:pointer;
        transition:background .15s ease;
      }

      .followupTable tbody tr:hover{
        background:#f5f7fa;
      }


      /* COLUMN WIDTHS */

      .followupTable th:nth-child(1),
      .followupTable td:nth-child(1){
        width:130px;
      }

      .followupTable th:nth-child(2),
      .followupTable td:nth-child(2){
        width:110px;
      }

      .followupTable th:nth-child(3),
      .followupTable td:nth-child(3){
        width:220px;
      }

      .followupTable th:nth-child(4),
      .followupTable td:nth-child(4){
        width:90px;
      }

      .followupTable th:nth-child(5),
      .followupTable td:nth-child(5){
        width:120px;
      }

      .followupTable th:nth-child(6),
      .followupTable td:nth-child(6){
        width:120px;
      }

      .followupTable th:nth-child(7),
      .followupTable td:nth-child(7){
        width:70px;
      }

      .followupTable th:nth-child(8),
      .followupTable td:nth-child(8){
        width:100px;
      }

      .followupTable th:nth-child(9),
      .followupTable td:nth-child(9){
        width:90px;
      }


      /* STATUS */

      .status{
        padding:4px 8px;
        border-radius:6px;
        font-size:11px;
        background:#dcfce7;
        color:#166534;
        font-weight:500;
      }


      /* OUTCOME */

      .outcome{
        padding:4px 8px;
        border-radius:6px;
        font-size:11px;
        font-weight:500;
      }

      .outcome-answered{
        background:#dcfce7;
        color:#166534;
      }

      .outcome-left-vm{
        background:#fef3c7;
        color:#92400e;
      }

      .outcome-no-answer{
        background:#fee2e2;
        color:#991b1b;
      }

      .outcome-wrong-number{
        background:#e5e7eb;
        color:#374151;
      }


      /* ATTEMPTS */

      .attempts-badge{
        display:inline-block;
        background:#f3f4f6;
        color:#111827;
        padding:3px 10px;
        border-radius:12px;
        font-size:11px;
        font-weight:600;
        text-align:center;
      }


      /* DELETE BUTTON */

      .deleteButton{
        background:#ef4444;
        color:white;
        border:none;
        padding:6px 10px;
        border-radius:6px;
        font-size:12px;
        cursor:pointer;
      }

      .deleteButton:hover{
        background:#dc2626;
      }

      .deleteButton:disabled{
        opacity:.5;
        cursor:not-allowed;
      }


      /* PAGINATION */

      .pagination{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:12px;
        margin-top:16px;
      }

      .pageButton{
        background:white;
        border:1px solid #d1d5db;
        padding:6px 12px;
        border-radius:6px;
        font-size:12px;
        cursor:pointer;
      }

      .pageButton:hover{
        background:#f3f4f6;
      }

      .pageButton:disabled{
        opacity:.4;
        cursor:not-allowed;
      }

      .pageInfo{
        font-size:12px;
        color:#6b7280;
      }
        .modalOverlay{
  position:fixed;
  inset:0;
  background:rgba(17,24,39,0.45);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:1000;
}

.modalContent{
  background:#fff;
  width:min(420px, 92vw);
  border-radius:10px;
  border:1px solid #e5e7eb;
  box-shadow:0 20px 50px rgba(0,0,0,0.18);
  padding:20px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}

.modalContent h3{
  margin:0 0 8px 0;
  font-size:18px;
  font-weight:600;
  color:#111827;
}

.modalContent p{
  margin:0 0 18px 0;
  font-size:14px;
  line-height:1.5;
  color:#6b7280;
}

.modalButtons{
  display:flex;
  justify-content:flex-end;
  gap:10px;
}

.cancelButton{
  background:#fff;
  color:#111827;
  border:1px solid #d1d5db;
  padding:8px 14px;
  border-radius:6px;
  font-size:13px;
  font-weight:500;
  cursor:pointer;
}

.cancelButton:hover{
  background:#f3f4f6;
}

.confirmButton{
  background:#ef4444;
  color:#fff;
  border:none;
  padding:8px 14px;
  border-radius:6px;
  font-size:13px;
  font-weight:500;
  cursor:pointer;
}

.confirmButton:hover{
  background:#dc2626;
}
      `}</style>

    </s-page>
  );
}