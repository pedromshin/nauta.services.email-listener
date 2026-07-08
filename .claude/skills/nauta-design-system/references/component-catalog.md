# Component Catalog — full inventory (pre-enumerated)

> Generated 2026-07-08 by `scripts/build-catalog.mjs`. Do not hand-edit; rerun the script to refresh.
> Purpose: when composing a page, read THIS file instead of running `shadcn search`.
> Every registry item is fetched with `npx shadcn@latest add <ns>/<name> --dry-run --view` (from `packages/ui/`)
> then vendored per the workflow in ../SKILL.md — plain `add` is broken for this package.

Counts: local @nauta/ui: 55 + 1 suites | @shadcn: 61 | @kibo-ui: 41 | @magicui: 246 | @coss: 560

## Local first: @nauta/ui (vendored, Tailwind v3, Radix)

Always prefer these over registry items — zero adaptation cost.
Import: `import { X } from "@nauta/ui/<name>"`; `cn` from `@nauta/ui`.

accordion · alert · alert-dialog · animated-beam · animated-list · avatar · avatar-stack · badge · blur-fade · border-beam
breadcrumb · button · calendar · card · chart · checkbox · code-block · code-block-server · collapsible · command
confetti · dialog · dialog-stack · dot-pattern · dropdown-menu · dropzone · form · input · label · magic-card
marquee · number-ticker · popover · progress · radio-group · relative-time · resizable · scroll-area · select · separator
sheet · shimmer-button · shine-border · sidebar · skeleton · sonner · spinner · switch · table · tabs
tags · textarea · theme · tooltip · typing-animation

Compound suites: `spreadsheet-grid/` (see `packages/ui/src/<dir>/index.ts`).

## @shadcn (61 items)

canonical staples — upstream defaults to Base UI since 2026-07; we stay on Radix, always `diff` first

- `accordion`
- `alert`
- `alert-dialog`
- `aspect-ratio`
- `attachment`
- `avatar`
- `badge`
- `breadcrumb`
- `bubble`
- `button`
- `button-group`
- `calendar`
- `card`
- `carousel`
- `chart`
- `checkbox`
- `collapsible`
- `combobox`
- `command`
- `context-menu`
- `dialog`
- `direction`
- `drawer`
- `dropdown-menu`
- `empty`
- `field`
- `form`
- `hover-card`
- `input`
- `input-group`
- `input-otp`
- `item`
- `kbd`
- `label`
- `marker`
- `menubar`
- `message`
- `message-scroller`
- `native-select`
- `navigation-menu`
- `pagination`
- `popover`
- `progress`
- `radio-group`
- `resizable`
- `scroll-area`
- `select`
- `separator`
- `sheet`
- `sidebar`
- `skeleton`
- `slider`
- `sonner`
- `spinner`
- `switch`
- `table`
- `tabs`
- `textarea`
- `toggle`
- `toggle-group`
- `tooltip`

## @kibo-ui (41 items)

complex app components — heavier deps per item (dnd-kit, tiptap, ...)

