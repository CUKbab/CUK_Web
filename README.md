# CUK밥 (Web)

The unofficial web version of the Catholic University of Korea (CUK) menu viewer. Built with React, TypeScript, and Vite, featuring a sleek LG UX (Velvet UI) inspired design.

**Live Demo:** [https://CUKbab.github.io/CUK_Web/](https://CUKbab.github.io/CUK_Web/)

## Features

- **LG UX 9.0 Inspired UI**: A clean, minimalist interface with "Tactile Elegance" and fluid animations.
- **Smart Navigation**: View daily menus for "Buon Pranzo" and "Cafe Bona" with weekend-skipping logic.
- **Performance Caching**: Automatic weekly menu caching in `localStorage` for near-instant loading.
- **Archived Menus**: Access previous weeks' menus directly from the GitHub menu archive.
- **Multi-language Support**: Full support for Korean, English, Japanese, and Chinese (Simplified).
- **Firebase Integration**: Secure Google Login for feature suggestions and bug reporting.
- **Instant Reporting**: One-click menu error reporting (no login required).

## Tech Stack

- **Framework**: React 19 (TypeScript)
- **Bundler**: Vite
- **Styling**: Vanilla CSS (Mobile-first, Responsive)
- **Backend/Auth**: Firebase (Authentication & Firestore)
- **Data Source**: [CUK_Menu GitHub Repository](https://github.com/CUKbab/CUK_Menu)
- **Deployment**: GitHub Actions + GitHub Pages

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

### Build

```bash
# Build for production
npm run build
```

## Deployment

The application is automatically deployed to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch.

## Related Projects

- [CUK_Android](https://github.com/CUKbab/CUK_Android): The original Android version of this application.
- [CUK_Menu](https://github.com/CUKbab/CUK_Menu): The menu data parser and repository.

---
