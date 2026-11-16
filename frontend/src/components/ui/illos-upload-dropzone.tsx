"use client";

// File upload dropzone.
// The illustration is File uploads (Isometric) from Illos (https://illos.dev).
// It loops while it is on screen, pauses off screen, and stays still for prefers-reduced-motion.
//
// License
// The component code in this file (layout, props, play logic) is free to use, change and share under the MIT license.
// The illustration inside it (the SVG markup and its animation) is not covered by MIT. It belongs to Illos and is
// licensed under the Illos free license, https://illos.dev/license: you can use it in personal and commercial work,
// including client projects, with no credit needed, and you may modify it. Not allowed: redistributing or selling it
// as an asset (packs, illustration or icon sites, or other libraries), or using it to build a competing illustration
// library.
import { useEffect, useRef, type CSSProperties, useState } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const UPLOADS_SVG = `<svg class="li-uploads" xmlns="http://www.w3.org/2000/svg" width="720" height="460" viewBox="0 0 720 460" fill="none" role="img" aria-labelledby="li-uploads-t">
<title id="li-uploads-t">File uploads</title>
<style>
@scope (svg.li-uploads) {
:scope{--d:var(--illos-dark,0);--g:var(--illos-ground,#ffffff);--ink:var(--illos-ink,#2a2a2a);--accent:var(--illos-accent,#1daf9c);--mute:color-mix(in srgb,var(--ink) 45%,var(--g))}
path,polygon,ellipse,circle{vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.top{fill:color-mix(in srgb,var(--ink) calc(var(--d) * 10% + (1 - var(--d)) * 0%),var(--g))}
.left{fill:color-mix(in srgb,var(--ink) calc(var(--d) * 5% + (1 - var(--d)) * 4%),var(--g))}
.right{fill:color-mix(in srgb,var(--ink) calc(var(--d) * 2% + (1 - var(--d)) * 9%),var(--g))}
.recess{fill:color-mix(in srgb,var(--ink) calc(var(--d) * 4% + (1 - var(--d)) * 6%),var(--g))}
.ttop{fill:color-mix(in srgb,var(--accent) calc(var(--d) * 30% + (1 - var(--d)) * 10%),var(--g))}
.tleft{fill:color-mix(in srgb,var(--accent) calc(var(--d) * 22% + (1 - var(--d)) * 18%),var(--g))}
.tright{fill:color-mix(in srgb,var(--accent) calc(var(--d) * 16% + (1 - var(--d)) * 26%),var(--g))}
.e,.m,.te,.tem{fill:none;stroke-width:1px}
.e{stroke:var(--ink)}.m{stroke:var(--mute)}.te{stroke:var(--accent)}
.tcell{fill:color-mix(in srgb,var(--accent) 75%,var(--g));stroke:var(--accent);stroke-width:1px}
.tem{stroke:color-mix(in srgb,var(--accent) 45%,var(--g))}
.d{stroke-dasharray:2 3}
.dot{fill:var(--ink)}.tdot{fill:var(--accent)}.mdot{fill:var(--mute)}

.co0,.co1,.co2{transform-box:fill-box;transform-origin:50% 50%}
.cx0{animation:li-uploads_x0 3.7s linear}.cz0{animation:li-uploads_z0 3.7s linear}.co0{animation:li-uploads_o0 3.7s linear}
.cx1{animation:li-uploads_x1 3.7s linear}.cz1{animation:li-uploads_z1 3.7s linear}.co1{animation:li-uploads_o1 3.7s linear}
.cx2{animation:li-uploads_x2 3.7s linear}.cz2{animation:li-uploads_z2 3.7s linear}.co2{animation:li-uploads_o2 3.7s linear}
.fx{animation:li-uploads_fx 3.7s linear}.fo{animation:li-uploads_fo 3.7s linear}
.labf{animation:li-uploads_lab 3.7s linear}
@keyframes li-uploads_x0{0%{transform:translate(0px,0px)}8.108%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}16.216%{transform:translate(-10.39px,-6px)}57.297%{transform:translate(-10.39px,-6px);animation-timing-function:cubic-bezier(0.32,0.72,0,1)}67.568%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}}
@keyframes li-uploads_z0{0%{transform:translateY(0px)}18.919%{transform:translateY(0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}35.135%{transform:translateY(200px);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}37.027%{transform:translateY(197.5px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}40.541%{transform:translateY(200px)}78.919%{transform:translateY(200px)}79.459%{transform:translateY(0px)}100%{transform:translateY(0px)}}
@keyframes li-uploads_o0{0%{opacity:1;transform:scale(1)}70.27%{opacity:1;transform:scale(1);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}78.378%{opacity:0;transform:scale(1)}81.081%{opacity:0;transform:scale(0.92);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}89.189%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}}
@keyframes li-uploads_x1{0%{transform:translate(0px,0px)}8.108%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}16.216%{transform:translate(0px,0px)}57.297%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(0.32,0.72,0,1)}67.568%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}}
@keyframes li-uploads_z1{0%{transform:translateY(0px)}26.486%{transform:translateY(0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}42.703%{transform:translateY(200px);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}44.595%{transform:translateY(197.5px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}48.108%{transform:translateY(200px)}78.919%{transform:translateY(200px)}79.459%{transform:translateY(0px)}100%{transform:translateY(0px)}}
@keyframes li-uploads_o1{0%{opacity:1;transform:scale(1)}70.27%{opacity:1;transform:scale(1);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}78.378%{opacity:0;transform:scale(1)}81.081%{opacity:0;transform:scale(0.92);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}89.189%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}}
@keyframes li-uploads_x2{0%{transform:translate(0px,0px)}8.108%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}16.216%{transform:translate(10.39px,6px)}57.297%{transform:translate(10.39px,6px);animation-timing-function:cubic-bezier(0.32,0.72,0,1)}67.568%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}}
@keyframes li-uploads_z2{0%{transform:translateY(0px)}34.054%{transform:translateY(0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}50.27%{transform:translateY(200px);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}52.162%{transform:translateY(197.5px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}55.676%{transform:translateY(200px)}78.919%{transform:translateY(200px)}79.459%{transform:translateY(0px)}100%{transform:translateY(0px)}}
@keyframes li-uploads_o2{0%{opacity:1;transform:scale(1)}70.27%{opacity:1;transform:scale(1);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}78.378%{opacity:0;transform:scale(1)}81.081%{opacity:0;transform:scale(0.92);animation-timing-function:cubic-bezier(0.23,1,0.32,1)}89.189%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}}
@keyframes li-uploads_fx{0%{transform:translate(0px,0px)}6.757%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(0.77,0,0.175,1)}18.919%{transform:translate(-131.64px,-76px)}68.649%{transform:translate(-131.64px,-76px)}69.189%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}}
@keyframes li-uploads_fo{0%{opacity:1}19.459%{opacity:1}20%{opacity:0}70.27%{opacity:0;animation-timing-function:cubic-bezier(0.23,1,0.32,1)}78.378%{opacity:1}100%{opacity:1}}
@keyframes li-uploads_lab{0%{opacity:1}8.108%{opacity:1;animation-timing-function:cubic-bezier(0.23,1,0.32,1)}12.162%{opacity:0}85.135%{opacity:0;animation-timing-function:cubic-bezier(0.23,1,0.32,1)}91.892%{opacity:1}100%{opacity:1}}
*{animation-iteration-count:1!important;animation-fill-mode:both!important;animation-play-state:var(--illos-play,running)!important}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
}
</style>
<polygon class="right" points="483.4,262 483.12,263.66 482.29,265.25 480.93,266.71 479.1,268 423.67,300 421.45,301.06 418.91,301.84 416.15,302.32 413.28,302.49 413.28,402.49 416.15,402.32 418.91,401.84 421.45,401.06 423.67,400 479.1,368 480.93,366.71 482.29,365.25 483.12,363.66 483.4,362"/><polygon class="left" points="413.28,302.49 410.41,302.32 407.66,301.84 405.12,301.06 402.89,300 208.9,188 207.07,186.71 205.71,185.25 204.88,183.66 204.6,182 204.6,282 204.88,283.66 205.71,285.25 207.07,286.71 208.9,288 402.89,400 405.12,401.06 407.66,401.84 410.41,402.32 413.28,402.49"/><polygon class="top" points="264.33,144 266.55,142.94 269.09,142.16 271.85,141.68 274.72,141.51 277.59,141.68 280.34,142.16 282.88,142.94 285.11,144 479.1,256 480.93,257.29 482.29,258.75 483.12,260.34 483.4,262 483.12,263.66 482.29,265.25 480.93,266.71 479.1,268 423.67,300 421.45,301.06 418.91,301.84 416.15,302.32 413.28,302.49 410.41,302.32 407.66,301.84 405.12,301.06 402.89,300 208.9,188 207.07,186.71 205.71,185.25 204.88,183.66 204.6,182 204.88,180.34 205.71,178.75 207.07,177.29 208.9,176"/><path class="e" d="M264.33 144L266.55 142.94L269.09 142.16L271.85 141.68L274.72 141.51L277.59 141.68L280.34 142.16L282.88 142.94L285.11 144L479.1 256L480.93 257.29L482.29 258.75L483.12 260.34L483.4 262L483.12 263.66L482.29 265.25L480.93 266.71L479.1 268L423.67 300L421.45 301.06L418.91 301.84L416.15 302.32L413.28 302.49L410.41 302.32L407.66 301.84L405.12 301.06L402.89 300L208.9 188L207.07 186.71L205.71 185.25L204.88 183.66L204.6 182L204.88 180.34L205.71 178.75L207.07 177.29L208.9 176ZM483.4 362L483.12 363.66L482.29 365.25L480.93 366.71L479.1 368L423.67 400L421.45 401.06L418.91 401.84L416.15 402.32L413.28 402.49L410.41 402.32L407.66 401.84L405.12 401.06L402.89 400L208.9 288L207.07 286.71L205.71 285.25L204.88 283.66L204.6 282M483.4 262L483.4 362M204.6 182L204.6 282"/>
<path class="m" d="M269.52 148L270.64 147.47L271.91 147.08L273.28 146.84L274.72 146.76L276.15 146.84L277.53 147.08L278.8 147.47L279.91 148L472.17 259L473.09 259.64L473.76 260.38L474.18 261.17L474.32 262L474.18 262.83L473.76 263.62L473.09 264.36L472.17 265L418.48 296L417.36 296.53L416.09 296.92L414.72 297.16L413.28 297.24L411.85 297.16L410.47 296.92L409.2 296.53L408.09 296L215.83 185L214.91 184.36L214.24 183.62L213.82 182.83L213.68 182L213.82 181.17L214.24 180.38L214.91 179.64L215.83 179Z"/>
<path class="m" d="M427.14 380L426.48 380.23L425.91 380.12L425.54 379.69L425.41 379L425.41 372L425.54 371.16L425.91 370.29L426.48 369.53L427.14 369L470.44 344L471.1 343.77L471.66 343.88L472.04 344.31L472.17 345L472.17 352L472.04 352.84L471.66 353.71L471.1 354.47L470.44 355ZM427.14 360L426.48 360.23L425.91 360.12L425.54 359.69L425.41 359L425.41 352L425.54 351.16L425.91 350.29L426.48 349.53L427.14 349L470.44 324L471.1 323.77L471.66 323.88L472.04 324.31L472.17 325L472.17 332L472.04 332.84L471.66 333.71L471.1 334.47L470.44 335ZM427.14 340L426.48 340.23L425.91 340.12L425.54 339.69L425.41 339L425.41 332L425.54 331.16L425.91 330.29L426.48 329.53L427.14 329L470.44 304L471.1 303.77L471.66 303.88L472.04 304.31L472.17 305L472.17 312L472.04 312.84L471.66 313.71L471.1 314.47L470.44 315Z"/>
<path class="e" d="M461.78 354.5L467.84 351M461.78 334.5L467.84 331M461.78 314.5L467.84 311"/>
<polygon class="recess" points="244.41,280.5 242.09,278.63 240.12,275.97 238.81,272.95 238.34,270 238.34,218 238.81,215.59 240.12,214.08 242.09,213.69 244.41,214.5 377.77,291.5 380.09,293.37 382.06,296.03 383.38,299.05 383.84,302 383.84,354 383.38,356.41 382.06,357.92 380.09,358.31 377.77,357.5"/>
<clipPath id="li-uploads-win"><polygon points="244.41,280.5 242.09,278.63 240.12,275.97 238.81,272.95 238.34,270 238.34,218 238.81,215.59 240.12,214.08 242.09,213.69 244.41,214.5 377.77,291.5 380.09,293.37 382.06,296.03 383.38,299.05 383.84,302 383.84,354 383.38,356.41 382.06,357.92 380.09,358.31 377.77,357.5"/></clipPath><g clip-path="url(#li-uploads-win)"><polygon class="top" points="198.51,280 413.28,404 482.56,364 267.79,240"/><polygon class="left" points="198.51,280 413.28,404 413.28,410 198.51,286"/><path class="m" d="M198.51 280L413.28 404M267.79 240L482.56 364"/><g class="fx"><g class="fo"><polygon class="right" points="308.45,257.5 308.37,257.98 308.12,258.45 307.73,258.87 307.19,259.25 287.28,270.75 286.63,271.06 285.88,271.29 285.08,271.43 284.24,271.47 284.24,287.47 285.08,287.43 285.88,287.29 286.63,287.06 287.28,286.75 307.19,275.25 307.73,274.87 308.12,274.45 308.37,273.98 308.45,273.5"/><polygon class="left" points="284.24,271.47 283.41,271.43 282.6,271.29 281.86,271.06 281.21,270.75 259.56,258.25 259.03,257.87 258.63,257.45 258.39,256.98 258.31,256.5 258.31,272.5 258.39,272.98 258.63,273.45 259.03,273.87 259.56,274.25 281.21,286.75 281.86,287.06 282.6,287.29 283.41,287.43 284.24,287.47"/><polygon class="top" points="279.48,243.25 280.13,242.94 280.87,242.71 281.68,242.57 282.51,242.53 283.35,242.57 284.15,242.71 284.89,242.94 285.54,243.25 307.19,255.75 307.73,256.13 308.12,256.55 308.37,257.02 308.45,257.5 308.37,257.98 308.12,258.45 307.73,258.87 307.19,259.25 287.28,270.75 286.63,271.06 285.88,271.29 285.08,271.43 284.24,271.47 283.41,271.43 282.6,271.29 281.86,271.06 281.21,270.75 259.56,258.25 259.03,257.87 258.63,257.45 258.39,256.98 258.31,256.5 258.39,256.02 258.63,255.55 259.03,255.13 259.56,254.75"/><path class="e" d="M279.48 243.25L280.13 242.94L280.87 242.71L281.68 242.57L282.51 242.53L283.35 242.57L284.15 242.71L284.89 242.94L285.54 243.25L307.19 255.75L307.73 256.13L308.12 256.55L308.37 257.02L308.45 257.5L308.37 257.98L308.12 258.45L307.73 258.87L307.19 259.25L287.28 270.75L286.63 271.06L285.88 271.29L285.08 271.43L284.24 271.47L283.41 271.43L282.6 271.29L281.86 271.06L281.21 270.75L259.56 258.25L259.03 257.87L258.63 257.45L258.39 256.98L258.31 256.5L258.39 256.02L258.63 255.55L259.03 255.13L259.56 254.75ZM308.45 273.5L308.37 273.98L308.12 274.45L307.73 274.87L307.19 275.25L287.28 286.75L286.63 287.06L285.88 287.29L285.08 287.43L284.24 287.47L283.41 287.43L282.6 287.29L281.86 287.06L281.21 286.75L259.56 274.25L259.03 273.87L258.63 273.45L258.39 272.98L258.31 272.5M308.45 257.5L308.45 273.5M258.31 256.5L258.31 272.5"/><path class="m" d="M281.65 250L269.52 257M288.57 254L280.78 258.5M295.5 258L285.11 264"/><polygon class="right" points="336.16,273.5 336.08,273.98 335.84,274.45 335.44,274.87 334.91,275.25 314.99,286.75 314.34,287.06 313.6,287.29 312.79,287.43 311.96,287.47 311.96,303.47 312.79,303.43 313.6,303.29 314.34,303.06 314.99,302.75 334.91,291.25 335.44,290.87 335.84,290.45 336.08,289.98 336.16,289.5"/><polygon class="left" points="311.96,287.47 311.12,287.43 310.32,287.29 309.58,287.06 308.93,286.75 287.28,274.25 286.74,273.87 286.35,273.45 286.1,272.98 286.02,272.5 286.02,288.5 286.1,288.98 286.35,289.45 286.74,289.87 287.28,290.25 308.93,302.75 309.58,303.06 310.32,303.29 311.12,303.43 311.96,303.47"/><polygon class="top" points="307.19,259.25 307.84,258.94 308.58,258.71 309.39,258.57 310.23,258.53 311.06,258.57 311.87,258.71 312.61,258.94 313.26,259.25 334.91,271.75 335.44,272.13 335.84,272.55 336.08,273.02 336.16,273.5 336.08,273.98 335.84,274.45 335.44,274.87 334.91,275.25 314.99,286.75 314.34,287.06 313.6,287.29 312.79,287.43 311.96,287.47 311.12,287.43 310.32,287.29 309.58,287.06 308.93,286.75 287.28,274.25 286.74,273.87 286.35,273.45 286.1,272.98 286.02,272.5 286.1,272.02 286.35,271.55 286.74,271.13 287.28,270.75"/><path class="e" d="M307.19 259.25L307.84 258.94L308.58 258.71L309.39 258.57L310.23 258.53L311.06 258.57L311.87 258.71L312.61 258.94L313.26 259.25L334.91 271.75L335.44 272.13L335.84 272.55L336.08 273.02L336.16 273.5L336.08 273.98L335.84 274.45L335.44 274.87L334.91 275.25L314.99 286.75L314.34 287.06L313.6 287.29L312.79 287.43L311.96 287.47L311.12 287.43L310.32 287.29L309.58 287.06L308.93 286.75L287.28 274.25L286.74 273.87L286.35 273.45L286.1 272.98L286.02 272.5L286.1 272.02L286.35 271.55L286.74 271.13L287.28 270.75ZM336.16 289.5L336.08 289.98L335.84 290.45L335.44 290.87L334.91 291.25L314.99 302.75L314.34 303.06L313.6 303.29L312.79 303.43L311.96 303.47L311.12 303.43L310.32 303.29L309.58 303.06L308.93 302.75L287.28 290.25L286.74 289.87L286.35 289.45L286.1 288.98L286.02 288.5M336.16 273.5L336.16 289.5M286.02 272.5L286.02 288.5"/><path class="m" d="M309.36 266L297.23 273M316.29 270L308.49 274.5M323.22 274L312.82 280"/><polygon class="right" points="363.88,289.5 363.79,289.98 363.55,290.45 363.15,290.87 362.62,291.25 342.7,302.75 342.05,303.06 341.31,303.29 340.51,303.43 339.67,303.47 339.67,319.47 340.51,319.43 341.31,319.29 342.05,319.06 342.7,318.75 362.62,307.25 363.15,306.87 363.55,306.45 363.79,305.98 363.88,305.5"/><polygon class="left" points="339.67,303.47 338.83,303.43 338.03,303.29 337.29,303.06 336.64,302.75 314.99,290.25 314.46,289.87 314.06,289.45 313.81,288.98 313.73,288.5 313.73,304.5 313.81,304.98 314.06,305.45 314.46,305.87 314.99,306.25 336.64,318.75 337.29,319.06 338.03,319.29 338.83,319.43 339.67,319.47"/><polygon class="top" points="334.91,275.25 335.56,274.94 336.3,274.71 337.1,274.57 337.94,274.53 338.77,274.57 339.58,274.71 340.32,274.94 340.97,275.25 362.62,287.75 363.15,288.13 363.55,288.55 363.79,289.02 363.88,289.5 363.79,289.98 363.55,290.45 363.15,290.87 362.62,291.25 342.7,302.75 342.05,303.06 341.31,303.29 340.51,303.43 339.67,303.47 338.83,303.43 338.03,303.29 337.29,303.06 336.64,302.75 314.99,290.25 314.46,289.87 314.06,289.45 313.81,288.98 313.73,288.5 313.81,288.02 314.06,287.55 314.46,287.13 314.99,286.75"/><path class="e" d="M334.91 275.25L335.56 274.94L336.3 274.71L337.1 274.57L337.94 274.53L338.77 274.57L339.58 274.71L340.32 274.94L340.97 275.25L362.62 287.75L363.15 288.13L363.55 288.55L363.79 289.02L363.88 289.5L363.79 289.98L363.55 290.45L363.15 290.87L362.62 291.25L342.7 302.75L342.05 303.06L341.31 303.29L340.51 303.43L339.67 303.47L338.83 303.43L338.03 303.29L337.29 303.06L336.64 302.75L314.99 290.25L314.46 289.87L314.06 289.45L313.81 288.98L313.73 288.5L313.81 288.02L314.06 287.55L314.46 287.13L314.99 286.75ZM363.88 305.5L363.79 305.98L363.55 306.45L363.15 306.87L362.62 307.25L342.7 318.75L342.05 319.06L341.31 319.29L340.51 319.43L339.67 319.47L338.83 319.43L338.03 319.29L337.29 319.06L336.64 318.75L314.99 306.25L314.46 305.87L314.06 305.45L313.81 304.98L313.73 304.5M363.88 289.5L363.88 305.5M313.73 288.5L313.73 304.5"/><path class="m" d="M337.07 282L324.95 289M344 286L336.21 290.5M350.93 290L340.54 296"/></g></g></g>
<path class="e" d="M244.41 280.5L242.09 278.63L240.12 275.97L238.81 272.95L238.34 270L238.34 218L238.81 215.59L240.12 214.08L242.09 213.69L244.41 214.5L377.77 291.5L380.09 293.37L382.06 296.03L383.38 299.05L383.84 302L383.84 354L383.38 356.41L382.06 357.92L380.09 358.31L377.77 357.5Z"/>
<polygon class="right" points="388.95,146 388.78,146.97 388.29,147.89 387.5,148.75 386.44,149.5 360.45,164.5 359.16,165.12 357.67,165.57 356.06,165.85 354.39,165.95 354.39,235.95 356.06,235.85 357.67,235.57 359.16,235.12 360.45,234.5 386.44,219.5 387.5,218.75 388.29,217.89 388.78,216.97 388.95,216"/><polygon class="left" points="354.39,165.95 352.72,165.85 351.11,165.57 349.63,165.12 348.33,164.5 235.75,99.5 234.68,98.75 233.89,97.89 233.4,96.97 233.24,96 233.24,166 233.4,166.97 233.89,167.89 234.68,168.75 235.75,169.5 348.33,234.5 349.63,235.12 351.11,235.57 352.72,235.85 354.39,235.95"/><path class="e" d="M261.73 77.5L263.03 76.88L264.51 76.43L266.12 76.15L267.79 76.05L269.46 76.15L271.07 76.43L272.55 76.88L273.85 77.5L386.44 142.5L387.5 143.25L388.29 144.11L388.78 145.03L388.95 146L388.78 146.97L388.29 147.89L387.5 148.75L386.44 149.5L360.45 164.5L359.16 165.12L357.67 165.57L356.06 165.85L354.39 165.95L352.72 165.85L351.11 165.57L349.63 165.12L348.33 164.5L235.75 99.5L234.68 98.75L233.89 97.89L233.4 96.97L233.24 96L233.4 95.03L233.89 94.11L234.68 93.25L235.75 92.5ZM388.95 216L388.78 216.97L388.29 217.89L387.5 218.75L386.44 219.5L360.45 234.5L359.16 235.12L357.67 235.57L356.06 235.85L354.39 235.95L352.72 235.85L351.11 235.57L349.63 235.12L348.33 234.5L235.75 169.5L234.68 168.75L233.89 167.89L233.4 166.97L233.24 166M388.95 146L388.95 216M233.24 96L233.24 166"/>
<path class="top" fill-rule="evenodd" d="M261.73 77.5L263.03 76.88L264.51 76.43L266.12 76.15L267.79 76.05L269.46 76.15L271.07 76.43L272.55 76.88L273.85 77.5L386.44 142.5L387.5 143.25L388.29 144.11L388.78 145.03L388.95 146L388.78 146.97L388.29 147.89L387.5 148.75L386.44 149.5L360.45 164.5L359.16 165.12L357.67 165.57L356.06 165.85L354.39 165.95L352.72 165.85L351.11 165.57L349.63 165.12L348.33 164.5L235.75 99.5L234.68 98.75L233.89 97.89L233.4 96.97L233.24 96L233.4 95.03L233.89 94.11L234.68 93.25L235.75 92.5ZM264.33 82L265.25 81.56L266.31 81.23L267.46 81.03L268.66 80.96L269.85 81.03L271 81.23L272.06 81.56L272.99 82L378.64 143L379.4 143.54L379.97 144.15L380.32 144.81L380.43 145.5L380.32 146.19L379.97 146.85L379.4 147.46L378.64 148L357.86 160L356.93 160.44L355.87 160.77L354.72 160.97L353.53 161.04L352.33 160.97L351.18 160.77L350.12 160.44L349.2 160L243.54 99L242.78 98.46L242.21 97.85L241.87 97.19L241.75 96.5L241.87 95.81L242.21 95.15L242.78 94.54L243.54 94Z"/><clipPath id="li-uploads-mouth"><polygon points="264.33,82 265.25,81.56 266.31,81.23 267.46,81.03 268.66,80.96 269.85,81.03 271,81.23 272.06,81.56 272.99,82 378.64,143 379.4,143.54 379.97,144.15 380.32,144.81 380.43,145.5 380.32,146.19 379.97,146.85 379.4,147.46 378.64,148 357.86,160 356.93,160.44 355.87,160.77 354.72,160.97 353.53,161.04 352.33,160.97 351.18,160.77 350.12,160.44 349.2,160 243.54,99 242.78,98.46 242.21,97.85 241.87,97.19 241.75,96.5 241.87,95.81 242.21,95.15 242.78,94.54 243.54,94"/></clipPath><g clip-path="url(#li-uploads-mouth)"><polygon class="right" points="241.75,96.5 241.87,95.81 242.21,95.15 242.78,94.54 243.54,94 264.33,82 265.25,81.56 266.31,81.23 267.46,81.03 268.66,80.96 268.66,92.96 267.46,93.03 266.31,93.23 265.25,93.56 264.33,94 243.54,106 242.78,106.54 242.21,107.15 241.87,107.81 241.75,108.5"/><polygon class="left" points="268.66,80.96 269.85,81.03 271,81.23 272.06,81.56 272.99,82 378.64,143 379.4,143.54 379.97,144.15 380.32,144.81 380.43,145.5 380.43,157.5 380.32,156.81 379.97,156.15 379.4,155.54 378.64,155 272.99,94 272.06,93.56 271,93.23 269.85,93.03 268.66,92.96"/><path class="m" d="M241.75 108.5L241.87 107.81L242.21 107.15L242.78 106.54L243.54 106L264.33 94L265.25 93.56L266.31 93.23L267.46 93.03L268.66 92.96L269.85 93.03L271 93.23L272.06 93.56L272.99 94L378.64 155L379.4 155.54L379.97 156.15L380.32 156.81L380.43 157.5M268.66 80.96L268.66 92.96"/></g><path class="e" d="M261.73 77.5L263.03 76.88L264.51 76.43L266.12 76.15L267.79 76.05L269.46 76.15L271.07 76.43L272.55 76.88L273.85 77.5L386.44 142.5L387.5 143.25L388.29 144.11L388.78 145.03L388.95 146L388.78 146.97L388.29 147.89L387.5 148.75L386.44 149.5L360.45 164.5L359.16 165.12L357.67 165.57L356.06 165.85L354.39 165.95L352.72 165.85L351.11 165.57L349.63 165.12L348.33 164.5L235.75 99.5L234.68 98.75L233.89 97.89L233.4 96.97L233.24 96L233.4 95.03L233.89 94.11L234.68 93.25L235.75 92.5ZM264.33 82L265.25 81.56L266.31 81.23L267.46 81.03L268.66 80.96L269.85 81.03L271 81.23L272.06 81.56L272.99 82L378.64 143L379.4 143.54L379.97 144.15L380.32 144.81L380.43 145.5L380.32 146.19L379.97 146.85L379.4 147.46L378.64 148L357.86 160L356.93 160.44L355.87 160.77L354.72 160.97L353.53 161.04L352.33 160.97L351.18 160.77L350.12 160.44L349.2 160L243.54 99L242.78 98.46L242.21 97.85L241.87 97.19L241.75 96.5L241.87 95.81L242.21 95.15L242.78 94.54L243.54 94Z"/>
<path class="m" d="M306.76 105.5L277.32 122.5M344.87 127.5L315.42 144.5"/>
<path class="m d" d="M253.93 124L253.93 168M292.04 146L292.04 190M330.14 168L330.14 212"/>
<path class="m" d="M388.95 210L388.78 210.97L388.29 211.89L387.5 212.75L386.44 213.5L360.45 228.5L359.16 229.12L357.67 229.57L356.06 229.85L354.39 229.95L352.72 229.85L351.11 229.57L349.63 229.12L348.33 228.5L235.75 163.5L234.68 162.75L233.89 161.89L233.4 160.97L233.24 160"/>
<path class="m d" d="M365.65 105.5L365.65 137.5M256.53 72.5L256.53 104.5"/>
<clipPath id="li-uploads-show"><polygon points="380.43,145.5 380.32,146.19 379.97,146.85 379.4,147.46 378.64,148 357.86,160 356.93,160.44 355.87,160.77 354.72,160.97 353.53,161.04 352.33,160.97 351.18,160.77 350.12,160.44 349.2,160 243.54,99 242.78,98.46 242.21,97.85 241.87,97.19 241.75,96.5 241.75,0 380.43,0"/><polygon points="244.41,280.5 242.09,278.63 240.12,275.97 238.81,272.95 238.34,270 238.34,218 238.81,215.59 240.12,214.08 242.09,213.69 244.41,214.5 377.77,291.5 380.09,293.37 382.06,296.03 383.38,299.05 383.84,302 383.84,354 383.38,356.41 382.06,357.92 380.09,358.31 377.77,357.5"/></clipPath><g clip-path="url(#li-uploads-show)"><g class="cx0"><g class="cz0"><g class="co0"><polygon class="tright" points="308.45,57.5 308.37,57.98 308.12,58.45 307.73,58.87 307.19,59.25 287.28,70.75 286.63,71.06 285.88,71.29 285.08,71.43 284.24,71.47 284.24,87.47 285.08,87.43 285.88,87.29 286.63,87.06 287.28,86.75 307.19,75.25 307.73,74.87 308.12,74.45 308.37,73.98 308.45,73.5"/><polygon class="tleft" points="284.24,71.47 283.41,71.43 282.6,71.29 281.86,71.06 281.21,70.75 259.56,58.25 259.03,57.87 258.63,57.45 258.39,56.98 258.31,56.5 258.31,72.5 258.39,72.98 258.63,73.45 259.03,73.87 259.56,74.25 281.21,86.75 281.86,87.06 282.6,87.29 283.41,87.43 284.24,87.47"/><polygon class="ttop" points="279.48,43.25 280.13,42.94 280.87,42.71 281.68,42.57 282.51,42.53 283.35,42.57 284.15,42.71 284.89,42.94 285.54,43.25 307.19,55.75 307.73,56.13 308.12,56.55 308.37,57.02 308.45,57.5 308.37,57.98 308.12,58.45 307.73,58.87 307.19,59.25 287.28,70.75 286.63,71.06 285.88,71.29 285.08,71.43 284.24,71.47 283.41,71.43 282.6,71.29 281.86,71.06 281.21,70.75 259.56,58.25 259.03,57.87 258.63,57.45 258.39,56.98 258.31,56.5 258.39,56.02 258.63,55.55 259.03,55.13 259.56,54.75"/><path class="te" d="M279.48 43.25L280.13 42.94L280.87 42.71L281.68 42.57L282.51 42.53L283.35 42.57L284.15 42.71L284.89 42.94L285.54 43.25L307.19 55.75L307.73 56.13L308.12 56.55L308.37 57.02L308.45 57.5L308.37 57.98L308.12 58.45L307.73 58.87L307.19 59.25L287.28 70.75L286.63 71.06L285.88 71.29L285.08 71.43L284.24 71.47L283.41 71.43L282.6 71.29L281.86 71.06L281.21 70.75L259.56 58.25L259.03 57.87L258.63 57.45L258.39 56.98L258.31 56.5L258.39 56.02L258.63 55.55L259.03 55.13L259.56 54.75ZM308.45 73.5L308.37 73.98L308.12 74.45L307.73 74.87L307.19 75.25L287.28 86.75L286.63 87.06L285.88 87.29L285.08 87.43L284.24 87.47L283.41 87.43L282.6 87.29L281.86 87.06L281.21 86.75L259.56 74.25L259.03 73.87L258.63 73.45L258.39 72.98L258.31 72.5M308.45 57.5L308.45 73.5M258.31 56.5L258.31 72.5"/><path class="tem" d="M281.65 50L269.52 57M288.57 54L280.78 58.5M295.5 58L285.11 64"/></g></g></g><g class="cx1"><g class="cz1"><g class="co1"><polygon class="tright" points="336.16,73.5 336.08,73.98 335.84,74.45 335.44,74.87 334.91,75.25 314.99,86.75 314.34,87.06 313.6,87.29 312.79,87.43 311.96,87.47 311.96,103.47 312.79,103.43 313.6,103.29 314.34,103.06 314.99,102.75 334.91,91.25 335.44,90.87 335.84,90.45 336.08,89.98 336.16,89.5"/><polygon class="tleft" points="311.96,87.47 311.12,87.43 310.32,87.29 309.58,87.06 308.93,86.75 287.28,74.25 286.74,73.87 286.35,73.45 286.1,72.98 286.02,72.5 286.02,88.5 286.1,88.98 286.35,89.45 286.74,89.87 287.28,90.25 308.93,102.75 309.58,103.06 310.32,103.29 311.12,103.43 311.96,103.47"/><polygon class="ttop" points="307.19,59.25 307.84,58.94 308.58,58.71 309.39,58.57 310.23,58.53 311.06,58.57 311.87,58.71 312.61,58.94 313.26,59.25 334.91,71.75 335.44,72.13 335.84,72.55 336.08,73.02 336.16,73.5 336.08,73.98 335.84,74.45 335.44,74.87 334.91,75.25 314.99,86.75 314.34,87.06 313.6,87.29 312.79,87.43 311.96,87.47 311.12,87.43 310.32,87.29 309.58,87.06 308.93,86.75 287.28,74.25 286.74,73.87 286.35,73.45 286.1,72.98 286.02,72.5 286.1,72.02 286.35,71.55 286.74,71.13 287.28,70.75"/><path class="te" d="M307.19 59.25L307.84 58.94L308.58 58.71L309.39 58.57L310.23 58.53L311.06 58.57L311.87 58.71L312.61 58.94L313.26 59.25L334.91 71.75L335.44 72.13L335.84 72.55L336.08 73.02L336.16 73.5L336.08 73.98L335.84 74.45L335.44 74.87L334.91 75.25L314.99 86.75L314.34 87.06L313.6 87.29L312.79 87.43L311.96 87.47L311.12 87.43L310.32 87.29L309.58 87.06L308.93 86.75L287.28 74.25L286.74 73.87L286.35 73.45L286.1 72.98L286.02 72.5L286.1 72.02L286.35 71.55L286.74 71.13L287.28 70.75ZM336.16 89.5L336.08 89.98L335.84 90.45L335.44 90.87L334.91 91.25L314.99 102.75L314.34 103.06L313.6 103.29L312.79 103.43L311.96 103.47L311.12 103.43L310.32 103.29L309.58 103.06L308.93 102.75L287.28 90.25L286.74 89.87L286.35 89.45L286.1 88.98L286.02 88.5M336.16 73.5L336.16 89.5M286.02 72.5L286.02 88.5"/><path class="tem" d="M309.36 66L297.23 73M316.29 70L308.49 74.5M323.22 74L312.82 80"/></g></g></g><g class="cx2"><g class="cz2"><g class="co2"><polygon class="tright" points="363.88,89.5 363.79,89.98 363.55,90.45 363.15,90.87 362.62,91.25 342.7,102.75 342.05,103.06 341.31,103.29 340.51,103.43 339.67,103.47 339.67,119.47 340.51,119.43 341.31,119.29 342.05,119.06 342.7,118.75 362.62,107.25 363.15,106.87 363.55,106.45 363.79,105.98 363.88,105.5"/><polygon class="tleft" points="339.67,103.47 338.83,103.43 338.03,103.29 337.29,103.06 336.64,102.75 314.99,90.25 314.46,89.87 314.06,89.45 313.81,88.98 313.73,88.5 313.73,104.5 313.81,104.98 314.06,105.45 314.46,105.87 314.99,106.25 336.64,118.75 337.29,119.06 338.03,119.29 338.83,119.43 339.67,119.47"/><polygon class="ttop" points="334.91,75.25 335.56,74.94 336.3,74.71 337.1,74.57 337.94,74.53 338.77,74.57 339.58,74.71 340.32,74.94 340.97,75.25 362.62,87.75 363.15,88.13 363.55,88.55 363.79,89.02 363.88,89.5 363.79,89.98 363.55,90.45 363.15,90.87 362.62,91.25 342.7,102.75 342.05,103.06 341.31,103.29 340.51,103.43 339.67,103.47 338.83,103.43 338.03,103.29 337.29,103.06 336.64,102.75 314.99,90.25 314.46,89.87 314.06,89.45 313.81,88.98 313.73,88.5 313.81,88.02 314.06,87.55 314.46,87.13 314.99,86.75"/><path class="te" d="M334.91 75.25L335.56 74.94L336.3 74.71L337.1 74.57L337.94 74.53L338.77 74.57L339.58 74.71L340.32 74.94L340.97 75.25L362.62 87.75L363.15 88.13L363.55 88.55L363.79 89.02L363.88 89.5L363.79 89.98L363.55 90.45L363.15 90.87L362.62 91.25L342.7 102.75L342.05 103.06L341.31 103.29L340.51 103.43L339.67 103.47L338.83 103.43L338.03 103.29L337.29 103.06L336.64 102.75L314.99 90.25L314.46 89.87L314.06 89.45L313.81 88.98L313.73 88.5L313.81 88.02L314.06 87.55L314.46 87.13L314.99 86.75ZM363.88 105.5L363.79 105.98L363.55 106.45L363.15 106.87L362.62 107.25L342.7 118.75L342.05 119.06L341.31 119.29L340.51 119.43L339.67 119.47L338.83 119.43L338.03 119.29L337.29 119.06L336.64 118.75L314.99 106.25L314.46 105.87L314.06 105.45L313.81 104.98L313.73 104.5M363.88 89.5L363.88 105.5M313.73 88.5L313.73 104.5"/><path class="tem" d="M337.07 82L324.95 89M344 86L336.21 90.5M350.93 90L340.54 96"/></g></g></g></g>
<g class="labf"><g class="lab"><circle class="tdot" cx="356.12" cy="95" r="1.75"/><path class="te" d="M356.12 95H596"/><path class="te" d="M608.8 91.4L604 91.4L604 98.6M604 95L607.6 95M612.88 91.4L615.28 91.4M614.08 91.4L614.08 98.6M612.88 98.6L615.28 98.6M619.36 91.4L619.36 98.6L624.16 98.6M631.84 91.4L627.04 91.4L627.04 98.6L631.84 98.6L627.04 95L630.64 95"/></g></g>
<g class="lab"><circle class="dot" cx="477.37" cy="291" r="1.75"/><path class="e" d="M477.37 291H596"/><path class="e" d="M608.8 288.6L607.6 287.4L605.2 287.4L604 288.6L604 289.8L605.2 291L607.6 291L608.8 292.2L608.8 293.4L607.6 294.6L605.2 294.6L604 293.4M611.68 287.4L616.48 287.4M614.08 287.4L614.08 294.6M620.56 287.4L622.96 287.4L624.16 288.6L624.16 293.4L622.96 294.6L620.56 294.6L619.36 293.4L619.36 288.6L620.56 287.4M627.04 294.6L627.04 287.4L630.64 287.4L631.84 288.6L631.84 289.8L630.64 291L627.04 291M629.44 291L631.84 294.6M634.72 294.6L634.72 289.8L637.12 287.4L639.52 289.8L639.52 294.6M634.72 291.6L639.52 291.6M647.2 288.6L646 287.4L643.6 287.4L642.4 288.6L642.4 293.4L643.6 294.6L646 294.6L647.2 293.4L647.2 291L644.8 291M654.88 287.4L650.08 287.4L650.08 294.6L654.88 294.6M650.08 291L653.68 291"/></g>
</svg>`;