- `announcement` — A compound badge designed to display an announcement.
- `avatar-stack` — Avatar Stack is a component that allows you to stack and overlap avatars.
- `banner` — A banner is a full-width component that can be used to show a message and action to the user.
- `calendar` — The calendar view displays features on a grid calendar. Specifically it shows the end date of each feature, a…
- `choicebox` — Choiceboxes are a great way to show radio or checkbox options with a card style.
- `code-block` — Provides syntax highlighting, line numbers, and copy to clipboard functionality for code blocks.
- `color-picker` — Allows users to select a color. Modeled after the color picker in Figma.
- `combobox` — Autocomplete input and command palette with a list of suggestions.
- `comparison` — A slider-based component for comparing two items in an overlay.
- `contribution-graph` — A GitHub-style contribution graph component that displays activity levels over time.
- `credit-card` — Credit card components for displaying and validating credit card information.
- `cursor` — A cursor component, great for realtime interactive applications.
- `deck` — A Tinder-like swipeable card stack component with smooth animations.
- `dialog-stack` — Composable stacked dialogs, useful for creating a wizard, nested form or multi-step process. It provides a co…
- `dropzone` — Allows users to drag-and-drop files into a container to upload or process them.
- `editor` — The Editor component is a powerful and flexible text editor that allows you to create and edit rich text cont…
- `gantt` — The Gantt chart is a powerful tool for visualizing project schedules and tracking the progress of tasks. It p…
- `glimpse` — A component that shows a preview of a URL when hovering over a link.
- `image-crop` — Helps you crop images to a specific size or aspect ratio.
- `image-zoom` — Image zoom is a component that allows you to zoom in on an image.
- `kanban` — A kanban board is a visual tool that helps you manage and visualize your work. It is a board with columns, an…
- `list` — List views are a great way to show a list of tasks grouped by status and ranked by priority.
- `marquee` — Marquees are a great way to show a list of items in a horizontal scrolling motion.
- `mini-calendar` — A composable mini calendar component for picking dates close to today.
- `pill` — A flexible badge component designed for a variety of use cases.
- `qr-code` — QR Code is a component that generates a QR code from a string.
- `rating` — A star rating component with keyboard navigation and hover effects.
- `reel` — A composable Reel component that looks like Instagram Stories - a full-height, 9:16 aspect ratio container wi…
- `relative-time` — A component that displays time in various timezones.
- `sandbox` — The sandbox component allows you to preview and test components in a sandboxed environment.
- `snippet` — Snippet is a component that allows you to display and copy code in a tabbed interface.
- `spinner` — A spinner is a visual indicator that shows progress or activity.
- `status` — Status components are used to display the uptime of a service.
- `stories` — A composable Stories component - a carousel of individual video cards like you'd see on Facebook.
- `table` — Table views are used to display data in a tabular format. They are useful for displaying large amounts of dat…
- `tags` — Tags are a way to apply multiple labels to an item.
- `theme-switcher` — A component to switch between light, dark and system theme.
- `ticker` — A composable finance ticker for displaying symbols, prices and changes.
- `tree` — A composable tree component with animated expand/collapse and customizable nodes.
- `typography` — A typography component designed to display text with a consistent style.
- `video-player` — A composable, shadcn/ui styled video player component that uses the media-chrome library.

## @magicui (246 items)

animated effects — most need the `motion` package (not yet in packages/ui); payloads are Tailwind-v4-leaning

