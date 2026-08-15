/* ============================================================
   ClayBlobBackground — soft ambient blurred blobs for auth pages.
   Lightweight (CSS only, no R3F) so the heavy 3D scene stays
   reserved for the hero + workspace.
   ============================================================ */

export function ClayBlobBackground() {
  return (
    <div className="clay-blobs" aria-hidden="true">
      <div className="clay-blob clay-blob--red" />
      <div className="clay-blob clay-blob--blue" />
      <div className="clay-blob clay-blob--ink" />
    </div>
  );
}
