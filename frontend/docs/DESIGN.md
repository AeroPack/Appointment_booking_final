---
name: Serene Health
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#7f4025'
  on-tertiary: '#ffffff'
  tertiary-container: '#9c573a'
  on-tertiary-container: '#ffe5db'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb598'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#72361b'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  surface-card: '#FFFFFF'
  text-primary: '#0F172A'
  text-secondary: '#64748B'
  status-success: '#16A34A'
  status-warning: '#F59E0B'
  status-error: '#DC2626'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  margin-mobile: 20px
  gutter-card: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  tap-target-min: 48px
---

## Brand & Style

The design system is centered on a "Clinical Minimalist" aesthetic, prioritizing calmness, clarity, and trust. It is specifically tailored for a diverse demographic, ranging from digital natives to older adults, requiring a interface that feels both contemporary and deeply intuitive.

The style leverages **Modern Corporate** principles with a focus on **Tactile Accessibility**. It avoids overwhelming the user with complex decorations, instead using generous whitespace and a restricted color palette to reduce cognitive load. The emotional response should be one of reliability and ease, transforming the often stressful task of medical booking into a streamlined, serene experience. Every interaction is designed to feel intentional and supportive.

## Colors

The palette is anchored by a deep teal, chosen for its psychological associations with health, stability, and professionalism. 

- **Primary Teal (#0F766E):** Used for critical actions and brand presence to ensure high contrast against light backgrounds.
- **Accent Teal (#14B8A6):** Used for active states and subtle highlights to provide visual continuity without the weight of the primary color.
- **Background & Neutrals:** The application uses a very light cool gray (#F8FAFC) for the canvas to reduce eye strain compared to pure white, while card surfaces remain pure white (#FFFFFF) to create clear containment.
- **Semantic Colors:** Success, warning, and error colors are calibrated to meet WCAG 2.1 AA standards, ensuring they are legible for users with color vision deficiencies.

## Typography

This design system utilizes **Inter** exclusively to ensure maximum legibility across different screen densities. The typographic scale is generous, starting with a 16px base to accommodate users with varying visual acuity. 

Headlines use a bold weight to provide a strong structural anchor for each page, while body text maintains a comfortable line height (1.5x) to improve reading rhythm. All labels for buttons and navigation are clear and distinct, avoiding overly thin weights or condensed tracking.

## Layout & Spacing

The layout follows a **Fluid Mobile-First** model. It primarily utilizes a single-column stack to simplify the user journey and focus attention on one task at a time.

- **Margins:** A consistent 20px horizontal margin is applied to the screen edges.
- **Vertical Rhythm:** Elements are spaced using an 8px-based grid. 24px gaps are used to separate major sections, while 16px gaps separate related elements within a card.
- **Accessibility:** All interactive elements (buttons, inputs, toggles) must maintain a minimum height or width of 48px to satisfy touch-target requirements for users with limited motor precision.

## Elevation & Depth

Visual hierarchy is established through a combination of **Tonal Layering** and **Ambient Shadows**. 

The background (#F8FAFC) acts as the base layer. Interactive cards sit on top of this base with a "Soft Float" effect: a very subtle, diffused shadow (0px 4px 12px, 5% opacity of the primary text color) to provide depth without clutter. This makes the actionable areas of the app feel physically separate and easy to identify. No harsh borders are used; the transition between layers is defined by color value and soft shadow alone.

## Shapes

The shape language is "Friendly Geometry." 

- **Cards:** Use `rounded-xl` (1.5rem / 24px) to create a soft, welcoming feel that differentiates the content blocks from the screen edges.
- **Buttons:** Primary actions use a full pill shape (999px) to signal high interactability and comfort.
- **Selection States:** Form fields and small chips use a standard `rounded-lg` (1rem / 16px) to maintain consistency with the card language while fitting into tighter layouts.

## Components

### Buttons
- **Primary:** Pill-shaped, Primary Teal background, white text. Minimum height 48px.
- **Secondary:** Pill-shaped, 1px border of Primary Teal or light teal ghost background.
- **Active State:** Slight darken of the background color on press.

### Cards
- **Appointment Cards:** White background, `rounded-xl` corners, soft ambient shadow. Includes clear 18px body text for doctor names and bold labels for times.
- **Container Padding:** All cards must have a minimum of 16px internal padding.

### Inputs & Selection
- **Text Fields:** 48px height, `rounded-lg`, 1px neutral border. Label sits above the field in `label-lg` style.
- **Chips (Time Slots):** Rounded rectangles with light teal backgrounds and bold teal text for unselected states; inverted for selected states.

### Navigation
- **Top App Bar:** Centered title using `headline-md`, simple back arrow on the left. Fixed to top with a white surface and no shadow (using a thin neutral bottom border instead).
- **Bottom Tab Bar:** Minimalist icons with `label-md` text. The active icon uses the primary teal color.

### Feedback
- **Success/Error Banners:** Full-width alerts at the top of the content area using low-saturation versions of the semantic colors for the background and high-saturation versions for the text/icons.