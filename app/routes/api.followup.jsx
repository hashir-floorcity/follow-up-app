import prisma from "../db.server";

export async function loader() {
  return new Response(null, { status: 200 });
}

export async function action({ request }) {

 
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }

  console.log("API HIT");

  try {
    const body = await request.json();

    const { draftGid } = body;

    console.log("Creating follow-up for draft:", draftGid);

    if (!draftGid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "draftGid is required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        }
      );
    }

    let followUp = await prisma.followUp.findFirst({
      where: { draftId: draftGid }
    });
    if (!followUp) {
      followUp = await prisma.followUp.create({
        data: {
          draftId: draftGid,
          email: body.email || undefined,
          customer: body.customer || undefined,
          total: body.total || undefined,
        }
      });
    } else {
      console.log("Draft already has a follow-up, returning existing record");
    }

    console.log("Follow-up created:", followUp);

    return new Response(
      JSON.stringify({
        success: true,
        followUp
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );

  } catch (error) {
    console.error("Error creating follow-up:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
}