import { ImageResponse } from "next/og";
import { createElement } from "react";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (size !== 192 && size !== 512) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    createElement("div", {
      style: { height: "100%", width: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#d8ed97", background: "#102b30",
        fontFamily: "sans-serif", fontWeight: 900, fontSize: size * 0.26,
        letterSpacing: "-0.08em" },
    }, "dS"),
    { width: size, height: size },
  );
}
