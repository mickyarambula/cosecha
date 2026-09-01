import { createFileRoute } from "@tanstack/react-router";
import { PrintDocSheet } from "@/components/print-doc";
import { getPrintDoc } from "@/lib/produce-server";

export const Route = createFileRoute("/doc/$tipo/$id")({
  loader: ({ params }) => {
    const tipo = params.tipo;
    if (tipo !== "factura" && tipo !== "oc" && tipo !== "ov" && tipo !== "pick" && tipo !== "bol" && tipo !== "confirm" && tipo !== "cuenta" && tipo !== "liq") {
      throw new Error("Documento no reconocido");
    }
    return getPrintDoc({ data: { tipo, token: params.id } });
  },
  component: Page,
});

function Page() {
  const doc = Route.useLoaderData();
  return <PrintDocSheet doc={doc} />;
}