- `magic-card` — A spotlight effect that follows your mouse cursor and highlights borders on hover.
- `android` — A mockup of an Android device.
- `warp-background` — A card with a time warping background effect.
- `line-shadow-text` — A text component with a moving line shadow.
- `aurora-text` — A beautiful aurora text effect
- `morphing-text` — A dynamic text morphing component for Magic UI.
- `scroll-progress` — Animated Scroll Progress for your pages
- `lens` — A interactive component that enables zooming into images, videos and other elements.
- `pointer` — A component that displays a pointer when hovering over an element
- `smooth-cursor` — A customizable, physics-based smooth cursor animation component with spring animations and rotation effects
- `progressive-blur` — The Progressive Blur component adds a smooth blur gradient effect to scrollable content, indicating more cont…
- `neon-gradient-card` — A beautiful neon card effect
- `noise-texture` — An SVG fractal noise layer using feTurbulence, desaturation, and contrast controls for subtle texture overlay…
- `meteors` — A meteor shower effect.
- `grid-pattern` — A background grid pattern made with SVGs, fully customizable using Tailwind CSS.
- `hexagon-pattern` — A background hexagon pattern made with SVGs, fully customizable using Tailwind CSS.
- `striped-pattern` — A background striped pattern made with SVGs, fully customizable using Tailwind CSS.
- `interactive-grid-pattern` — A interactive background grid pattern made with SVGs, fully customizable using Tailwind CSS.
- `dot-pattern` — A background dot pattern made with SVGs, fully customizable using Tailwind CSS.
- `flickering-grid` — A flickering grid background made with SVGs, fully customizable using Tailwind CSS.
- `hero-video-dialog` — A hero video dialog component.
- `code-comparison` — A component which compares two code snippets.
- `marquee` — An infinite scrolling component that can be used to display text, images, or videos.
- `globe` — An autorotating, interactive, and highly performant globe made using WebGL.
- `glyph-matrix` — An animated grid of subtly shifting glyphs with fade effect and theme support.
- `glare-hover` — A diagonal glare on hover using a ::before gradient and CSS variables (angle, size, duration, color).
- `shimmer-button` — A button with a shimmering light which travels around the perimeter.
- `tweet-card` — A card that displays a tweet with the author's name, handle, and profile picture.
- `client-tweet-card` — A client-side version of the tweet card that displays a tweet with the author's name, handle, and profile pic…
- `bento-grid` — Bento grid is a layout used to showcase the features of a product in a simple and elegant way.
- `particles` — Particles are a fun way to add some visual flair to your website. They can be used to create a sense of depth…
- `number-ticker` — Animate numbers to count up or down to a target number
- `ripple` — An animated ripple effect typically used behind elements to emphasize them.
- `retro-grid` — An animated scrolling retro grid effect
- `animated-list` — A list that animates each item in sequence with a delay. Used to showcase notifications or events on your lan…
- `animated-shiny-text` — A light glare effect which pans across text making it appear as if it is shimmering.
- `animated-grid-pattern` — A animated background grid pattern made with SVGs, fully customizable using Tailwind CSS.
- `border-beam` — An animated beam of light which travels along the border of its container.
- `animated-beam` — An animated beam of light which travels along a path. Useful for showcasing the integration features of a web…
- `text-reveal` — Fade in text as you scroll down the page.
- `dia-text-reveal` — A horizontal color band sweeps across text, revealing a gradient shine before settling on the base color.
- `hyper-text` — A text animation that scrambles letters before revealing the final text.
- `animated-gradient-text` — An animated gradient background which transitions between colors for text.
- `orbiting-circles` — A collection of circles which move in orbit along a circular path
- `dock` — An implementation of the MacOS dock using react + tailwindcss + motion
- `word-rotate` — A vertical rotation of words
- `avatar-circles` — Overlapping circles of avatars.
- `typing-animation` — Characters appearing in typed animation
- `sparkles-text` — A dynamic text that generates continuous sparkles with smooth transitions, perfect for highlighting text with…
- `spinning-text` — The Spinning Text component animates text in a circular motion with customizable speed, direction, color, and…
- `comic-text` — Comic text animation
- `icon-cloud` — An interactive 3D tag cloud component
- `text-animate` — A text animation component that animates text using a variety of different animations.
- `scroll-based-velocity` — Scrolling text whose speed changes based on scroll speed
- `shiny-button` — A shiny button component with dynamic styles in the dark mode or light mode.
- `shine-border` — Shine border is an animated background border effect.
- `animated-circular-progress-bar` — Animated Circular Progress Bar is a component that displays a circular gauge with a percentage value.
- `confetti` — Confetti animations are best used to delight your users when something special happens
- `cool-mode` — Cool mode effect for buttons, links, and other DOMs
- `pulsating-button` — An animated pulsating button useful for capturing attention of users.
- `ripple-button` — An animated button with ripple useful for user engagement.
- `file-tree` — A component used to showcase the folder and file structure of a directory.
- `blur-fade` — Blur fade in and out animation. Used to smoothly fade in and out content.
- `safari` — A safari browser mockup to showcase your website.
- `iphone` — A mockup of the iPhone
- `rainbow-button` — An animated button with a rainbow effect.
- `interactive-hover-button`
- `terminal` — A terminal component
- `video-text` — A component that displays text with a video playing in the background.
- `pixel-image` — A component that displays an image with a pixelated effect, creating a retro aesthetic.
- `highlighter` — A text highlighter that mimics the effect of a human-drawn marker stroke.
- `animated-theme-toggler` — Theme toggle with View Transitions and animated clip-path masks (circle, polygons, star), optional viewport-c…
- `light-rays` — A component with animated light rays which shine down from above.
- `dotted-map` — A component with a dotted map.
- `backlight` — A backlight glow effect for videos, images, and SVGs.
- `kinetic-text` — A text component that animates font weight of characters on hover.
- `text-3d-flip` — A text effect that flips each letter in 3D with a staggered animation on hover.
- `magic-card-demo` — Example showing a spotlight effect that follows your mouse cursor and highlights borders on hover.
- `magic-card-demo-2` — Example showing a magic card with an orb effect.
- `android-demo` — Example showing a mockup of an Android device.
- `android-demo-2` — Second example showing a mockup of an Android device.
- `android-demo-3` — Third example showing a mockup of an Android device.
- `warp-background-demo` — Example showing a card with a time warping background effect.
- `line-shadow-text-demo` — Example showing a text component with a moving line shadow.
- `aurora-text-demo` — Example showing a beautiful aurora text effect.
- `morphing-text-demo` — Example showing a dynamic text morphing component.
- `scroll-progress-demo` — Example showing animated scroll progress for your pages.
- `lens-demo` — Example showing a lens effect component
- `lens-demo-2` — Second example showing a lens effect component
- `lens-demo-3` — Third example showing a lens effect component
- `pointer-demo-1` — Example showing a pointer effect component
- `smooth-cursor-demo` — Basic smooth cursor example
- `progressive-blur-demo` — Example showing progressive blur effect for scrollable content.
- `neon-gradient-card-demo` — Example showing a beautiful neon card effect.
- `noise-texture-demo` — Example showing the SVG noise texture in a framed panel with a radial mask.
- `noise-texture-demo-2` — Example showing a newsletter signup card with email input over a noise texture.
- `noise-texture-demo-3` — Example showing NoiseTexture behind a button label inside a relative button.
- `noise-texture-demo-4` — Example showing a labeled input field with NoiseTexture filling the input container.
- `meteors-demo` — Example showing a meteor shower effect.
- `grid-pattern-demo` — Example showing a background grid pattern made with SVGs.
- `striped-pattern-demo` — Example showing a background striped pattern made with SVGs.
- `striped-pattern-dashed` — Example showing a background striped pattern with a dashed stroke.
- `striped-pattern-right` — Example showing a background striped pattern slanting to the right using SVG.
- `grid-pattern-linear-gradient` — Example showing a grid pattern with linear gradient effects.
- `grid-pattern-dashed` — Example showing a dashed grid pattern.
- `hexagon-pattern-demo` — Example showing a background hexagon pattern made with SVGs.
- `hexagon-pattern-linear-gradient` — Example showing a hexagon pattern with linear gradient effects.
- `hexagon-pattern-dashed` — Example showing a dashed hexagon pattern.
- `hexagon-pattern-spacing` — Example showing a hexagon pattern with extra spacing between cells.
- `dot-pattern-demo` — Example showing a background dot pattern made with SVGs.
- `dot-pattern-linear-gradient` — Example showing a dot pattern with linear gradient effects.
- `dot-pattern-with-glow-effect` — Example showing a dot pattern with glow effect
- `flickering-grid-demo` — Example showing a flickering grid background.
- `flickering-grid-rounded-demo` — Example showing a flickering grid background with rounded corners.
- `hero-video-dialog-demo` — Example showing a hero video dialog component.
- `hero-video-dialog-demo-top-in-bottom-out` — Example showing a hero video dialog with top-in bottom-out animation.
- `code-comparison-demo` — Example showing a component which compares two code snippets.
- `marquee-demo` — Example showing an infinite scrolling component.
- `marquee-demo-vertical` — Example showing a vertical infinite scrolling component.
- `marquee-logos` — Example showing an infinite scrolling logo carousel.
- `marquee-3d` — Example showing a 3D infinite scrolling component.
- `globe-demo` — Example showing an autorotating, interactive WebGL globe.
- `glyph-matrix-demo` — Example showing an animated grid of subtly shifting glyphs.
- `glare-hover-demo` — Pricing card with diagonal hover glare (duration 600ms).
- `glare-hover-demo-cta` — CTA card with hover glare (700ms).
- `glare-hover-demo-alert` — Three alerts with custom glare colors and opacity.
- `tweet-card-demo` — Example showing a tweet card with author info.
- `tweet-card-images` — Example showing a tweet card with images.
- `tweet-card-meta-preview` — Example showing a tweet card with meta preview.
- `shimmer-button-demo` — Example showing a button with a shimmering light effect.
- `bento-demo` — Example showing a bento grid layout for showcasing features.
- `bento-demo-vertical` — Example showing a vertical bento grid layout.
- `number-ticker-demo` — Example showing animated counting numbers.
- `number-ticker-demo-2` — Example showing animated counting numbers.
- `number-ticker-decimal-demo` — Example showing animated counting decimal numbers.
- `ripple-demo` — Example showing an animated ripple effect.
- `retro-grid-demo` — Example showing an animated scrolling retro grid effect.
- `animated-list-demo` — Example showing a list with sequenced item animations.
- `animated-shiny-text-demo` — Example showing text with a shimmering light effect.
- `particles-demo` — Example showing interactive particle effects.
- `animated-grid-pattern-demo` — Example showing an animated grid pattern background.
- `interactive-grid-pattern-demo` — Example showing an interactive grid pattern background.
- `interactive-grid-pattern-demo-2` — Second example showing an interactive grid pattern background.
- `border-beam-demo` — Example showing an animated border beam effect.
- `border-beam-demo-2` — Example showing an animated border beam effect.
- `border-beam-demo-3` — Example showing an animated border beam effect.
- `border-beam-demo-4` — Example showing an animated border beam effect.
- `animated-beam-demo` — Example showing an animated beam of light effect.
- `animated-beam-unidirectional` — Example showing a unidirectional animated beam effect.
- `animated-beam-bidirectional` — Example showing a bidirectional animated beam effect.
- `animated-beam-multiple-inputs` — Example showing animated beams with multiple input points.
- `animated-beam-multiple-outputs` — Example showing animated beams with multiple output points.
- `text-reveal-demo` — Example showing text that fades in on scroll.
- `dia-text-reveal-demo` — Example showing a sweeping color band reveal on headline text.
- `dia-text-reveal-demo-2` — Custom gradient colors and settled text color on a light background.
- `dia-text-reveal-demo-3` — Rotating phrases with repeat and repeat delay.
- `dia-text-reveal-demo-4` — Slower sweep with delay — custom duration and timing.
- `animated-gradient-text-demo` — Example showing text with animated gradient backgrounds.
- `animated-gradient-text-demo-2` — Second example showing text with animated gradient backgrounds.
- `orbiting-circles-demo` — Example showing circles moving in orbital paths.
- `dock-demo` — Example showing a MacOS-style dock implementation.
- `dock-demo-2` — Second example showing a MacOS-style dock implementation.
- `dock-demo-3` — Third example showing a MacOS-style dock implementation.
- `word-rotate-demo` — Example showing vertical word rotation animation.
- `hyper-text-demo` — Example showing text with scrambling letter animations.
- `avatar-circles-demo` — Example showing overlapping avatar circles.
- `typing-animation-demo` — Example showing typed character animations.
- `typing-animation-demo-2` — Example showing multiple words with looping.
- `typing-animation-demo-3` — Example showing custom typing and deleting speeds.
- `typing-animation-demo-4` — Example showing animation that starts when in viewport.
- `typing-animation-demo-5` — Example showing typing animation without cursor.
- `typing-animation-demo-6` — Example showing single play without looping.
- `typing-animation-demo-7` — Example showing cursor blinking control.
- `typing-animation-demo-8` — Example showing different cursor styles (line, block, underscore).
- `scroll-based-velocity-demo` — Example showing text speed changes based on scroll velocity.
- `scroll-based-velocity-images-demo` — Example showing Unsplash images scrolling with speed reacting to scroll velocity.
- `sparkles-text-demo` — Example showing text with animated sparkle effects.
- `spinning-text-demo` — Example showing spinning text animation.
- `spinning-text-demo-2` — Example showing spinning text animation.
- `comic-text-demo` — Example showing comic text animation.
- `icon-cloud-demo` — Example showing an interactive 3D icon cloud.
- `icon-cloud-demo-2` — Second example showing an interactive 3D icon cloud.
- `icon-cloud-demo-3` — Third example showing an interactive 3D icon cloud.
- `text-animate-demo` — Example showing various text animations.
- `text-animate-demo-2` — Second example showing various text animations.
- `text-animate-demo-3` — Third example showing various text animations.
- `text-animate-demo-4` — Fourth example showing various text animations.
- `text-animate-demo-5` — Fifth example showing various text animations.
- `text-animate-demo-6` — Sixth example showing various text animations.
- `text-animate-demo-7` — Seventh example showing various text animations.
- `text-animate-demo-8` — Eighth example showing various text animations.
- `text-animate-demo-9` — Ninth example showing various text animations.
- `shiny-button-demo` — Example showing a shiny button with dynamic styles.
- `animated-circular-progress-bar-demo` — Example showing an animated circular progress gauge.
- `shine-border-demo` — Example showing an animated shining border effect.
- `shine-border-demo-2` — Second example showing an animated shining border effect.
- `confetti-demo` — Example showing confetti animations for celebrations.
- `confetti-basic-cannon` — Example showing basic confetti cannon animation.
- `confetti-random-direction` — Example showing confetti with random directions.
- `confetti-fireworks` — Example showing fireworks-style confetti animation.
- `confetti-stars` — Example showing star-shaped confetti animation.
- `confetti-side-cannons` — Example showing side-mounted confetti cannons.
- `confetti-custom-shapes` — Example showing confetti with custom shape particles.
- `confetti-emoji` — Example showing confetti with emoji particles.
- `cool-mode-demo` — Example showing cool mode effect for buttons and links.
- `cool-mode-custom` — Example showing customized cool mode effects.
- `pulsating-button-demo` — Example showing an animated pulsating button.
- `pulsating-button-demo-2` — Example showing an animated pulsating button with a ripple varaint.
- `ripple-button-demo` — Example showing an animated button with ripple effect.
- `file-tree-demo` — Example showing a component that displays folder and file structure.
- `blur-fade-demo` — Example showing blur fade in and out animations.
- `blur-fade-text-demo` — Example showing blur fade animations with text.
- `safari-demo` — Example showing a Safari browser mockup.
- `safari-demo-2` — Second example showing a Safari browser mockup.
- `safari-demo-3` — Third example showing a Safari browser mockup.
- `safari-demo-4` — Fourth example showing a Safari browser mockup.
- `iphone-demo` — Example showing an iPhone mockup.
- `iphone-demo-2` — Second example showing an iPhone mockup.
- `iphone-demo-3` — Third example showing an iPhone mockup.
- `rainbow-button-demo` — Example showing an animated button with rainbow effect.
- `rainbow-button-demo-2` — Example showing an animated button with rainbow effect.
- `interactive-hover-button-demo` — Example showing an interactive button with hover effects.
- `terminal-demo` — Example showing a terminal with animated text.
- `terminal-demo-2` — Example showing a terminal with animated text and custom delays
- `video-text-demo` — Example showing text with a video background.
- `pixel-image-demo` — Example showing a pixelated image effect.
- `highlighter-demo` — Example showing the demo of a Highlighter
- `animated-theme-toggler-demo` — Example showing animation while changing the theme.
- `animated-theme-toggler-square-demo` — Theme transition with a square clip reveal.
- `animated-theme-toggler-diamond-demo` — Theme transition with a diamond-shaped clip reveal.
- `animated-theme-toggler-rectangle-demo` — Theme transition with a rectangle clip reveal.
- `animated-theme-toggler-hexagon-demo` — Theme transition with a hexagon clip reveal.
- `animated-theme-toggler-triangle-demo` — Theme transition with a triangle clip reveal.
- `animated-theme-toggler-star-demo` — Theme transition with a star-shaped clip reveal.
- `animated-theme-toggler-next-themes-demo` — Controlled usage with next-themes so useTheme() subscribers stay in sync on toggle.
- `light-rays-demo` — Demo of the light-rays component showcasing animated light rays
- `dotted-map-demo` — Example showing a dotted map.
- `dotted-map-demo-2` — Example showing a dotted map.
- `dotted-map-demo-3` — Example showing a dotted map with pulse animation.
- `backlight-video-demo` — An example of the backlight component with a video.
- `backlight-image-demo` — An example of the backlight component with a image.
- `backlight-svg-demo` — An example of the backlight component with SVGs.
- `kinetic-text-demo` — An example of the kinetic text component.
- `text-3d-flip-demo` — Example showing a 3D text animation that rotates each letter on hover.
- `text-3d-flip-demo-2` — Example showing a 3D text flip with stagger from center.
- `utils`

