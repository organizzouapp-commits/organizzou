/**
 * The frosted glass of the big frame, FAKED (no backdrop-filter, no CSS filter): a heavily pre-blurred copy of the photo
 * (`npm run glass-bg`) painted inside the frame and aligned pixel-perfect with the lightly blurred photo behind it. Both are
 * derived from the same sharp original with the same aspect ratio; the heavy one is exported small (low frequency) and
 * scaled up by object-fit: cover.
 *
 * Alignment: the base photo fills the viewport (`fixed inset-0`, object-fit: cover). This layer is a viewport-sized box
 * (100vw x 100vh, object-fit: cover, same focal point) pushed back by the frame's own distance from the viewport, so each
 * pixel lands exactly over the same pixel of the sharp photo. The frame is `fixed inset-5` (20 px) with a 1 px border, hence
 * the -21 px. It is sized in viewport units, so it stays aligned on resize, and the frame never moves when the sidebar
 * collapses (only the content does). The frame's `overflow-hidden` + radius clips it.
 *
 * Painting order inside the frame (negative z, below the content): blurred photo, then the frame tint + top highlight.
 * Desktop and tablet only; on phones there is no frame.
 */
export function FrameGlass() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/app-bg-frost.webp"
        alt=""
        decoding="async"
        className="absolute max-w-none transform-gpu object-cover object-center"
        style={{ left: -21, top: -21, width: "100vw", height: "100vh" }}
      />
      <div className="frame-tint absolute inset-0" />
    </div>
  )
}
