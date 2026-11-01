/**
 * The largest size the ray-traced view is allowed to have, in CSS pixels.
 *
 * Every pixel is path traced many times, so the cost grows with the pixel count. A maximized browser window on a
 * 5K monitor holds about 14.7 million pixels, which no GPU can trace progressively. Capping the view at 2560 by 1440,
 * the size of a 1440p monitor and about 3.7 million pixels, keeps the render time the same on every screen. Raise
 * these two numbers to trade speed for resolution. The cap applies from the `md` breakpoint up. Below it the screen
 * is a phone, which has too few pixels to need one.
 */
export const maxCanvasWd = 2560
export const maxCanvasHt = 1440
