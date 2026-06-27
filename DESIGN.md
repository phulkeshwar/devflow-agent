# Design System: DevFlow Agent (Vercel Amber Theme)

## 1. Visual Theme & Atmosphere
The atmosphere is ultra-minimalist, high-contrast dark mode, and developer-centric, inspired by Vercel's Geist design language. It uses thin borders, crisp typography, generous whitespace, and a glowing amber-orange accent tone to signify flow, energy, and AI power.

---

## 2. Color Palette & Roles

| Color Name | Hex Code | Functional Role |
| :--- | :--- | :--- |
| **Pure Black** | `#000000` | Global page background |
| **Dark Charcoal** | `#0a0a0a` | Container/Card background |
| **Elevated Gray** | `#121212` | Input fields and active tab background |
| **Vercel Orange (Amber)** | `#ff6b00` | Primary brand accent, primary button, active states |
| **Bright Gold** | `#ffaa00` | Secondary gradient accent |
| **Border Dark** | `#1f1f1f` | Default subtle borders |
| **Border Focus** | `#ff6b0050` | Glow border for active focus elements |
| **Text Primary** | `#ffffff` | Headers and high-contrast text |
| **Text Secondary** | `#888888` | Labels, descriptions, and placeholders |
| **Text Muted** | `#444444` | Disabled states and inactive timelines |

---

## 3. Typography Rules
*   **Font Family:** Geist Sans, Outfit, or system default monospace (`Geist Mono`, `Consolas`) for code blocks.
*   **Weights:** Light (300) for descriptions, Regular (400) for UI controls, Semi-Bold (600) for section headers, Bold (700) for hero title.
*   **Spacing:** Letter-spacing set to `-0.02em` for headers to make them feel premium and cohesive.

---

## 4. Component Stylings

### Buttons
*   **Shape:** Subtly rounded corners (`border-radius: 8px`), flat design.
*   **Color:** Gradient background from `#ff6b00` to `#ffaa00` with white text.
*   **Hover Behavior:** Subtle box-shadow glow (`0 0 20px rgba(255, 107, 0, 0.4)`) and slight scaling transition.

### Cards/Containers
*   **Shape:** 8px rounded corners, flat borders (`1px solid #1f1f1f`).
*   **Shadow:** Deep, soft diffused black shadow (`0 8px 30px rgba(0, 0, 0, 0.5)`).

### Inputs/Forms
*   **Shape:** 8px rounded, background `#121212`, border `1px solid #2a2a2a`.
*   **Focus State:** Smooth transition to border `#ff6b00` and an amber glow outline.

---

## 5. Layout & UI Polish
*   **Spacing:** Grid layout with `24px` gaps (bento-style card arrangement).
*   **Active Timeline:** A linear vertical checklist with pulsing orange status indicators.
*   **Transitions:** All state changes use `cubic-bezier(0.16, 1, 0.3, 1)` transitions for a fluid, premium feel.
