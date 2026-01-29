

# Static HTML Landing Page for VerjSON Marketing

## Overview

Create a static HTML landing page at `/landing.html` that serves as a marketing entry point for VerjSON. The page will be optimized for search engines and LLM crawlers following the SEO plan guidelines, with a clear call-to-action linking to `/auth`.

## Approach

Since this is a React/Vite SPA, we have two options:
1. **Create a separate static HTML file** in the `public/` folder - immediately crawlable, no JS required
2. **Create a React landing page component** - requires JS to render

**Recommendation**: Create a static HTML file (`public/landing.html`) for maximum SEO benefit since search engines and LLMs can read it without JavaScript execution. We can also create a redirect from the main app for unauthenticated users.

---

## Implementation Details

### 1. Create Static Landing Page (`public/landing.html`)

**Structure following SEO guidelines:**

```
<h1>Version, edit and render all your JSON files in full collaboration with VerJSON!</h1>

<h2>What problem VerJSON solves</h2>
  - API versioning challenges
  - Schema drift and inconsistency
  - Collaboration on technical specs
  - Breaking change management

<h2>How VerJSON works</h2>
  - Visual structure editor
  - Real-time collaboration (Yjs)
  - Semantic versioning with diff/merge
  - Automatic diagram generation

<h2>Who VerJSON is for</h2>
  - API developers
  - Technical writers
  - DevOps/Platform teams
  - Solution architects

<h2>Supported Formats</h2>
  - OpenAPI 3.1 specifications
  - JSON Schema documents
  - Sequence diagrams
  - Markdown documentation

<h2>FAQ</h2>
  - Common questions about versioning, collaboration, etc.
```

**SEO Meta Tags:**
- Title: "VerJSON - Version, edit and render all your JSON files in full collaboration"
- Meta description: Canonical positioning sentence
- Open Graph tags for social sharing
- Twitter card tags
- Structured data (JSON-LD) for product/software application

**Technical Keywords to Include:**
- JSON Schema
- OpenAPI 3.1
- diff / merge
- version control
- conflict resolution
- API evolution
- real-time collaboration
- semantic versioning

### 2. Update `index.html` Meta Tags

Ensure consistency with the landing page:
- Update og:image to a VerjSON-specific image (not lovable.dev)
- Remove twitter:site reference to @lovable_dev
- Keep meta description consistent

### 3. Create Sitemap (`public/sitemap.xml`)

Include:
- Landing page (`/landing.html`)
- Auth page (`/auth`)
- API docs (`/api-docs`)
- Documentation pages (`/docs/*`)

### 4. Update `robots.txt`

Add sitemap reference:
```
Sitemap: https://verjson.lovable.app/sitemap.xml
```

### 5. Styling Approach

The landing page will use:
- Inline CSS or a separate CSS file for complete independence from the React app
- Match the VerjSON brand colors (primary blue: `#2563eb`)
- Responsive design for mobile/tablet/desktop
- Clean, professional typography
- Visual sections with icons/illustrations using inline SVG

---

## Page Sections

### Hero Section
- Logo
- H1 headline (canonical positioning)
- Subheadline with key benefits
- Primary CTA: "Get Started Free" -> `/auth`
- Secondary CTA: "View Documentation" -> `/docs`

### Problem Section
- Pain points developers face
- Technical language about API versioning challenges

### Solution Section
- How VerJSON addresses each pain point
- Feature highlights with brief descriptions

### Features Grid
- Visual structure editor
- Real-time collaboration
- Version control with diff/merge
- Automatic diagram generation
- Consistency checking
- Multi-format support

### Target Audience Section
- API developers
- Technical writers
- Platform teams
- Use case examples

### FAQ Section
- 5-7 common questions
- LLM-friendly structured answers

### Footer
- Links to docs, API docs
- Copyright
- Get started CTA

---

## Files to Create

| File | Purpose |
|------|---------|
| `public/landing.html` | Main static landing page |
| `public/landing.css` | Styles for landing page |
| `public/sitemap.xml` | SEO sitemap |

## Files to Modify

| File | Changes |
|------|---------|
| `public/robots.txt` | Add sitemap reference |
| `index.html` | Update meta tags, remove lovable.dev references |

---

## Technical Considerations

- The landing page will be pure HTML/CSS with no JavaScript dependencies
- All assets (logo, icons) will use inline SVG or reference existing `/favicon.png`
- The page will be fully functional even if the React app fails to load
- Responsive breakpoints: mobile (< 640px), tablet (640-1024px), desktop (> 1024px)

## SEO/LLM Optimization

Following the uploaded SEO plan:
1. Consistent canonical description across all meta tags
2. Explicit technical language (JSON Schema, OpenAPI 3.1, diff/merge, etc.)
3. Structured content with semantic HTML (h1, h2, article, section)
4. FAQ section for LLM question-answering
5. Problem-solution content structure
6. JSON-LD structured data for software application