## @coss (560 items)

ex-Origin UI variant library — Base UI-based; swap primitives to Radix when vendoring

ui · accordion · alert · alert-dialog · autocomplete · avatar · badge · breadcrumb · button · calendar
card · checkbox · checkbox-group · collapsible · combobox · command · context-menu · dialog · drawer · empty
field · fieldset · form · frame · group · input · otp-field · input-group · kbd · label
menu · meter · number-field · pagination · popover · preview-card · progress · radio-group · scroll-area · select
separator · sheet · sidebar · skeleton · slider · spinner · switch · table · tabs · textarea
toast · toggle · toggle-group · toolbar · tooltip · p-accordion-1 · p-accordion-2 · p-accordion-3 · p-accordion-4 · p-alert-1
p-alert-2 · p-alert-3 · p-alert-4 · p-alert-5 · p-alert-6 · p-alert-7 · p-alert-dialog-1 · p-alert-dialog-2 · p-autocomplete-1 · p-autocomplete-2
p-autocomplete-3 · p-autocomplete-4 · p-autocomplete-5 · p-autocomplete-6 · p-autocomplete-7 · p-autocomplete-8 · p-autocomplete-9 · p-autocomplete-10 · p-autocomplete-11 · p-autocomplete-12
p-autocomplete-13 · p-autocomplete-14 · p-autocomplete-15 · p-avatar-1 · p-avatar-2 · p-avatar-3 · p-avatar-4 · p-avatar-5 · p-avatar-6 · p-avatar-7
p-avatar-8 · p-avatar-9 · p-avatar-10 · p-avatar-11 · p-avatar-12 · p-avatar-13 · p-avatar-14 · p-badge-1 · p-badge-2 · p-badge-3
p-badge-4 · p-badge-5 · p-badge-6 · p-badge-7 · p-badge-8 · p-badge-9 · p-badge-10 · p-badge-11 · p-badge-12 · p-badge-13
p-badge-14 · p-badge-15 · p-badge-16 · p-badge-17 · p-badge-18 · p-badge-19 · p-badge-20 · p-breadcrumb-1 · p-breadcrumb-2 · p-breadcrumb-3
p-breadcrumb-4 · p-breadcrumb-5 · p-breadcrumb-6 · p-breadcrumb-7 · p-button-1 · p-button-2 · p-button-3 · p-button-4 · p-button-5 · p-button-6
p-button-7 · p-button-8 · p-button-9 · p-button-10 · p-button-11 · p-button-12 · p-button-13 · p-button-14 · p-button-15 · p-button-16
p-button-17 · p-button-41 · p-button-18 · p-button-19 · p-button-20 · p-button-21 · p-button-22 · p-button-23 · p-button-24 · p-button-26
p-button-27 · p-button-28 · p-button-29 · p-button-30 · p-button-31 · p-button-32 · p-button-33 · p-button-34 · p-button-35 · p-button-36
p-button-37 · p-button-39 · p-button-40 · p-button-38 · p-calendar-1 · p-calendar-3 · p-calendar-4 · p-calendar-5 · p-calendar-6 · p-calendar-7
p-calendar-8 · p-calendar-2 · p-calendar-9 · p-calendar-10 · p-calendar-11 · p-calendar-12 · p-calendar-13 · p-calendar-14 · p-calendar-15 · p-calendar-16
p-calendar-17 · p-calendar-18 · p-calendar-19 · p-calendar-20 · p-calendar-21 · p-calendar-22 · p-calendar-23 · p-calendar-24 · p-date-picker-1 · p-date-picker-2
p-date-picker-9 · p-date-picker-3 · p-date-picker-4 · p-date-picker-5 · p-date-picker-6 · p-date-picker-7 · p-date-picker-8 · p-card-1 · p-card-2 · p-card-3
p-card-4 · p-card-5 · p-card-6 · p-card-7 · p-card-8 · p-card-9 · p-card-10 · p-card-11 · p-checkbox-1 · p-checkbox-2
p-checkbox-3 · p-checkbox-4 · p-checkbox-5 · p-checkbox-group-1 · p-checkbox-group-2 · p-checkbox-group-3 · p-checkbox-group-4 · p-checkbox-group-5 · p-collapsible-1 · p-combobox-1
p-combobox-2 · p-combobox-3 · p-combobox-4 · p-combobox-5 · p-combobox-6 · p-combobox-7 · p-combobox-8 · p-combobox-9 · p-combobox-10 · p-combobox-11
p-combobox-12 · p-combobox-13 · p-combobox-14 · p-combobox-15 · p-combobox-16 · p-combobox-17 · p-combobox-18 · p-command-1 · p-command-2 · p-dialog-1
p-dialog-6 · p-dialog-2 · p-dialog-3 · p-dialog-4 · p-dialog-5 · p-drawer-1 · p-drawer-2 · p-drawer-3 · p-drawer-4 · p-drawer-5
p-drawer-6 · p-drawer-7 · p-drawer-8 · p-drawer-9 · p-drawer-10 · p-drawer-11 · p-drawer-12 · p-drawer-13 · p-drawer-14 · p-empty-1
p-field-1 · p-field-2 · p-field-3 · p-field-4 · p-field-5 · p-field-6 · p-field-7 · p-field-8 · p-field-9 · p-field-10
p-field-11 · p-field-12 · p-field-13 · p-field-14 · p-field-15 · p-field-16 · p-field-17 · p-field-18 · p-fieldset-1 · p-form-1
p-form-2 · p-frame-1 · p-frame-3 · p-frame-4 · p-frame-2 · p-kbd-1 · p-group-1 · p-group-2 · p-group-3 · p-group-4
p-group-5 · p-group-6 · p-group-7 · p-group-8 · p-group-9 · p-group-10 · p-group-11 · p-group-12 · p-group-13 · p-group-14
p-group-15 · p-group-16 · p-group-17 · p-group-18 · p-group-19 · p-group-20 · p-group-22 · p-group-23 · p-input-1 · p-input-2
p-input-3 · p-input-4 · p-input-5 · p-input-6 · p-input-7 · p-input-8 · p-input-9 · p-input-10 · p-input-11 · p-input-12
p-input-13 · p-input-14 · p-input-15 · p-input-16 · p-input-17 · p-otp-field-1 · p-otp-field-2 · p-otp-field-3 · p-otp-field-4 · p-otp-field-6
p-otp-field-7 · p-otp-field-8 · p-otp-field-9 · p-otp-field-10 · p-input-group-1 · p-input-group-2 · p-input-group-3 · p-input-group-4 · p-input-group-5 · p-input-group-6
p-input-group-7 · p-input-group-8 · p-input-group-9 · p-input-group-10 · p-input-group-11 · p-input-group-12 · p-input-group-13 · p-input-group-14 · p-input-group-15 · p-input-group-16
p-input-group-17 · p-input-group-18 · p-input-group-19 · p-input-group-20 · p-input-group-21 · p-input-group-22 · p-input-group-23 · p-input-group-24 · p-input-18 · p-input-19
p-input-group-26 · p-input-group-27 · p-input-group-28 · p-input-group-29 · p-meter-1 · p-meter-2 · p-meter-3 · p-meter-4 · p-menu-1 · p-menu-2
p-menu-3 · p-menu-9 · p-menu-4 · p-menu-5 · p-menu-6 · p-menu-7 · p-menu-8 · p-context-menu-1 · p-context-menu-2 · p-context-menu-3
p-context-menu-4 · p-context-menu-5 · p-context-menu-6 · p-context-menu-7 · p-context-menu-8 · p-number-field-1 · p-number-field-2 · p-number-field-3 · p-number-field-4 · p-number-field-5
p-number-field-6 · p-number-field-7 · p-number-field-8 · p-number-field-9 · p-number-field-10 · p-number-field-11 · p-pagination-1 · p-pagination-2 · p-pagination-3 · p-popover-1
p-popover-2 · p-popover-3 · p-preview-card-1 · p-progress-1 · p-progress-2 · p-progress-3 · p-radio-group-1 · p-radio-group-2 · p-radio-group-3 · p-radio-group-4
p-radio-group-5 · p-radio-group-6 · p-scroll-area-1 · p-scroll-area-2 · p-scroll-area-3 · p-scroll-area-4 · p-scroll-area-5 · p-select-1 · p-select-2 · p-select-3
p-select-4 · p-select-5 · p-select-6 · p-select-7 · p-select-8 · p-select-9 · p-select-10 · p-select-12 · p-select-13 · p-select-14
p-select-15 · p-select-16 · p-select-17 · p-select-18 · p-select-19 · p-select-20 · p-select-21 · p-select-22 · p-select-23 · p-select-11
p-separator-1 · p-sheet-1 · p-sheet-2 · p-sheet-3 · p-skeleton-1 · p-skeleton-2 · p-slider-1 · p-slider-2 · p-slider-3 · p-slider-4
p-slider-5 · p-slider-6 · p-slider-7 · p-slider-8 · p-slider-9 · p-slider-10 · p-slider-11 · p-slider-12 · p-slider-13 · p-slider-14
p-slider-15 · p-slider-16 · p-slider-17 · p-slider-18 · p-slider-19 · p-slider-20 · p-slider-21 · p-slider-22 · p-slider-23 · p-spinner-1
p-switch-1 · p-switch-2 · p-switch-3 · p-switch-4 · p-switch-5 · p-switch-6 · p-table-1 · p-table-2 · p-table-3 · p-table-4
p-table-5 · p-table-7 · p-table-6 · p-table-8 · p-tabs-1 · p-tabs-2 · p-tabs-3 · p-tabs-4 · p-tabs-5 · p-tabs-6
p-tabs-7 · p-tabs-8 · p-tabs-9 · p-tabs-10 · p-tabs-11 · p-tabs-12 · p-tabs-13 · p-textarea-1 · p-textarea-2 · p-textarea-3
p-textarea-4 · p-textarea-5 · p-textarea-6 · p-textarea-7 · p-textarea-8 · p-textarea-9 · p-textarea-10 · p-textarea-11 · p-textarea-12 · p-textarea-13
p-textarea-14 · p-textarea-15 · p-toast-1 · p-toast-2 · p-toast-3 · p-toast-4 · p-toast-5 · p-toast-6 · p-toast-7 · p-toast-8
p-toast-9 · p-toast-10 · p-toast-11 · p-toast-12 · p-toast-13 · p-toggle-group-1 · p-toggle-group-2 · p-toggle-group-3 · p-toggle-group-4 · p-toggle-group-5
p-toggle-group-6 · p-toggle-group-7 · p-toggle-group-8 · p-toggle-group-9 · p-toggle-1 · p-toggle-2 · p-toggle-3 · p-toggle-4 · p-toggle-5 · p-toggle-6
p-toggle-7 · p-toggle-8 · p-toolbar-1 · p-tooltip-1 · p-tooltip-2 · p-tooltip-3 · p-tooltip-4 · style · colors-neutral · fonts
font-sans · font-heading · font-mono · utils · use-render · merge-props · csp-provider · direction-provider · use-media-query · use-copy-to-clipboard
