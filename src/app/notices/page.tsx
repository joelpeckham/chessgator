import type { Metadata } from "next";
import { SitePage } from "@/components/site-page";

export const metadata: Metadata = {
  title: "Notices",
  description: "Licenses and source for the engines chessgator ships.",
  alternates: { canonical: "/notices" },
  openGraph: { url: "/notices" },
};

export default function NoticesPage() {
  return (
    <SitePage title="Notices">
      <p className="text-muted-foreground">
        chessgator is free software under the GNU Affero General Public License
        v3.0 or later. The source is the public repository for this site. The
        engines and model below keep their own licenses.
      </p>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Stockfish
        </h2>
        <p className="text-muted-foreground">
          Coaching analysis uses Stockfish 18 (lite single-thread WASM) from{" "}
          <a
            href="https://github.com/nmrugg/stockfish.js"
            className="text-primary underline-offset-4 hover:underline"
          >
            stockfish.js
          </a>
          , licensed under the{" "}
          <a
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            className="text-primary underline-offset-4 hover:underline"
          >
            GNU GPL v3.0
          </a>
          . Upstream engine:{" "}
          <a
            href="https://github.com/official-stockfish/Stockfish"
            className="text-primary underline-offset-4 hover:underline"
          >
            official-stockfish/Stockfish
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Maia
        </h2>
        <p className="text-muted-foreground">
          The opponent is a browser export of Maia3 5M, licensed under the{" "}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            className="text-primary underline-offset-4 hover:underline"
          >
            GNU AGPL v3.0
          </a>
          . ONNX export:{" "}
          <a
            href="https://huggingface.co/bqrio/maia3-onnx"
            className="text-primary underline-offset-4 hover:underline"
          >
            bqrio/maia3-onnx
          </a>
          . Upstream:{" "}
          <a
            href="https://github.com/CSSLab/maia3"
            className="text-primary underline-offset-4 hover:underline"
          >
            CSSLab/maia3
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          ONNX Runtime
        </h2>
        <p className="text-muted-foreground">
          Maia runs on{" "}
          <a
            href="https://github.com/microsoft/onnxruntime"
            className="text-primary underline-offset-4 hover:underline"
          >
            ONNX Runtime Web
          </a>{" "}
          (MIT).
        </p>
      </section>
    </SitePage>
  );
}