export type IllosUploadDropzoneProps = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  /** Passed to the file input, for example "image/*,.pdf". */
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  className?: string;
};

const sizeOf = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function IllosUploadDropzone({
  title = "Drop files to upload",
  description = "PNG, JPG or PDF, up to 10 MB each.",
  buttonLabel = "Browse files",
  accept,
  multiple = true,
  onFiles,
  className,
}: IllosUploadDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const take = (list: FileList | null) => {
    if (!list?.length) return;
    const next = Array.from(list);
    setFiles((current) => [...current, ...next]);
    onFiles?.(next);
  };
  return (
    <div className={cx("flex w-full flex-col gap-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={cx(
          "flex flex-col items-center gap-5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-muted" : "border-border bg-background",
        )}
      >
        <IllosArt svg={UPLOADS_SVG} className="w-full max-w-[420px] [--illos-dark:0] [--illos-ground:var(--color-background)] [--illos-ink:var(--color-foreground)] dark:[--illos-dark:1]" />
        <div className="flex max-w-sm flex-col gap-1.5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <button type="button" onClick={() => input.current?.click()} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {buttonLabel}
        </button>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Selected files">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="truncate text-foreground">{file.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{sizeOf(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default IllosUploadDropzone;

/** The illustration, inline. Decorative here: the block's own text says what it means. */
export function IllosArt({ svg, className, style }: { svg?: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? loopInView(ref.current) : undefined), []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx("[&>svg]:h-auto [&>svg]:w-full", className)}
      style={{ "--illos-play": "paused", ...style } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: svg || UPLOADS_SVG }}
    />
  );
}

/** Loops while a quarter of it is in view, restarting each cycle on the next frame, and pauses off screen. Still for prefers-reduced-motion. */
function loopInView(host: HTMLElement): () => void {
  if (typeof window === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const animations = () => host.getAnimations({ subtree: true });
  let visible = false;
  let stopped = false;
  let waiting = false;
  const loop = () => {
    if (waiting || stopped || !visible) return;
    const list = animations();
    if (!list.length) return;
    waiting = true;
    Promise.all(list.map((a) => a.finished)).then(
      () =>
        requestAnimationFrame(() => {
          waiting = false;
          if (stopped || !visible) return;
          for (const a of animations()) a.currentTime = 0; // seek only: play() takes a CSS animation out of CSS control
          loop();
        }),
      () =>
        requestAnimationFrame(() => {
          waiting = false; // an animation was cancelled: pick the loop back up
          loop();
        }),
    );
  };
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      host.style.setProperty("--illos-play", visible ? "running" : "paused");
      loop();
    },
    { threshold: 0.25 },
  );
  io.observe(host);
  return () => {
    stopped = true;
    io.disconnect();
  };
}
